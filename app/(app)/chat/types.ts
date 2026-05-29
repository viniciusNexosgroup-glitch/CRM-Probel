import type { Database } from "@/types/database";

/**
 * Colunas de `messages` enviadas pro cliente — TODAS exceto `raw_payload`.
 * O `raw_payload` é um blob de debug (chega a 47KB/linha) que o front nunca usa;
 * mantê-lo fora dos selects corta ~90% do tráfego de mensagens (banda/lentidão).
 */
export const MESSAGE_COLUMNS =
  "id, conversation_id, instance_id, evolution_message_id, remote_jid, from_me, sender_jid, message_type, content, media_url, media_mimetype, media_filename, media_size, media_caption, thumbnail_url, duration, reply_to_id, status, timestamp, created_at";

export type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
export type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
export type TagRow = Database["public"]["Tables"]["tags"]["Row"];
export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
export type PipelineStageRow = Database["public"]["Tables"]["pipeline_stages"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type AssigneeProfile = Pick<ProfileRow, "id" | "full_name" | "email" | "avatar_url">;

export type InternalNoteRow = Database["public"]["Tables"]["internal_notes"]["Row"];
export type InternalNoteWithAuthor = InternalNoteRow & {
  author: AssigneeProfile | null;
};

/**
 * Conversa com dados do contato + tags do lead (pro inbox e filtros).
 * `leads` vem como objeto único (não array) por causa do unique(contact_id) na tabela leads.
 */
export type ConversationWithContact = ConversationRow & {
  contact: Pick<
    ContactRow,
    | "id"
    | "name"
    | "push_name"
    | "phone"
    | "profile_pic_url"
    | "is_group"
    | "is_favorite"
    | "whatsapp_id"
    | "presence_status"
    | "presence_updated_at"
  > & {
    leads: {
      id: string;
      lead_tags: { tag: TagRow }[];
    } | null;
  };
  assigned_user: AssigneeProfile | null;
};

export type LeadActivityRow = Database["public"]["Tables"]["lead_activity"]["Row"] & {
  user: Pick<ProfileRow, "full_name" | "email"> | null;
};

/** Dados do painel direito */
export type ContactPanelData = {
  contact: ContactRow;
  lead: (LeadRow & { lead_tags: { tag: TagRow }[] }) | null;
  tasks: TaskRow[];
  allTags: TagRow[];
  allStages: PipelineStageRow[];
  activity: LeadActivityRow[];
};
