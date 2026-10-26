"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { carregarConfigFollowUp } from "@/lib/follow-up/fila";
import { proximoVencimento } from "@/lib/follow-up/regras";

type Resultado = { ok: true } | { ok: false; error: string };

/**
 * Liga o follow-up numa conversa. Só a conversa a conversa, pelo vendedor --
 * não existe "ligar para todos": é o que mantém o número longe de cara de
 * disparo em massa.
 *
 * A permissão vem da regra da conversa: se o vendedor não enxerga a conversa
 * com o próprio login, não liga nada nela.
 */
export async function ativarFollowUpAction(conversationId: string): Promise<Resultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, instance_id, remote_jid, contact_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return { ok: false, error: "Conversa não encontrada" };
  if (conv.remote_jid.endsWith("@g.us")) {
    return { ok: false, error: "Follow-up não funciona em grupo" };
  }

  const service = createServiceClient();
  const cfg = await carregarConfigFollowUp(service, conv.instance_id);
  if (cfg.pausado) {
    return { ok: false, error: "O follow-up está pausado nas configurações da loja." };
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("contact_id", conv.contact_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const agora = new Date();
  const { error } = await service.from("follow_ups").insert({
    instance_id: conv.instance_id,
    conversation_id: conv.id,
    lead_id: lead?.id ?? null,
    iniciado_por: user.id,
    iniciado_em: agora.toISOString(),
    proximo_em: proximoVencimento(agora, cfg.etapas[0].horas).toISOString(),
  });
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "Esta conversa já tem um follow-up ativo." : error.message,
    };
  }
  return { ok: true };
}

export async function cancelarFollowUpAction(conversationId: string): Promise<Resultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  // Lido com o login do vendedor: a regra só devolve se ele enxerga a conversa.
  const { data: fu } = await supabase
    .from("follow_ups")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("status", "ativo")
    .maybeSingle();
  if (!fu) return { ok: false, error: "Nenhum follow-up ativo nesta conversa." };

  const { error } = await createServiceClient()
    .from("follow_ups")
    .update({
      status: "cancelado",
      encerrado_por: user.id,
      encerrado_em: new Date().toISOString(),
      proximo_em: null,
    })
    .eq("id", fu.id)
    .eq("status", "ativo");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
