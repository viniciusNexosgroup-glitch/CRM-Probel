import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

// Config do Meta guardada em settings (key = 'meta_capi'):
//   { dataset_id, access_token, event_name?, test_event_code? }
// Enquanto não estiver preenchida, o envio é um no-op (skipped).
type MetaConfig = {
  dataset_id: string;
  access_token: string;
  event_name?: string;
  test_event_code?: string;
};

async function getMetaConfig(): Promise<MetaConfig | null> {
  const svc = createServiceClient();
  const { data } = await svc.from("settings").select("value").eq("key", "meta_capi").maybeSingle();
  const v = (data?.value ?? null) as Partial<MetaConfig> | null;
  if (!v?.dataset_id || !v?.access_token) return null;
  return {
    dataset_id: v.dataset_id,
    access_token: v.access_token,
    event_name: v.event_name,
    test_event_code: v.test_event_code,
  };
}

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s.trim().toLowerCase()).digest("hex");
}

export type CapiResult = { ok: boolean; skipped?: boolean; error?: string; response?: unknown };

/**
 * Envia um evento de conversão pro Meta (Conversions API) atribuído ao clique do
 * anúncio Click-to-WhatsApp (ctwa_clid). Isso alimenta a otimização da campanha.
 * No-op se o Meta ainda não foi configurado nas settings.
 */
export async function sendCtwaConversion(params: {
  ctwaClid: string | null;
  eventName?: string;
  phone?: string | null;
  eventId?: string;
  value?: number | null;
  currency?: string;
}): Promise<CapiResult> {
  const cfg = await getMetaConfig();
  if (!cfg) return { ok: false, skipped: true };
  if (!params.ctwaClid) return { ok: false, skipped: true, error: "lead sem ctwa_clid" };

  const eventName = params.eventName || cfg.event_name || "Lead";
  const userData: Record<string, unknown> = { ctwa_clid: params.ctwaClid };
  if (params.phone) {
    const digits = params.phone.replace(/\D/g, "");
    if (digits) userData.ph = [sha256(digits)];
  }

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "business_messaging",
        ...(params.eventId ? { event_id: params.eventId } : {}),
        user_data: userData,
        ...(params.value != null
          ? { custom_data: { value: params.value, currency: params.currency || "BRL" } }
          : {}),
      },
    ],
    ...(cfg.test_event_code ? { test_event_code: cfg.test_event_code } : {}),
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${cfg.dataset_id}/events?access_token=${encodeURIComponent(cfg.access_token)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!res.ok) return { ok: false, error: json?.error?.message || `HTTP ${res.status}`, response: json };
    return { ok: true, response: json };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
