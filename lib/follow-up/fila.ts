/**
 * Envio dos follow-ups que venceram. Chamado a cada minuto pela rotina
 * /api/cron/follow-up.
 *
 * Em cada chamada, cada loja manda NO MÁXIMO uma mensagem, e só se:
 *   * estiver dentro da janela de envio da loja;
 *   * não tiver batido o teto do dia;
 *   * já tiver passado o intervalo sorteado desde a última (follow_up_ritmo).
 * O resultado é um pingar espaçado e irregular, como o de uma pessoa -- nunca
 * uma rajada, mesmo com dezenas de follow-ups vencendo juntos.
 *
 * Usa a chave de serviço: roda sem usuário, e cada consulta filtra pela loja.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { evoFor } from "@/lib/evolution/instance";
import {
  dentroDaJanela,
  inicioDoDia,
  montarMensagem,
  normalizarFollowUp,
  primeiroNome,
  proximoVencimento,
  sortear,
  sortearEntre,
  tempoDigitandoMs,
  type FollowUpConfig,
} from "./regras";

type Db = ReturnType<typeof createServiceClient>;

type FollowUpDaFila = {
  id: string;
  instance_id: string;
  conversation_id: string;
  etapa: number;
  iniciado_em: string;
  tentativas: number;
};

/** Depois de 3 falhas seguidas do WhatsApp, o follow-up desiste. */
const MAX_TENTATIVAS = 3;

export async function carregarConfigFollowUp(db: Db, instanceId: string): Promise<FollowUpConfig> {
  const { data } = await db
    .from("settings")
    .select("value")
    .eq("instance_id", instanceId)
    .eq("key", "follow_up")
    .maybeSingle();
  return normalizarFollowUp(data?.value);
}

