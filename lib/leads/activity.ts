/**
 * Helpers de histórico de lead + follow-up pós-venda.
 * Funções puras async (não server actions) — chamadas de dentro de server actions.
 * Usam service client (bypass RLS).
 */
import { createServiceClient } from "@/lib/supabase/server";

export type LeadActivityType =
  | "created"
  | "stage_changed"
  | "assigned"
  | "won"
  | "lost"
  | "value_changed"
  | "reopened";

export async function logLeadActivity(
  leadId: string,
  type: LeadActivityType,
  description: string,
  userId?: string | null
) {
  const supabase = createServiceClient();
  await supabase.from("lead_activity").insert({
    lead_id: leadId,
    type,
    description,
    user_id: userId ?? null,
  });
}

const POST_SALE_TITLE = "Pós-venda: perguntar se gostou do produto 🛏️";

/**
 * Cria tarefa de follow-up pós-venda 7 dias após o fechamento.
 * Idempotente: não cria se já existe uma tarefa de pós-venda pendente pro lead.
 */
export async function createPostSaleFollowup(leadId: string, userId?: string | null) {
  const supabase = createServiceClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("contact_id")
    .eq("id", leadId)
    .single();
  if (!lead) return;

  // Já tem tarefa de pós-venda pendente?
  const { data: existing } = await supabase
    .from("tasks")
    .select("id")
    .eq("lead_id", leadId)
    .eq("title", POST_SALE_TITLE)
    .eq("completed", false)
    .maybeSingle();
  if (existing) return;

  const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("tasks").insert({
    lead_id: leadId,
    contact_id: lead.contact_id,
    title: POST_SALE_TITLE,
    description: "Follow-up automático 7 dias após o fechamento da venda.",
    due_at: dueAt,
    created_by: userId ?? null,
  });
}

/**
 * Detecta mudança de stage e registra atividades apropriadas.
 * Chamar APÓS atualizar o lead no banco.
 */
export async function handleLeadStageTransition(params: {
  leadId: string;
  oldStageId: string | null;
  newStageId: string;
  newStatus: "open" | "won" | "lost";
  oldStatus: "open" | "won" | "lost";
  newStageName: string;
  userId?: string | null;
}) {
  const { leadId, oldStageId, newStageId, newStatus, oldStatus, newStageName, userId } = params;
  if (oldStageId === newStageId) return;

  await logLeadActivity(leadId, "stage_changed", `Movido para "${newStageName}"`, userId);

  if (newStatus === "won" && oldStatus !== "won") {
    await logLeadActivity(leadId, "won", "Lead ganho 🎉", userId);
    await createPostSaleFollowup(leadId, userId);
  } else if (newStatus === "lost" && oldStatus !== "lost") {
    await logLeadActivity(leadId, "lost", "Lead perdido", userId);
  } else if (newStatus === "open" && oldStatus !== "open") {
    await logLeadActivity(leadId, "reopened", "Lead reaberto", userId);
  }
}
