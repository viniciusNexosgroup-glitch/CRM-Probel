/**
 * Helpers de formatação de data/hora para o inbox.
 * Padrão visual igual ao WhatsApp Web.
 */

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
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** "HOJE", "ONTEM", "segunda-feira" ou "12/05/2026" */
export function formatDateSeparator(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  const now = new Date();
  if (isSameDay(d, now)) return "HOJE";
  if (isYesterday(d)) return "ONTEM";
  if (isWithinWeek(d))
    return d.toLocaleDateString("pt-BR", { weekday: "long" }).toUpperCase();
  return d.toLocaleDateString("pt-BR");
}

/** Para a sidebar: "14:32" se hoje, "Ontem", weekday ou data curta */
export function formatRelativeTime(input: string | Date | null) {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  const now = new Date();
  if (isSameDay(d, now)) return formatTime(d);
  if (isYesterday(d)) return "Ontem";
  if (isWithinWeek(d))
    return d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
