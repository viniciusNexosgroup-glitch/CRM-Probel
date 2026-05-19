"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { evolution, EvolutionError } from "@/lib/evolution/client";

export async function markAsReadAction(conversationId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("conversations")
    .update({ unread_count: 0 })
    .eq("id", conversationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

/**
 * Envia mensagem de texto pela Evolution e persiste no Supabase.
 *
 * Fluxo:
 *   1. Valida auth + busca conversa
 *   2. Chama Evolution /message/sendText
 *   3. Insere row em messages com o id retornado pela Evolution
 *   4. Atualiza preview da conversa
 *
 * Webhook MESSAGES_UPDATE atualiza o status (sent → delivered → read).
 */
export async function sendTextMessageAction(
  conversationId: string,
  text: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Mensagem vazia" };
  if (trimmed.length > 4096) return { ok: false, error: "Mensagem muito longa (max 4096)" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .select("id, instance_id, remote_jid")
    .eq("id", conversationId)
    .single();
  if (convErr || !conv) return { ok: false, error: "Conversa não encontrada" };

  let sent;
  try {
    sent = await evolution.sendText(conv.remote_jid, trimmed);
  } catch (e) {
    if (e instanceof EvolutionError) return { ok: false, error: e.message };
    return { ok: false, error: (e as Error).message };
  }

  const service = createServiceClient();
  const now = new Date().toISOString();

  const { error: insertErr } = await service.from("messages").insert({
    conversation_id: conv.id,
    instance_id: conv.instance_id,
    evolution_message_id: sent.key.id,
    remote_jid: conv.remote_jid,
    from_me: true,
    message_type: "text",
    content: trimmed,
    status: "sent",
    timestamp: now,
  });

  // Se Evolution mandou mas DB falhou, o webhook MESSAGES_UPSERT vai inserir depois.
  // Logamos e seguimos.
  if (insertErr) {
    console.warn("[sendText] Evolution ok mas insert falhou:", insertErr.message);
  }

  await service
    .from("conversations")
    .update({
      last_message_text: trimmed,
      last_message_at: now,
      last_message_from_me: true,
    })
    .eq("id", conv.id);

  revalidatePath("/chat");
  return { ok: true };
}
