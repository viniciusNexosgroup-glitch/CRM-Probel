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

/**
 * Cartões carregados por coluna de cada vez.
 *
 * O quadro trazia todos os leads e desenhava todos. Na Probel, com 1.516 leads
 * só em "Novo Lead", isso era 3,3 MB e 1,9 s -- e o PostgREST cortava em 1.000,
 * escondendo os demais sem aviso. Um lote por coluna mostra o que cabe na tela
 * com folga; o cabeçalho mostra o total real, e o resto vem em "carregar mais".
 */
export const LOTE_KANBAN = 50;

/** O mesmo recorte de lead que os cartões usam, em todo carregamento. */
export const SELECT_LEAD_CARTAO = `
  *,
  contact:contacts!leads_contact_id_fkey (
    id, name, push_name, phone, profile_pic_url, whatsapp_id
  )
`;

/** Total real de leads e valor de uma coluna (calculados no banco). */
export type TotaisColuna = { total: number; valor: number };
