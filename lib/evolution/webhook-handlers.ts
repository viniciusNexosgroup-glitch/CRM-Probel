/**
 * Processadores de cada tipo de evento do webhook da Evolution API.
 * Usam o cliente service-role do Supabase (bypass RLS) — esta lib só roda
 * dentro da route handler do webhook.
 */
import { createServiceClient } from "@/lib/supabase/server";
import type { Json, MessageType } from "@/types/database";
import { mapEvolutionStateToDb } from "@/lib/evolution/client";
import {
  isWithinBusinessHours,
  DEFAULT_BUSINESS_HOURS,
  type BusinessHoursConfig,
  type AutoReplyConfig,
} from "@/lib/business-hours";
import { resolveTemplate } from "@/lib/format/template";
import { runSalesbotForMessage } from "@/lib/salesbot/engine";
import type {
  MessagesUpsertData,
  MessagesUpdateData,
  ConnectionUpdateData,
  ContactsUpsertData,
  WhatsAppMessageContent,
} from "./webhook-types";

function jidToPhone(jid: string): string | null {
  const match = jid.match(/^(\d+)@/);
  return match?.[1] ?? null;
}

function isGroupJid(jid: string): boolean {
  return jid.endsWith("@g.us");
}

function extractMessageContent(msg: WhatsAppMessageContent | null): {
  type: MessageType;
  content: string | null;
  mediaUrl: string | null;
  mediaMimetype: string | null;
  mediaFilename: string | null;
  mediaSize: number | null;
  mediaCaption: string | null;
  duration: number | null;
} {
  const base = {
    type: "unknown" as MessageType,
    content: null as string | null,
    mediaUrl: null as string | null,
    mediaMimetype: null as string | null,
    mediaFilename: null as string | null,
    mediaSize: null as number | null,
    mediaCaption: null as string | null,
    duration: null as number | null,
  };
  if (!msg) return base;

  if (msg.conversation) return { ...base, type: "text", content: msg.conversation };
  if (msg.extendedTextMessage?.text)
    return { ...base, type: "text", content: msg.extendedTextMessage.text };

  if (msg.imageMessage) {
    return {
      ...base,
      type: "image",
      content: msg.imageMessage.caption ?? null,
      mediaUrl: msg.imageMessage.url ?? null,
      mediaMimetype: msg.imageMessage.mimetype ?? null,
      mediaSize: msg.imageMessage.fileLength ?? null,
      mediaCaption: msg.imageMessage.caption ?? null,
    };
  }
  if (msg.videoMessage) {
    return {
      ...base,
      type: "video",
      content: msg.videoMessage.caption ?? null,
      mediaUrl: msg.videoMessage.url ?? null,
      mediaMimetype: msg.videoMessage.mimetype ?? null,
      mediaSize: msg.videoMessage.fileLength ?? null,
      mediaCaption: msg.videoMessage.caption ?? null,
      duration: msg.videoMessage.seconds ?? null,
    };
  }
  if (msg.audioMessage) {
    return {
      ...base,
      type: "audio",
      mediaUrl: msg.audioMessage.url ?? null,
      mediaMimetype: msg.audioMessage.mimetype ?? null,
      duration: msg.audioMessage.seconds ?? null,
    };
  }
  if (msg.documentMessage) {
    return {
      ...base,
      type: "document",
      mediaUrl: msg.documentMessage.url ?? null,
      mediaMimetype: msg.documentMessage.mimetype ?? null,
      mediaFilename: msg.documentMessage.fileName ?? msg.documentMessage.title ?? null,
      mediaSize: msg.documentMessage.fileLength ?? null,
    };
  }
  if (msg.stickerMessage) {
    return {
      ...base,
      type: "sticker",
      mediaUrl: msg.stickerMessage.url ?? null,
      mediaMimetype: msg.stickerMessage.mimetype ?? null,
    };
  }
  if (msg.locationMessage) return { ...base, type: "location" };
  if (msg.contactMessage) return { ...base, type: "contact" };
  if (msg.reactionMessage)
    return { ...base, type: "reaction", content: msg.reactionMessage.text };

  return base;
}

