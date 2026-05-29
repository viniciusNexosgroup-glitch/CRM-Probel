// Fontes de lead customizáveis (#25). Módulo client-safe: sem imports de servidor.
// A lista fica em settings.key = 'lead_sources' (array de {value,label}).
// Se não houver, cai nos defaults.

export type LeadSource = { value: string; label: string };

export const DEFAULT_LEAD_SOURCES: LeadSource[] = [
  { value: "meta_ads", label: "Meta Ads" },
  { value: "google_ads", label: "Google Ads" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "site", label: "Site" },
  { value: "whatsapp", label: "WhatsApp direto" },
  { value: "indicacao", label: "Indicação" },
  { value: "outros", label: "Outros" },
];

export function parseLeadSources(value: unknown): LeadSource[] {
  if (Array.isArray(value)) {
    const list = value.filter(
      (v): v is LeadSource =>
        !!v &&
        typeof (v as LeadSource).value === "string" &&
        typeof (v as LeadSource).label === "string"
    );
    if (list.length > 0) return list;
  }
  return DEFAULT_LEAD_SOURCES;
}

/** Mapa value→label, mesclando defaults + customizadas (custom têm prioridade). */
export function sourceLabelMap(sources: LeadSource[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const s of DEFAULT_LEAD_SOURCES) map[s.value] = s.label;
  for (const s of sources) map[s.value] = s.label;
  map["sem origem"] = "Sem origem";
  return map;
}

/** Gera um value (slug) a partir de um label digitado. */
export function slugifySource(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
