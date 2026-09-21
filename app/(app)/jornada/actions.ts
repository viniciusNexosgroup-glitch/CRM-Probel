"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentInstanceId, getCachedProfile } from "@/lib/auth/current-user";
import type { Json, Database } from "@/types/database";

type Result = { ok: true } | { ok: false; error: string };

/** Eventos padrão do Meta aceitos numa etapa (mesma lista da checagem no banco). */
export const EVENTOS_META = [
  "Contact",
  "Lead",
  "CompleteRegistration",
  "Schedule",
  "ViewContent",
  "InitiateCheckout",
  "AddToCart",
  "AddPaymentInfo",
  "Purchase",
  "Subscribe",
  "StartTrial",
  "SubmitApplication",
  "FindLocation",
  "Search",
  "CustomizeProduct",
  "AddToWishlist",
  "Donate",
] as const;

export type CamposDaEtapa = {
  name: string;
  meta_event_name: string | null;
  is_sale: boolean;
  default_value: number | null;
  is_first_contact: boolean;
  keyword: string | null;
};

type AtualizacaoEtapa = Database["public"]["Tables"]["pipeline_stages"]["Update"];

function limpar(c: Partial<CamposDaEtapa>): AtualizacaoEtapa {
  const out: AtualizacaoEtapa = {};
  if (c.name !== undefined) out.name = c.name.trim();
  if (c.meta_event_name !== undefined)
    out.meta_event_name = c.meta_event_name?.trim() ? c.meta_event_name : null;
  if (c.is_sale !== undefined) out.is_sale = c.is_sale;
  if (c.is_first_contact !== undefined) out.is_first_contact = c.is_first_contact;
  if (c.default_value !== undefined)
    out.default_value = c.default_value != null && !Number.isNaN(c.default_value) ? c.default_value : null;
  if (c.keyword !== undefined) out.keyword = c.keyword?.trim() ? c.keyword.trim() : null;
  return out;
}

export async function salvarEtapaJornadaAction(
  id: string,
  campos: Partial<CamposDaEtapa>
): Promise<Result> {
  const supabase = await createClient();
  const dados = limpar(campos);
  if (!Object.keys(dados).length) return { ok: true };
  // O RLS garante que só o dono da etapa (ou o admin da loja) altera.
  const { error } = await supabase.from("pipeline_stages").update(dados).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/jornada");
  revalidatePath("/leads");
  return { ok: true };
}

export async function criarEtapaJornadaAction(
  campos: Partial<CamposDaEtapa> & { name: string },
  targetUserId?: string | null
): Promise<Result> {
  const supabase = await createClient();
  const perfil = await getCachedProfile();
  if (!perfil) return { ok: false, error: "Não autenticado" };
  const instanceId = await getCurrentInstanceId();
  if (!instanceId) return { ok: false, error: "Usuário sem loja vinculada" };

  // Admin pode montar a jornada de outro vendedor; vendedor só a própria.
  const dono = perfil.role === "admin" ? (targetUserId ?? null) : perfil.id;

  let q = supabase
    .from("pipeline_stages")
    .select("position")
    .eq("instance_id", instanceId)
    .order("position", { ascending: false })
    .limit(1);
  q = dono === null ? q.is("user_id", null) : q.eq("user_id", dono);
  const { data: ultima } = await q;
  const position = (ultima?.[0]?.position ?? 0) + 1;

  const { error } = await supabase.from("pipeline_stages").insert({
    instance_id: instanceId,
    user_id: dono,
    position,
    color: "#3b82f6",
    ...limpar(campos),
    name: campos.name.trim(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/jornada");
  revalidatePath("/leads");
  return { ok: true };
}

export async function excluirEtapaJornadaAction(id: string): Promise<Result> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", id);
  if ((count ?? 0) > 0)
    return { ok: false, error: `Есta etapa tem ${count} lead(s). Mova-os antes de excluir.` };
  const { error } = await supabase.from("pipeline_stages").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/jornada");
  revalidatePath("/leads");
  return { ok: true };
}

/** Salva pixel/conjunto de dados e token da loja (Meta Conversions API). */
export async function salvarPixelAction(cfg: {
  dataset_id: string;
  access_token: string;
  event_name?: string;
  test_event_code?: string;
}): Promise<Result> {
  const perfil = await getCachedProfile();
  if (perfil?.role !== "admin") return { ok: false, error: "Só o administrador pode alterar" };
  const instanceId = await getCurrentInstanceId();
  if (!instanceId) return { ok: false, error: "Usuário sem loja vinculada" };
  if (!cfg.dataset_id.trim() || !cfg.access_token.trim())
    return { ok: false, error: "Informe o conjunto de dados e o token" };

  const supabase = await createClient();
  const valor = {
    dataset_id: cfg.dataset_id.trim(),
    access_token: cfg.access_token.trim(),
    event_name: cfg.event_name?.trim() || "Lead",
    lead_event_source: "CRM",
    ...(cfg.test_event_code?.trim() ? { test_event_code: cfg.test_event_code.trim() } : {}),
  };
  const { error } = await supabase.from("settings").upsert(
    {
      instance_id: instanceId,
      key: "meta_capi",
      value: valor as unknown as Json,
      updated_by: perfil.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "instance_id,key" }
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/jornada/pixel");
  return { ok: true };
}