export async function processarFilaFollowUp(agora: Date = new Date()) {
  const db = createServiceClient();
  const { data: vencidos, error } = await db
    .from("follow_ups")
    .select("instance_id")
    .eq("status", "ativo")
    .lte("proximo_em", agora.toISOString())
    .limit(1000);
  if (error) return { ok: false as const, error: error.message };

  const lojas = [...new Set((vencidos ?? []).map((v) => v.instance_id))];
  const porLoja: Record<string, string> = {};
  for (const loja of lojas) {
    try {
      porLoja[loja] = await processarLoja(db, loja, agora);
    } catch (e) {
      porLoja[loja] = `erro: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return { ok: true as const, porLoja };
}

async function processarLoja(db: Db, loja: string, agora: Date): Promise<string> {
  const cfg = await carregarConfigFollowUp(db, loja);
  if (cfg.pausado) return "pausado";
  if (!dentroDaJanela(cfg, agora)) return "fora da janela";

  const { count: enviadosHoje } = await db
    .from("follow_up_envios")
    .select("id", { count: "exact", head: true })
    .eq("instance_id", loja)
    .is("erro", null)
    .gte("enviado_em", inicioDoDia(cfg.timezone, agora).toISOString());
  if ((enviadosHoje ?? 0) >= cfg.limiteDiario) return "teto do dia";

  // Reserva a vez da loja. O UPDATE só pega a linha se o intervalo já passou,
  // então duas execuções simultâneas não mandam duas mensagens.
  await db
    .from("follow_up_ritmo")
    .upsert({ instance_id: loja }, { onConflict: "instance_id", ignoreDuplicates: true });
  const espera = sortearEntre(cfg.intervaloMinMin, cfg.intervaloMaxMin) * 60_000;
  const { data: vez } = await db
    .from("follow_up_ritmo")
    .update({ proximo_envio_em: new Date(agora.getTime() + espera).toISOString() })
    .eq("instance_id", loja)
    .lte("proximo_envio_em", agora.toISOString())
    .select("instance_id");
  if (!vez?.length) return "aguardando intervalo";

  // Quem respondeu ou não tem mais como receber sai da fila sem gastar a vez.
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const { data: candidato } = await db
      .from("follow_ups")
      .select("id, instance_id, conversation_id, etapa, iniciado_em, tentativas")
      .eq("instance_id", loja)
      .eq("status", "ativo")
      .lte("proximo_em", agora.toISOString())
      .order("proximo_em", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!candidato) return "fila vazia";

    // Tira da fila por 15 minutos enquanto trata. Se o processo cair no meio,
    // ele volta sozinho; se outra execução já pegou, este passa adiante.
    const { data: pego } = await db
      .from("follow_ups")
      .update({ proximo_em: new Date(agora.getTime() + 15 * 60_000).toISOString() })
      .eq("id", candidato.id)
      .eq("status", "ativo")
      .lte("proximo_em", agora.toISOString())
      .select("id");
    if (!pego?.length) continue;

    const r = await enviarEtapa(db, cfg, candidato);
    if (r !== "pulado") return r;
  }
  return "nada enviado";
}

async function encerrar(db: Db, id: string, status: "respondeu" | "cancelado" | "concluido", erro?: string) {
  await db
    .from("follow_ups")
    .update({ status, encerrado_em: new Date().toISOString(), proximo_em: null, ...(erro ? { erro } : {}) })
    .eq("id", id);
}

async function enviarEtapa(
  db: Db,
  cfg: FollowUpConfig,
  fu: FollowUpDaFila
): Promise<"enviado" | "falhou" | "pulado"> {
  const { data: conv } = await db
    .from("conversations")
    .select("remote_jid, contact_id")
    .eq("id", fu.conversation_id)
    .maybeSingle();
  if (!conv || conv.remote_jid.endsWith("@g.us")) {
    await encerrar(db, fu.id, "cancelado", "conversa indisponível");
    return "pulado";
  }

  // O aviso de resposta vem pelo webhook; esta é a conferência final, caso ele
  // tenha se perdido. Mensagem a quem já respondeu seria a pior falha possível.
  const { data: resposta } = await db
    .from("messages")
    .select("id")
    .eq("conversation_id", fu.conversation_id)
    .eq("from_me", false)
    .gt("timestamp", fu.iniciado_em)
    .limit(1);
  if (resposta?.length) {
    await encerrar(db, fu.id, "respondeu");
    return "pulado";
  }

  const etapaCfg = cfg.etapas[fu.etapa];
  if (!etapaCfg) {
    await encerrar(db, fu.id, "concluido");
    return "pulado";
  }

  const { data: contato } = await db
    .from("contacts")
    .select("name, push_name")
    .eq("id", conv.contact_id)
    .maybeSingle();
  const texto = montarMensagem(
    sortear(etapaCfg.mensagens),
    primeiroNome(contato?.name, contato?.push_name)
  );
  const numeroDaEtapa = fu.etapa + 1;

  try {
    const r = await (await evoFor(fu.instance_id)).sendText(conv.remote_jid, texto, undefined, {
      delay: tempoDigitandoMs(texto),
    });
    const enviadoEm = new Date();
    const enviadoIso = enviadoEm.toISOString();

    await db.from("messages").upsert(
      {
        conversation_id: fu.conversation_id,
        instance_id: fu.instance_id,
        evolution_message_id: r.key.id,
        remote_jid: conv.remote_jid,
        from_me: true,
        message_type: "text",
        content: texto,
        status: "sent",
        timestamp: enviadoIso,
      },
      { onConflict: "instance_id,evolution_message_id", ignoreDuplicates: true }
    );
    await db
      .from("conversations")
      .update({ last_message_text: texto, last_message_at: enviadoIso, last_message_from_me: true })
      .eq("id", fu.conversation_id);
    await db.from("follow_up_envios").insert({
      follow_up_id: fu.id,
      instance_id: fu.instance_id,
      etapa: numeroDaEtapa,
      texto,
      evolution_message_id: r.key.id,
    });

    const proxima = cfg.etapas[numeroDaEtapa];
    await db
      .from("follow_ups")
      .update(
        proxima
          ? {
              etapa: numeroDaEtapa,
              tentativas: 0,
              erro: null,
              // Encadeado: conta a partir DESTE envio, não de quando ligou.
              proximo_em: proximoVencimento(enviadoEm, proxima.horas).toISOString(),
            }
          : {
              etapa: numeroDaEtapa,
              tentativas: 0,
              erro: null,
              status: "concluido",
              encerrado_em: enviadoIso,
              proximo_em: null,
            }
      )
      .eq("id", fu.id);
    return "enviado";
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    await db.from("follow_up_envios").insert({
      follow_up_id: fu.id,
      instance_id: fu.instance_id,
      etapa: numeroDaEtapa,
      texto,
      erro,
    });
    const tentativas = fu.tentativas + 1;
    await db
      .from("follow_ups")
      .update(
        tentativas >= MAX_TENTATIVAS
          ? { status: "falhou", tentativas, erro, encerrado_em: new Date().toISOString(), proximo_em: null }
          : { tentativas, erro, proximo_em: new Date(Date.now() + 30 * 60_000).toISOString() }
      )
      .eq("id", fu.id);
    return "falhou";
  }
}
