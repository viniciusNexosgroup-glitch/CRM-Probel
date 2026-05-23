"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { evolution, EvolutionError } from "@/lib/evolution/client";

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Marca conversa como lida no CRM E no WhatsApp do celular.
 *
 * Fluxo:
 *   1. Lê a conversa (precisa do remote_jid e unread_count)
 *   2. Se tem mensagens não lidas, busca últimas 50 recebidas com id da Evolution
 *   3. Chama Evolution markAsRead → dispara o read receipt (visto) no celular
 *   4. Zera unread_count localmente
 *
 * Falha na Evolution não bloqueia o local (best-effort).
 */
export async function markAsReadAction(conversationId: string) {
  const supabase = await createClient();

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, remote_jid, unread_count")
    .eq("id", conversationId)
    .single();
  if (!conv) return { ok: false, error: "Conversa não encontrada" };

  if (conv.unread_count > 0) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("evolution_message_id, remote_jid")
      .eq("conversation_id", conversationId)
      .eq("from_me", false)
      .not("evolution_message_id", "is", null)
      .order("timestamp", { ascending: false })
      .limit(50);

    const keys = (msgs ?? [])
      .filter((m) => m.evolution_message_id)
      .map((m) => ({
        remoteJid: m.remote_jid,
        fromMe: false,
        id: m.evolution_message_id as string,
      }));

    if (keys.length > 0) {
      try {
        await evolution.markAsRead(keys);
      } catch (e) {
        console.warn(
          "[markAsRead] Evolution falhou (continuando local):",
          e instanceof Error ? e.message : e
        );
      }
    }
  }

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
  text: string,
  replyToMessageId?: string | null
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

  // Se é reply, busca a mensagem referenciada pra montar o quoted
  let quoted: Parameters<typeof evolution.sendText>[2] | undefined;
  if (replyToMessageId) {
    const { data: ref } = await supabase
      .from("messages")
      .select("evolution_message_id, remote_jid, from_me, content, message_type, media_caption")
      .eq("id", replyToMessageId)
      .single();
    if (ref?.evolution_message_id) {
      const refText =
        ref.content ??
        ref.media_caption ??
        (ref.message_type === "image"
          ? "📷 Imagem"
          : ref.message_type === "video"
            ? "🎥 Vídeo"
            : ref.message_type === "audio"
              ? "🎵 Áudio"
              : ref.message_type === "document"
                ? "📄 Documento"
                : "Mensagem");
      quoted = {
        id: ref.evolution_message_id,
        remoteJid: ref.remote_jid,
        fromMe: ref.from_me,
        content: refText,
      };
    }
  }

  let sent;
  try {
    sent = await evolution.sendText(conv.remote_jid, trimmed, quoted);
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
    reply_to_id: replyToMessageId ?? null,
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

// ============================================================
// Favoritar / Fixar / Arquivar conversas
// ============================================================

export async function toggleFavoriteAction(
  contactId: string,
  value: boolean
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({ is_favorite: value })
    .eq("id", contactId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

export async function togglePinnedAction(
  conversationId: string,
  value: boolean
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("conversations")
    .update({ is_pinned: value })
    .eq("id", conversationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

export async function toggleArchivedAction(
  conversationId: string,
  value: boolean
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("conversations")
    .update({ is_archived: value })
    .eq("id", conversationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

export async function assignConversationAction(
  conversationId: string,
  userId: string | null
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("conversations")
    .update({ assigned_to: userId })
    .eq("id", conversationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

export async function assignToMeAction(conversationId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };
  return assignConversationAction(conversationId, user.id);
}

export async function deleteTaskAction(taskId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

// ============================================================
// Internal notes (notas privadas entre atendentes)
// ============================================================

export async function createInternalNoteAction(
  conversationId: string,
  content: string
): Promise<Result> {
  const text = content.trim();
  if (!text) return { ok: false, error: "Nota vazia" };
  if (text.length > 4096) return { ok: false, error: "Nota muito longa" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { error } = await supabase.from("internal_notes").insert({
    conversation_id: conversationId,
    author_id: user.id,
    content: text,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

export async function deleteInternalNoteAction(noteId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("internal_notes").delete().eq("id", noteId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

// ============================================================
// Iniciar nova conversa (mandar pra um numero que ainda nao existe)
// ============================================================

function normalizeBrazilianPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  // Remove zero a esquerda
  digits = digits.replace(/^0+/, "");
  // Se não começou com 55, adiciona
  if (!digits.startsWith("55")) {
    if (digits.length === 10 || digits.length === 11) {
      digits = "55" + digits;
    } else {
      return null;
    }
  }
  // Após 55: DDD (2) + número (8 fixo OU 9 celular). Total: 12 ou 13
  if (digits.length !== 12 && digits.length !== 13) return null;
  return digits;
}

export async function startConversationAction(
  rawPhone: string,
  message: string
): Promise<Result<{ conversationId: string }>> {
  const phone = normalizeBrazilianPhone(rawPhone);
  if (!phone) {
    return {
      ok: false,
      error: "Telefone inválido. Use formato (DDD) 9 XXXX-XXXX",
    };
  }
  const text = message.trim();
  if (!text) return { ok: false, error: "Mensagem vazia" };
  if (text.length > 4096) return { ok: false, error: "Mensagem muito longa" };

  const remoteJid = `${phone}@s.whatsapp.net`;

  // Envia via Evolution
  let sent;
  try {
    sent = await evolution.sendText(remoteJid, text);
  } catch (e) {
    if (e instanceof EvolutionError) {
      if (e.status === 400 || e.status === 404) {
        return { ok: false, error: "Número não existe no WhatsApp ou não é válido." };
      }
      return { ok: false, error: e.message };
    }
    return { ok: false, error: (e as Error).message };
  }

  // Cria contato + conversa + mensagem idempotentes (o webhook MESSAGES_UPSERT
  // vai upsert depois também, mas fazendo aqui já temos algo pra navegar)
  const service = createServiceClient();
  const { data: instance } = await service
    .from("whatsapp_instances")
    .select("id")
    .eq("instance_name", process.env.EVOLUTION_INSTANCE_NAME ?? "")
    .single();
  if (!instance) return { ok: false, error: "Instância não encontrada no banco" };

  const { data: contact, error: contactErr } = await service
    .from("contacts")
    .upsert(
      {
        instance_id: instance.id,
        whatsapp_id: remoteJid,
        phone,
        is_group: false,
      },
      { onConflict: "instance_id,whatsapp_id" }
    )
    .select("id")
    .single();
  if (contactErr || !contact) {
    return { ok: false, error: contactErr?.message ?? "Falha ao criar contato" };
  }

  const now = new Date().toISOString();
  const { data: conv, error: convErr } = await service
    .from("conversations")
    .upsert(
      {
        instance_id: instance.id,
        contact_id: contact.id,
        remote_jid: remoteJid,
        last_message_text: text,
        last_message_at: now,
        last_message_from_me: true,
      },
      { onConflict: "instance_id,remote_jid" }
    )
    .select("id")
    .single();
  if (convErr || !conv) {
    return { ok: false, error: convErr?.message ?? "Falha ao criar conversa" };
  }

  await service.from("messages").insert({
    conversation_id: conv.id,
    instance_id: instance.id,
    evolution_message_id: sent.key.id,
    remote_jid: remoteJid,
    from_me: true,
    message_type: "text",
    content: text,
    status: "sent",
    timestamp: now,
  });

  // Cria lead automaticamente pra essa conversa também
  const { data: existingLead } = await service
    .from("leads")
    .select("id")
    .eq("contact_id", contact.id)
    .maybeSingle();
  if (!existingLead) {
    const { data: stage } = await service
      .from("pipeline_stages")
      .select("id")
      .order("position", { ascending: true })
      .limit(1)
      .single();
    if (stage) {
      await service.from("leads").insert({
        contact_id: contact.id,
        conversation_id: conv.id,
        stage_id: stage.id,
        phone,
        source: "outbound", // inicializada por nós
        status: "open",
        last_contact_at: now,
      });
    }
  }

  revalidatePath("/chat");
  return { ok: true, data: { conversationId: conv.id } };
}

// ============================================================
// Audio message (gravar áudio do browser e enviar como PTT)
// ============================================================

/**
 * Envia um áudio que foi previamente upado pro Supabase Storage.
 * `audioPath` é o caminho dentro do bucket `contact-media`.
 */
export async function sendAudioMessageAction(
  conversationId: string,
  audioPath: string,
  durationSeconds: number
): Promise<{ ok: true } | { ok: false; error: string }> {
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

  const { data: publicData } = supabase.storage
    .from("contact-media")
    .getPublicUrl(audioPath);
  const audioUrl = publicData.publicUrl;
  if (!audioUrl) return { ok: false, error: "Falha ao obter URL do áudio" };

  let sent;
  try {
    sent = await evolution.sendAudio(conv.remote_jid, audioUrl);
  } catch (e) {
    if (e instanceof EvolutionError) return { ok: false, error: e.message };
    return { ok: false, error: (e as Error).message };
  }

  const service = createServiceClient();
  const now = new Date().toISOString();

  await service.from("messages").insert({
    conversation_id: conv.id,
    instance_id: conv.instance_id,
    evolution_message_id: sent.key.id,
    remote_jid: conv.remote_jid,
    from_me: true,
    message_type: "audio",
    content: null,
    media_url: audioUrl,
    media_mimetype: "audio/ogg",
    media_filename: audioPath.split("/").pop() ?? null,
    duration: durationSeconds,
    status: "sent",
    timestamp: now,
  });

  await service
    .from("conversations")
    .update({
      last_message_text: `🎵 Áudio (${durationSeconds}s)`,
      last_message_at: now,
      last_message_from_me: true,
      unread_count: 0,
    })
    .eq("id", conv.id);

  revalidatePath("/chat");
  return { ok: true };
}

// ============================================================
// Media library send (Etapa 13)
// ============================================================

import type { EvolutionMediaType } from "@/lib/evolution/types";
import { defaultMimeType, suggestedFileName, EXTERNAL_PREFIX } from "@/app/(app)/settings/media-library/lib";

/** Mapeia file_type do banco pro mediatype da Evolution */
function evolutionMediaType(fileType: string): EvolutionMediaType {
  if (fileType === "image") return "image";
  if (fileType === "video") return "video";
  return "document";
}

/** Extrai filename "humano" de uma path do Supabase Storage (remove timestamp+uuid). */
function cleanSupabaseFileName(path: string): string {
  const tail = path.split("/").pop() ?? path;
  return tail.replace(/^\d{10,}-[a-f0-9]{4,}-/, "");
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

  // Mimetype: usa o salvo, senão default pelo file_type
  const mimetype = media.mimetype ?? defaultMimeType(media.file_type);

  // FileName: pra Supabase upload usa o nome original; pra URL externa, gera com extensão
  const isExternal = media.file_path.startsWith(EXTERNAL_PREFIX);
  const fileName = isExternal
    ? suggestedFileName(media.title, media.file_type)
    : cleanSupabaseFileName(media.file_path);

  let sent;
  try {
    sent = await evolution.sendMedia(conv.remote_jid, {
      mediatype,
      media: media.file_url,
      mimetype,
      caption: captionText,
      fileName,
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
