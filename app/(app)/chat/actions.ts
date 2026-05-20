"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { evolution, EvolutionError } from "@/lib/evolution/client";

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

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

// ============================================================
// Contact panel actions (Etapa 12)
// ============================================================

export async function updateContactNameAction(
  contactId: string,
  name: string
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({ name: name.trim() || null })
    .eq("id", contactId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

export async function updateLeadNotesAction(
  leadId: string,
  notes: string
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ notes: notes || null })
    .eq("id", leadId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateLeadFieldsAction(
  leadId: string,
  fields: { stage_id?: string; source?: string | null; estimated_value?: number | null }
): Promise<Result> {
  const supabase = await createClient();
  const update: typeof fields & { status?: "open" | "won" | "lost" } = { ...fields };
  if (fields.stage_id) {
    const { data: stage } = await supabase
      .from("pipeline_stages")
      .select("is_won, is_lost")
      .eq("id", fields.stage_id)
      .single();
    update.status = stage?.is_won ? "won" : stage?.is_lost ? "lost" : "open";
  }
  const { error } = await supabase.from("leads").update(update).eq("id", leadId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

export async function addTagToLeadAction(
  leadId: string,
  tagId: string
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lead_tags")
    .upsert({ lead_id: leadId, tag_id: tagId }, { onConflict: "lead_id,tag_id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

export async function removeTagFromLeadAction(
  leadId: string,
  tagId: string
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lead_tags")
    .delete()
    .eq("lead_id", leadId)
    .eq("tag_id", tagId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

export async function createTagAction(
  name: string,
  color: string
): Promise<Result<{ id: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tags")
    .insert({ name: name.trim(), color })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Falhou" };
  return { ok: true, data: { id: data.id } };
}

export async function createTaskAction(
  leadId: string | null,
  contactId: string | null,
  title: string,
  dueAt: string | null
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("tasks").insert({
    lead_id: leadId,
    contact_id: contactId,
    title: title.trim(),
    due_at: dueAt,
    created_by: user?.id ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

export async function toggleTaskAction(
  taskId: string,
  completed: boolean
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

export async function deleteTaskAction(taskId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

// ============================================================
// Media library send (Etapa 13)
// ============================================================

import type { EvolutionMediaType } from "@/lib/evolution/types";

/** Mapeia file_type do banco pro mediatype da Evolution */
function evolutionMediaType(fileType: string): EvolutionMediaType {
  if (fileType === "image") return "image";
  if (fileType === "video") return "video";
  return "document";
}

export async function sendMediaFromLibraryAction(
  conversationId: string,
  mediaId: string,
  caption?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const [convRes, mediaRes] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, instance_id, remote_jid")
      .eq("id", conversationId)
      .single(),
    supabase.from("media_library").select("*").eq("id", mediaId).single(),
  ]);

  if (convRes.error || !convRes.data) return { ok: false, error: "Conversa não encontrada" };
  if (mediaRes.error || !mediaRes.data) return { ok: false, error: "Mídia não encontrada" };

  const conv = convRes.data;
  const media = mediaRes.data;

  // Áudios via Evolution v2 usam endpoint específico — por ora skip
  if (media.file_type === "audio") {
    return {
      ok: false,
      error: "Envio de áudio ainda não suportado por essa interface (em breve).",
    };
  }

  const mediatype = evolutionMediaType(media.file_type);
  const captionText = (caption ?? media.title)?.slice(0, 1024) || undefined;

  let sent;
  try {
    sent = await evolution.sendMedia(conv.remote_jid, {
      mediatype,
      media: media.file_url,
      mimetype: media.mimetype ?? undefined,
      caption: captionText,
      fileName: media.file_path.split("/").pop(),
    });
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
    message_type: media.file_type,
    content: captionText ?? null,
    media_url: media.file_url,
    media_mimetype: media.mimetype,
    media_filename: media.file_path.split("/").pop() ?? null,
    media_size: media.file_size,
    media_caption: captionText ?? null,
    status: "sent",
    timestamp: now,
  });
  if (insertErr) {
    console.warn("[sendMedia] Evolution ok mas insert falhou:", insertErr.message);
  }

  const preview =
    media.file_type === "image"
      ? `🖼 ${captionText ?? "Imagem"}`
      : media.file_type === "video"
        ? `🎬 ${captionText ?? "Vídeo"}`
        : `📎 ${captionText ?? media.title}`;

  await service
    .from("conversations")
    .update({
      last_message_text: preview,
      last_message_at: now,
      last_message_from_me: true,
    })
    .eq("id", conv.id);

  revalidatePath("/chat");
  return { ok: true };
}