function mapStatus(s?: string): "pending" | "sent" | "delivered" | "read" | "failed" {
  switch (s) {
    case "READ":
    case "PLAYED":
      return "read";
    case "DELIVERY_ACK":
      return "delivered";
    case "SERVER_ACK":
      return "sent";
    case "PENDING":
      return "pending";
    case "ERROR":
      return "failed";
    default:
      return "sent";
  }
}

async function getOrCreateInstance(instanceName: string) {
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("whatsapp_instances")
    .select("id")
    .eq("instance_name", instanceName)
    .single();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("whatsapp_instances")
    .insert({ instance_name: instanceName, status: "connected" })
    .select("id")
    .single();
  if (error || !created) throw new Error(`Falha ao criar instância: ${error?.message}`);
  return created.id;
}

async function getOrCreateContact(
  instanceId: string,
  remoteJid: string,
  pushName: string | null
) {
  const supabase = createServiceClient();
  const phone = jidToPhone(remoteJid);
  const isGroup = isGroupJid(remoteJid);

  const { data: existing } = await supabase
    .from("contacts")
    .select("id, name, push_name")
    .eq("instance_id", instanceId)
    .eq("whatsapp_id", remoteJid)
    .single();

  if (existing) {
    // Atualiza push_name se mudou
    if (pushName && pushName !== existing.push_name) {
      await supabase
        .from("contacts")
        .update({ push_name: pushName, last_contact_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("contacts")
        .update({ last_contact_at: new Date().toISOString() })
        .eq("id", existing.id);
    }
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("contacts")
    .insert({
      instance_id: instanceId,
      whatsapp_id: remoteJid,
      phone,
      push_name: pushName,
      name: pushName ?? phone,
      is_group: isGroup,
      last_contact_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(`Falha ao criar contato: ${error?.message}`);
  return created.id;
}

async function getOrCreateConversation(
  instanceId: string,
  contactId: string,
  remoteJid: string
) {
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("instance_id", instanceId)
    .eq("remote_jid", remoteJid)
    .single();
  if (existing) return { id: existing.id, created: false };

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      instance_id: instanceId,
      contact_id: contactId,
      remote_jid: remoteJid,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(`Falha ao criar conversa: ${error?.message}`);
  return { id: created.id, created: true };
}

async function ensureLeadForContact(contactId: string, conversationId: string) {
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("leads")
    .select("id")
    .eq("contact_id", contactId)
    .maybeSingle();
  if (existing) return existing.id;

  // Pega o primeiro stage do pipeline (Novo Lead)
  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("id")
    .order("position", { ascending: true })
    .limit(1)
    .single();
  if (!stage) return null;

  // Pega dados do contato pra preencher nome/phone do lead
  const { data: contact } = await supabase
    .from("contacts")
    .select("name, push_name, phone, is_group")
    .eq("id", contactId)
    .single();
  // Não cria lead pra grupos
  if (contact?.is_group) return null;

  const { data: created } = await supabase
    .from("leads")
    .insert({
      contact_id: contactId,
      conversation_id: conversationId,
      stage_id: stage.id,
      name: contact?.name ?? contact?.push_name ?? null,
      phone: contact?.phone ?? null,
      source: "whatsapp",
      status: "open",
      last_contact_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  return created?.id ?? null;
}

function extFromMime(mime: string | null): string {
  if (!mime) return "bin";
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "application/pdf": "pdf",
  };
  if (map[mime]) return map[mime];
  const sub = mime.split("/")[1]?.split(";")[0];
  return sub || "bin";
}

/**
 * Baixa mídia recebida da Evolution (base64) e salva no Supabase Storage,
 * depois atualiza messages.media_url com a URL permanente.
 */
async function persistIncomingMedia(
  instanceId: string,
  evolutionMessageId: string,
  type: string,
  mimetypeHint: string | null
) {
  try {
    const { evolution } = await import("@/lib/evolution/client");
    const media = await evolution.getBase64FromMedia(evolutionMessageId);
    if (!media?.base64) return;

    const mimetype = media.mimetype || mimetypeHint || "application/octet-stream";
    const ext = extFromMime(mimetype);
    const buffer = Buffer.from(media.base64, "base64");
    const path = `received/${instanceId}/${evolutionMessageId}.${ext}`;

    const supabase = createServiceClient();
    const { error: upErr } = await supabase.storage
      .from("contact-media")
      .upload(path, buffer, { contentType: mimetype, upsert: true });
    if (upErr) {
      console.warn("[persistIncomingMedia] upload falhou:", upErr.message);
      return;
    }

    const { data: pub } = supabase.storage.from("contact-media").getPublicUrl(path);
    await supabase
      .from("messages")
      .update({ media_url: pub.publicUrl, media_mimetype: mimetype })
      .eq("instance_id", instanceId)
      .eq("evolution_message_id", evolutionMessageId);
  } catch (e) {
    console.warn("[persistIncomingMedia] erro:", e instanceof Error ? e.message : e);
  }
}

export async function handleMessagesUpsert(instanceName: string, data: MessagesUpsertData) {
  const instanceId = await getOrCreateInstance(instanceName);
  const contactId = await getOrCreateContact(
    instanceId,
    data.key.remoteJid,
    data.pushName ?? null
  );
  const conversation = await getOrCreateConversation(instanceId, contactId, data.key.remoteJid);
  const conversationId = conversation.id;

  // Cria lead automaticamente em "Novo Lead" se ainda não houver
  const leadId = await ensureLeadForContact(contactId, conversationId);

  const extracted = extractMessageContent(data.message);
  const timestamp = new Date(data.messageTimestamp * 1000).toISOString();
  const supabase = createServiceClient();

  // Insert da mensagem (idempotente via unique constraint instance_id + evolution_message_id)
  const { error: msgErr } = await supabase.from("messages").upsert(
    {
      conversation_id: conversationId,
      instance_id: instanceId,
      evolution_message_id: data.key.id,
      remote_jid: data.key.remoteJid,
      from_me: data.key.fromMe,
      sender_jid: data.key.participant ?? null,
      message_type: extracted.type,
      content: extracted.content,
      media_url: extracted.mediaUrl,
      media_mimetype: extracted.mediaMimetype,
      media_filename: extracted.mediaFilename,
      media_size: extracted.mediaSize,
      media_caption: extracted.mediaCaption,
      duration: extracted.duration,
      status: data.key.fromMe ? "sent" : "delivered",
      timestamp,
      raw_payload: data as unknown as Json,
    },
    { onConflict: "instance_id,evolution_message_id" }
  );

  if (msgErr) {
    console.error("[webhook] Falha ao inserir mensagem:", msgErr);
    throw new Error(msgErr.message);
  }

  // Mídia recebida (não from_me): baixa da Evolution e salva no Storage
  // (a URL .enc do WhatsApp não é acessível). Best-effort.
  const MEDIA_TYPES = ["image", "video", "audio", "document", "sticker"];
  if (!data.key.fromMe && MEDIA_TYPES.includes(extracted.type) && data.key.id) {
    await persistIncomingMedia(instanceId, data.key.id, extracted.type, extracted.mediaMimetype);
  }

  // Atualiza preview + unread_count na conversa
  const preview =
    extracted.content ??
    (extracted.type === "image"
      ? "📷 Imagem"
      : extracted.type === "video"
        ? "🎥 Vídeo"
        : extracted.type === "audio"
          ? "🎵 Áudio"
          : extracted.type === "document"
            ? "📄 Documento"
            : extracted.type === "sticker"
              ? "Figurinha"
              : "Mensagem");

  // Mensagem do cliente → incrementa unread
  // Mensagem da loja (de qualquer lugar: CRM, celular, etc) → zera unread
  // (faz sentido: se a loja respondeu, ela viu)
  if (!data.key.fromMe) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("unread_count")
      .eq("id", conversationId)
      .single();
    await supabase
      .from("conversations")
      .update({
        unread_count: (conv?.unread_count ?? 0) + 1,
        last_message_text: preview,
        last_message_at: timestamp,
        last_message_from_me: false,
      })
      .eq("id", conversationId);
  } else {
    // Loja enviou — zera unread + atualiza preview
    await supabase
      .from("conversations")
      .update({
        unread_count: 0,
        last_message_text: preview,
        last_message_at: timestamp,
        last_message_from_me: true,
      })
      .eq("id", conversationId);
  }

  // Auto-resposta fora do horário comercial (apenas pra mensagens recebidas, não-grupo)
  if (!data.key.fromMe && !isGroupJid(data.key.remoteJid)) {
    let salesbotHandled = false;
    try {
      const salesbotResult = await runSalesbotForMessage({
        event: conversation.created ? "new_conversation" : "new_message",
        instanceId,
        conversationId,
        contactId,
        leadId,
        remoteJid: data.key.remoteJid,
        messageText: extracted.content,
        evolutionMessageId: data.key.id,
      });
      salesbotHandled = salesbotResult.responseSent || salesbotResult.handoff;
    } catch (e) {
      console.warn("[salesbot] falhou:", e instanceof Error ? e.message : e);
    }

    if (!salesbotHandled) {
      await maybeSendAutoReply(instanceName, conversationId, data.key.remoteJid, data.pushName ?? null);
    }
  }
}

async function maybeSendAutoReply(
  instanceName: string,
  conversationId: string,
  remoteJid: string,
  pushName: string | null
) {
  try {
    const supabase = createServiceClient();

    // Busca configs
    const { data: settingsRows } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["business_hours", "auto_reply_outside_hours"]);

    const map = new Map(settingsRows?.map((r) => [r.key, r.value]) ?? []);
    const hoursConfig = map.get("business_hours") as Partial<BusinessHoursConfig> | undefined;
    const replyConfig = map.get("auto_reply_outside_hours") as Partial<AutoReplyConfig> | undefined;

    if (!hoursConfig?.enabled || !replyConfig?.enabled) return;
    if (!replyConfig.message?.trim()) return;

    const merged: BusinessHoursConfig = { ...DEFAULT_BUSINESS_HOURS, ...hoursConfig };
    if (isWithinBusinessHours(merged)) return; // dentro do horário, não responde

    // Anti-spam: só auto-responde se não respondeu nas últimas 12h
    const { data: conv } = await supabase
      .from("conversations")
      .select("auto_replied_at, contact_id")
      .eq("id", conversationId)
      .single();
    if (conv?.auto_replied_at) {
      const lastReply = new Date(conv.auto_replied_at).getTime();
      if (Date.now() - lastReply < 12 * 60 * 60 * 1000) return;
    }

    // Busca o contato pra resolver variáveis
    const { data: contact } = conv?.contact_id
      ? await supabase
          .from("contacts")
          .select("name, push_name, phone")
          .eq("id", conv.contact_id)
          .single()
      : { data: null };

    const resolvedMessage = resolveTemplate(replyConfig.message, {
      contactName: contact?.name ?? null,
      pushName: contact?.push_name ?? pushName,
      phone: contact?.phone ?? null,
    });

    // Envia via Evolution
    const { evolution } = await import("@/lib/evolution/client");
    const sent = await evolution.sendText(remoteJid, resolvedMessage);

    // Registra a auto-resposta na conversa + insere a msg no histórico
    const now = new Date().toISOString();
    await supabase
      .from("conversations")
      .update({
        auto_replied_at: now,
        last_message_text: resolvedMessage,
        last_message_at: now,
        last_message_from_me: true,
      })
      .eq("id", conversationId);

    const { data: convFull } = await supabase
      .from("conversations")
      .select("instance_id")
      .eq("id", conversationId)
      .single();

    if (convFull) {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        instance_id: convFull.instance_id,
        evolution_message_id: sent.key.id,
        remote_jid: remoteJid,
        from_me: true,
        message_type: "text",
        content: resolvedMessage,
        status: "sent",
        timestamp: now,
      });
    }

    console.log(`[auto-reply] enviado pra ${remoteJid}`);
  } catch (e) {
    console.warn("[auto-reply] falhou:", e instanceof Error ? e.message : e);
  }
}

export async function handleMessagesUpdate(instanceName: string, data: MessagesUpdateData) {
  const supabase = createServiceClient();
  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("id")
    .eq("instance_name", instanceName)
    .single();
  if (!instance) return;

  const newStatus = mapStatus(data.status);

  // Atualiza status da mensagem e busca a conversa pra eventual recount de unread
  const { data: updated } = await supabase
    .from("messages")
    .update({ status: newStatus })
    .eq("instance_id", instance.id)
    .eq("evolution_message_id", data.keyId)
    .select("conversation_id, from_me")
    .maybeSingle();

  // Se essa mensagem é RECEBIDA (from_me=false) e virou 'read' → loja leu
  // (no celular ou outro device). Recomputa unread_count da conversa.
  if (updated && !updated.from_me && newStatus === "read") {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", updated.conversation_id)
      .eq("from_me", false)
      .neq("status", "read");

    await supabase
      .from("conversations")
      .update({ unread_count: count ?? 0 })
      .eq("id", updated.conversation_id);
  }
}

/**
 * Quando o usuário lê uma conversa no celular (ou via outro device),
 * o WhatsApp/Evolution dispara `chats.update` com unreadCount: 0.
 * Sincronizamos o nosso banco pra refletir no CRM também (sumir o badge).
 */
type ChatUpdateData = {
  remoteJid?: string;
  unreadCount?: number;
  unreadMessages?: number;
  pinned?: boolean | string | null;
  muteEndTime?: number | string | null;
  archived?: boolean;
};

export async function handleChatsUpdate(
  instanceName: string,
  data: ChatUpdateData | ChatUpdateData[]
) {
  const supabase = createServiceClient();
  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("id")
    .eq("instance_name", instanceName)
    .single();
  if (!instance) return;

  const list = Array.isArray(data) ? data : [data];

  for (const chat of list) {
    if (!chat.remoteJid) continue;

    const updates: { unread_count?: number; is_archived?: boolean } = {};

    // Algumas versões da Evolution mandam unreadCount, outras unreadMessages
    const unread = chat.unreadCount ?? chat.unreadMessages;
    if (typeof unread === "number") {
      // Se a última msg foi NOSSA (last_message_from_me=true), ignora valor > 0
      // (Evolution às vezes manda stale data — não queremos badge se a loja respondeu)
      const { data: conv } = await supabase
        .from("conversations")
        .select("last_message_from_me")
        .eq("instance_id", instance.id)
        .eq("remote_jid", chat.remoteJid)
        .maybeSingle();
      if (unread > 0 && conv?.last_message_from_me) {
        // ignora — vamos manter zerado
      } else {
        updates.unread_count = Math.max(0, unread);
      }
    }
    if (typeof chat.archived === "boolean") {
      updates.is_archived = chat.archived;
    }

    if (Object.keys(updates).length === 0) continue;

    await supabase
      .from("conversations")
      .update(updates)
      .eq("instance_id", instance.id)
      .eq("remote_jid", chat.remoteJid);
  }
}

/**
 * Atualiza presença do contato (digitando, online, gravando).
 * Evolution manda `presence.update` quando o contato muda estado.
 * Salva o status + timestamp; UI usa TTL pra mostrar / esconder.
 */
type PresenceUpdateData = {
  id: string; // remoteJid
  presences: {
    [jid: string]: {
      lastKnownPresence?: string;
    };
  };
};

export async function handlePresenceUpdate(
  instanceName: string,
  data: PresenceUpdateData
) {
  const supabase = createServiceClient();
  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("id")
    .eq("instance_name", instanceName)
    .single();
  if (!instance) return;

  const now = new Date().toISOString();
  const entries = Object.entries(data.presences ?? {});
  for (const [jid, info] of entries) {
    const status = info?.lastKnownPresence ?? null;
    if (!status) continue;
    await supabase
      .from("contacts")
      .update({ presence_status: status, presence_updated_at: now })
      .eq("instance_id", instance.id)
      .eq("whatsapp_id", jid);
  }
}

export async function handleConnectionUpdate(instanceName: string, data: ConnectionUpdateData) {
  const supabase = createServiceClient();
  const status = mapEvolutionStateToDb(data.state);
  await supabase
    .from("whatsapp_instances")
    .update({
      status,
      last_connected_at: status === "connected" ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("instance_name", instanceName);
}

export async function handleContactsUpsert(
  instanceName: string,
  data: ContactsUpsertData | ContactsUpsertData[]
) {
  const supabase = createServiceClient();
  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("id")
    .eq("instance_name", instanceName)
    .single();
  if (!instance) return;

  const list = Array.isArray(data) ? data : [data];
  for (const c of list) {
    if (!c.remoteJid) continue;
    const phone = jidToPhone(c.remoteJid);
    await supabase.from("contacts").upsert(
      {
        instance_id: instance.id,
        whatsapp_id: c.remoteJid,
        phone,
        push_name: c.pushName ?? null,
        name: c.pushName ?? phone,
        profile_pic_url: c.profilePicUrl ?? null,
        is_group: isGroupJid(c.remoteJid),
      },
      { onConflict: "instance_id,whatsapp_id" }
    );
  }
}
