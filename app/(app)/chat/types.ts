import type { Database } from "@/types/database";

export type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
export type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
export type TagRow = Database["public"]["Tables"]["tags"]["Row"];
export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
export type PipelineStageRow = Database["public"]["Tables"]["pipeline_stages"]["Row"];

/** Conversa com dados do contato embutidos pro inbox */
export type ConversationWithContact = ConversationRow & {
  contact: Pick<ContactRow, "id" | "name" | "push_name" | "phone" | "profile_pic_url" | "is_group" | "whatsapp_id">;
};

/** Dados do painel direito */
export type ContactPanelData = {
  contact: ContactRow;
  lead: (LeadRow & { lead_tags: { tag: TagRow }[] }) | null;
  tasks: TaskRow[];
  allTags: TagRow[];
  allStages: PipelineStageRow[];
};
