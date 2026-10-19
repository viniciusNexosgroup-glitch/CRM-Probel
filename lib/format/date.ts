/**
 * Helpers de formatação de data/hora para o inbox.
 * Padrão visual igual ao WhatsApp Web.
 *
 * Os formatadores são criados uma vez e reaproveitados. `toLocaleDateString`
 * cria um `Intl.DateTimeFormat` novo a cada chamada, e isso é caro: medido no
 * servidor do CRM, 200 datas levavam 69 ms assim contra 0,5 ms reaproveitando
 * -- com resultado idêntico. A lista de conversas formata uma data por linha e
 * cada balão de mensagem formata a sua, no servidor e no celular do vendedor.
 */

const HORA = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const DIA_DA_SEMANA = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });
const DIA_DA_SEMANA_CURTO = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
const DATA = new Intl.DateTimeFormat("pt-BR");
const DATA_CURTA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isYesterday(d: Date) {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return isSameDay(d, y);
}

export function isWithinWeek(d: Date) {
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  return diff < 7 && diff >= 0;
}

/** Hora curta tipo "14:32" */
export function formatTime(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  return HORA.format(d);
}

/** "HOJE", "ONTEM", "segunda-feira" ou "12/05/2026" */
export function formatDateSeparator(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  const now = new Date();
  if (isSameDay(d, now)) return "HOJE";
  if (isYesterday(d)) return "ONTEM";
  if (isWithinWeek(d)) return DIA_DA_SEMANA.format(d).toUpperCase();
  return DATA.format(d);
}

/** Para a sidebar: "14:32" se hoje, "Ontem", weekday ou data curta */
export function formatRelativeTime(input: string | Date | null) {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  const now = new Date();
  if (isSameDay(d, now)) return formatTime(d);
  if (isYesterday(d)) return "Ontem";
  if (isWithinWeek(d)) return DIA_DA_SEMANA_CURTO.format(d).replace(".", "");
  return DATA_CURTA.format(d);
}
