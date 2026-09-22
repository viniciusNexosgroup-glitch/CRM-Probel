import { createServiceClient } from "@/lib/supabase/server";
import { sendCtwaConversion } from "./capi";

/**
 * Dispara no Meta Ads o evento configurado na etapa do funil.
 *
 * A ideia (mesmo modelo de ferramentas como o Tintim): conforme a conversa
 * avança no WhatsApp — fez contato, pediu orçamento, visitou a loja, comprou —
 * cada etapa manda o evento correspondente, para a campanha otimizar por quem
 * realmente avança, e não só por quem manda a primeira mensagem.
 *
 * Só dispara se: a etapa tem evento configurado, o lead veio de anúncio
 * (tem ctwa_clid) e aquele evento ainda não foi enviado para este lead/etapa.
 */
export async function fireStageEvent(
  leadId: string,
  stageId: string
): Promise<{ sent: boolean; motivo?: string }> {
  const svc = createServiceClient();

  const { data: stage } = await svc
    .from("pipeline_stages")
    .select("id, name, meta_event_name, is_sale, default_value")
    .eq("id", stageId)
    .maybeSingle();
  if (!stage?.meta_event_name) return { sent: false, motivo: "etapa sem evento configurado" };

  const { data: lead } = await svc
    .from("leads")
    .select("id, instance_id, ctwa_clid, phone, estimated_value, closed_value")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return { sent: false, motivo: "lead não encontrado" };
  // Com clique de anúncio o Meta credita a conversão à campanha; sem ele, o
  // telefone ainda serve para reconhecer a pessoa e alimentar o público.
  if (!lead.ctwa_clid && !lead.phone)
    return { sent: false, motivo: "lead sem clique de anúncio e sem telefone" };

  // Já mandamos este evento para este lead nesta etapa? O lead pode ir e voltar
  // no funil, e o Meta não deve contar a mesma conversão duas vezes.
  const { data: jaEnviado } = await svc
    .from("lead_stage_events")
    .select("id")
    .eq("lead_id", leadId)
    .eq("stage_id", stageId)
    .eq("event_name", stage.meta_event_name)
    .maybeSingle();
  if (jaEnviado) return { sent: false, motivo: "evento já enviado antes" };

  // Valor só faz sentido em etapa de venda: usa o fechado, senão o estimado,
  // senão o valor padrão da etapa.
  const valor = stage.is_sale
    ? (lead.closed_value ?? lead.estimated_value ?? stage.default_value ?? null)
    : null;

  const r = await sendCtwaConversion({
    instanceId: lead.instance_id,
    ctwaClid: lead.ctwa_clid,
    eventName: stage.meta_event_name,
    phone: lead.phone,
    eventId: `${stage.meta_event_name}_${leadId}_${stageId}`,
    value: valor != null ? Number(valor) : null,
  });

  await svc.from("lead_stage_events").insert({
    lead_id: leadId,
    stage_id: stageId,
    event_name: stage.meta_event_name,
    dataset_id: r.datasetId ?? null,
    ok: r.ok,
    detail: r.ok ? null : (r.error ?? "falha no envio"),
  });

  if (!r.ok) {
    console.error("[meta] falha ao enviar evento da etapa", stage.name, r.error);
    return { sent: false, motivo: r.error ?? "falha no envio" };
  }
  return { sent: true };
}

/**
 * Procura uma etapa cuja palavra-chave apareça na mensagem que o atendente
 * acabou de enviar. Usado para mover a conversa sozinha (ex.: ao mandar
 * "Segue orçamento", o lead vai para a etapa "Fez Orçamento").
 */
export async function findStageByKeyword(
  instanceId: string,
  ownerId: string | null,
  texto: string
): Promise<{ id: string; name: string } | null> {
  const limpo = texto.trim().toLowerCase();
  if (limpo.length < 3) return null;

  const svc = createServiceClient();
  let q = svc
    .from("pipeline_stages")
    .select("id, name, keyword, user_id")
    .eq("instance_id", instanceId)
    .not("keyword", "is", null);
  // O funil é por vendedor: procura no board do dono do lead.
  q = ownerId ? q.eq("user_id", ownerId) : q.is("user_id", null);

  const { data: stages } = await q;
  for (const s of (stages ?? []) as Array<{ id: string; name: string; keyword: string | null }>) {
    const k = s.keyword?.trim().toLowerCase();
    if (k && k.length >= 3 && limpo.includes(k)) return { id: s.id, name: s.name };
  }
  return null;
}
