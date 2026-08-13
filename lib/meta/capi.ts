import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

// Config do Meta guardada em settings (key = 'meta_capi'):
//   { dataset_id, access_token, event_name?, lead_event_source?, test_event_code? }
// Enquanto não estiver preenchida, o envio é um no-op (skipped).
type MetaConfig = {
  dataset_id: string;
  access_token: string;
  event_name?: string;
  lead_event_source?: string;
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
    lead_event_source: v.lead_event_source,
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

  // Usa o formato de "evento de CRM" (action_source: system_generated), que aceita
  // o ctwa_clid como identificador de clique ("Identificação do clique", prioridade
  // mais alta na doc do Meta). O formato business_messaging exigiria a conta do
  // WhatsApp formalmente vinculada ao dataset — bloqueado por "Página não qualificada".
  const eventName = params.eventName || cfg.event_name || "LeadQualificado";
  const userData: Record<string, unknown> = { ctwa_clid: params.ctwaClid };
  if (params.phone) {
    const digits = params.phone.replace(/\D/g, "");
    if (digits) userData.ph = [sha256(digits)];
  }

  const customData: Record<string, unknown> = {
    event_source: "crm",
    lead_event_source: cfg.lead_event_source || "CRM Probel",
    ...(params.value != null
      ? { value: params.value, currency: params.currency || "BRL" }
      : {}),
  };

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "system_generated",
        ...(params.eventId ? { event_id: params.eventId } : {}),
        user_data: userData,
        custom_data: customData,
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
