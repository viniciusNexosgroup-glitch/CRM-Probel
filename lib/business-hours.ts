/**
 * Configuração do horário comercial e auto-resposta fora do horário.
 * Persistido em public.settings (keys: business_hours e auto_reply_outside_hours).
 */

export type BusinessHoursConfig = {
  enabled: boolean;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  days: number[]; // 0=Domingo … 6=Sábado
  timezone: string; // ex: "America/Sao_Paulo"
};

export type AutoReplyConfig = {
  enabled: boolean;
  message: string; // suporta {primeiro_nome}, {nome}, {telefone}
};

export const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  enabled: false,
  start: "09:00",
  end: "18:00",
  days: [1, 2, 3, 4, 5], // seg-sex
  timezone: "America/Sao_Paulo",
};

export const DEFAULT_AUTO_REPLY: AutoReplyConfig = {
  enabled: false,
  message:
    "Olá {primeiro_nome}! Recebemos sua mensagem fora do horário comercial. Retornaremos assim que abrirmos. 😊",
};

export const WEEKDAYS = [
  { v: 0, label: "Dom" },
  { v: 1, label: "Seg" },
  { v: 2, label: "Ter" },
  { v: 3, label: "Qua" },
  { v: 4, label: "Qui" },
  { v: 5, label: "Sex" },
  { v: 6, label: "Sáb" },
] as const;

/**
 * Diz se o horário atual está dentro do horário comercial configurado.
 * Respeita o timezone do config.
 */
export function isWithinBusinessHours(
  config: BusinessHoursConfig,
  now: Date = new Date()
): boolean {
  if (!config.enabled) return true; // desabilitado = sempre considera dentro

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: config.timezone || "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hour12: false,
    }).formatToParts(now);

    const weekdayShort = parts.find((p) => p.type === "weekday")?.value ?? "";
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);

    const weekdayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    const weekday = weekdayMap[weekdayShort];
    if (typeof weekday !== "number") return true;
    if (!config.days.includes(weekday)) return false;

    const currentMinutes = hour * 60 + minute;
    const [startH, startM] = config.start.split(":").map((n) => parseInt(n, 10));
    const [endH, endM] = config.end.split(":").map((n) => parseInt(n, 10));
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } catch {
    // Em caso de timezone inválido, considera dentro (não bloqueia)
    return true;
  }
}
