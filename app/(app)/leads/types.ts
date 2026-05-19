import type { Database } from "@/types/database";

export type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
export type PipelineStageRow = Database["public"]["Tables"]["pipeline_stages"]["Row"];
export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];

export type LeadWithContact = LeadRow & {
  contact: Pick<ContactRow, "id" | "name" | "push_name" | "phone" | "profile_pic_url" | "whatsapp_id"> | null;
};

export const LEAD_SOURCES = [
  { value: "meta_ads", label: "Meta Ads" },
  { value: "google_ads", label: "Google Ads" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "site", label: "Site" },
  { value: "whatsapp", label: "WhatsApp direto" },
  { value: "indicacao", label: "Indicação" },
  { value: "outros", label: "Outros" },
] as const;
