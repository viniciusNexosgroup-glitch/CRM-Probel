import type { Database } from "@/types/database";

export type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

/** Conversa com dados do contato embutidos pro inbox */
export type ConversationWithContact = ConversationRow & {
  contact: Pick<ContactRow, "id" | "name" | "push_name" | "phone" | "profile_pic_url" | "is_group" | "whatsapp_id">;
};
