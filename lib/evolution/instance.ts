import { createServiceClient } from "@/lib/supabase/server";
import { evolution, evolutionFor } from "./client";

/**
 * Descobre qual WhatsApp (instância da Evolution) usar para falar numa conversa.
 *
 * Com mais de uma loja no CRM, enviar pela instância errada entregaria a
 * mensagem pelo número da outra empresa. Toda conversa, contato e mensagem
 * carrega `instance_id`, então é ele que manda — nunca a variável de ambiente.
 */
const nomePorId = new Map<string, string>();

export async function instanceNameFor(
  instanceId: string | null | undefined
): Promise<string | null> {
  if (!instanceId) return null;
  const emCache = nomePorId.get(instanceId);
  if (emCache) return emCache;

  const svc = createServiceClient();
  const { data } = await svc
    .from("whatsapp_instances")
    .select("instance_name")
    .eq("id", instanceId)
    .maybeSingle();

  const nome = data?.instance_name ?? null;
  if (nome) nomePorId.set(instanceId, nome);
  return nome;
}

/**
 * Operações da Evolution já apontadas para a loja daquela conversa.
 * Sem `instance_id` (dados antigos), cai na instância do .env.
 */
export async function evoFor(instanceId: string | null | undefined) {
  const nome = await instanceNameFor(instanceId);
  return nome ? evolutionFor(nome) : evolution;
}
