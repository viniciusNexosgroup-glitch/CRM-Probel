import { createServiceClient } from "@/lib/supabase/server";

/**
 * Tempo médio de resposta, calculado uma vez por dia em vez de a cada abertura
 * do Dashboard.
 *
 * O cálculo precisa percorrer as mensagens dos últimos 30 dias para parear
 * "cliente falou → loja respondeu". Fazer isso a cada acesso custava ~400ms só
 * para buscar os dados, mais o processamento — e o número praticamente não muda
 * de uma hora para outra. Agora a rotina diária calcula e guarda; a tela só lê.
 */
const CHAVE = "tempo_resposta_cache";

export type TempoRespostaCache = {
  minutos: number | null;
  calculado_em: string;
  amostra: number;
};

/** Lê o valor já calculado da loja. Null quando ainda não houve cálculo. */
export async function lerTempoResposta(instanceId: string): Promise<number | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("settings")
    .select("value")
    .eq("instance_id", instanceId)
    .eq("key", CHAVE)
    .maybeSingle();
  const v = data?.value as TempoRespostaCache | null;
  return v?.minutos ?? null;
}

/**
 * Recalcula e guarda, para todas as lojas. Chamado pela rotina diária.
 *
 * A regra é a mesma de antes: dentro de cada conversa, mede da PRIMEIRA
 * mensagem do cliente num bloco até a primeira resposta da loja; respostas
 * seguintes no mesmo bloco não contam.
 */
export async function recalcularTempoResposta(): Promise<
  Array<{ loja: string; minutos: number | null; amostra: number }>
> {
  const svc = createServiceClient();
  const trintaDias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: lojas } = await svc.from("whatsapp_instances").select("id, label, instance_name");
  const resultado: Array<{ loja: string; minutos: number | null; amostra: number }> = [];

  for (const loja of lojas ?? []) {
    const { data: msgs } = await svc
      .from("messages")
      .select("conversation_id, from_me, timestamp")
      .eq("instance_id", loja.id)
      .gte("timestamp", trintaDias)
      .order("conversation_id", { ascending: true })
      .order("timestamp", { ascending: true })
      .limit(20000);

    let somaMs = 0;
    let pares = 0;
    if (msgs?.length) {
      const porConversa = new Map<string, typeof msgs>();
      for (const m of msgs) {
        const lista = porConversa.get(m.conversation_id) ?? [];
        lista.push(m);
        porConversa.set(m.conversation_id, lista);
      }
      for (const lista of porConversa.values()) {
        let esperandoDesde: string | null = null;
        for (const m of lista) {
          if (!m.from_me) {
            if (esperandoDesde === null) esperandoDesde = m.timestamp;
          } else if (esperandoDesde) {
            somaMs += new Date(m.timestamp).getTime() - new Date(esperandoDesde).getTime();
            pares += 1;
            esperandoDesde = null;
          }
        }
      }
    }

    const minutos = pares > 0 ? Math.round(somaMs / pares / 60000) : null;
    const valor: TempoRespostaCache = {
      minutos,
      calculado_em: new Date().toISOString(),
      amostra: pares,
    };
    await svc.from("settings").upsert(
      {
        instance_id: loja.id,
        key: CHAVE,
        value: valor as unknown as never,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "instance_id,key" }
    );
    resultado.push({ loja: loja.label ?? loja.instance_name, minutos, amostra: pares });
  }

  return resultado;
}
