/**
 * Tipos do payload de webhook da Evolution API v2.3.7.
 * Cobre os eventos que o CRM processa.
 */
export type WebhookEvent =
  | "messages.upsert"
  | "messages.update"
  | "messages.delete"
  | "connection.update"
  | "qrcode.updated"
  | "contacts.upsert"
  | "contacts.update"
  | "chats.upsert"
  | "chats.update"
  | "chats.delete"
  | "presence.update"
  | "send.message"
  | "application.startup";

export interface WebhookPayloadBase {
  event: WebhookEvent | string;
  instance: string;
  destination?: string;
  date_time?: string;
  sender?: string;
  server_url?: string;
  apikey?: string;
}

export interface WhatsAppMessageKey {
  id: string;
  remoteJid: string;
  fromMe: boolean;
  participant?: string;
}

export interface WhatsAppMessageContent {
  conversation?: string;
  extendedTextMessage?: { text: string };
  imageMessage?: { url?: string; caption?: string; mimetype?: string; fileLength?: number };
  videoMessage?: {
    url?: string;
    caption?: string;
    mimetype?: string;
    fileLength?: number;
    seconds?: number;
  };
  audioMessage?: { url?: string; mimetype?: string; seconds?: number; ptt?: boolean };
  documentMessage?: {
    url?: string;
    mimetype?: string;
    fileName?: string;
    title?: string;
    fileLength?: number;
  };
  stickerMessage?: { url?: string; mimetype?: string };
  contactMessage?: unknown;
  locationMessage?: unknown;
  reactionMessage?: { text: string; key: WhatsAppMessageKey };
}

export interface MessagesUpsertData {
  key: WhatsAppMessageKey;
  pushName?: string;
  message: WhatsAppMessageContent | null;
  messageType: string;
  messageTimestamp: number;
  instanceId: string;
  source?: string;
}

export interface MessagesUpdateData {
  keyId: string;
  remoteJid: string;
  fromMe?: boolean;
  status?: "DELIVERY_ACK" | "READ" | "PLAYED" | "PENDING" | "SERVER_ACK" | "ERROR";
}

export interface ConnectionUpdateData {
  instance: string;
  state: "open" | "close" | "connecting";
  statusReason?: number;
}

export interface ContactsUpsertData {
  remoteJid: string;
  pushName?: string;
  profilePicUrl?: string;
  instanceId: string;
}

export type WebhookPayload =
  | (WebhookPayloadBase & { event: "messages.upsert"; data: MessagesUpsertData })
  | (WebhookPayloadBase & { event: "messages.update"; data: MessagesUpdateData })
  | (WebhookPayloadBase & { event: "connection.update"; data: ConnectionUpdateData })
  | (WebhookPayloadBase & {
      event: "contacts.upsert" | "contacts.update";
      data: ContactsUpsertData | ContactsUpsertData[];
    })
  | (WebhookPayloadBase & { event: string; data: unknown });
