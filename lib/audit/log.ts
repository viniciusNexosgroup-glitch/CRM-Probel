import { createServiceClient } from "@/lib/supabase/server";

export type AuditAction =
  | "team_invite"
  | "team_remove"
  | "team_role_change"
  | "conversation_assign"
  | "lead_stage_change"
  | "lead_won"
  | "lead_lost";

/**
 * Registra uma ação no audit_log (best-effort, nunca quebra o fluxo).
 * Inserção via service client; leitura é só admin (RLS).
 */
export async function logAudit(params: {
  actorId: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  summary?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    const svc = createServiceClient();
    await svc.from("audit_log").insert({
      actor_id: params.actorId,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      summary: params.summary ?? null,
      meta: (params.meta ?? null) as never,
    });
  } catch (e) {
    console.warn("[audit] falhou:", e instanceof Error ? e.message : e);
  }
}
