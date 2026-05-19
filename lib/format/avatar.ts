/**
 * Helpers pra fallback de avatar quando não tem foto.
 */
export function getInitials(name?: string | null): string {
  if (!name) return "?";
  const cleaned = name.trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const palette = [
  "bg-pink-700",
  "bg-rose-700",
  "bg-red-700",
  "bg-orange-700",
  "bg-amber-700",
  "bg-yellow-700",
  "bg-lime-700",
  "bg-green-700",
  "bg-emerald-700",
  "bg-teal-700",
  "bg-cyan-700",
  "bg-sky-700",
  "bg-blue-700",
  "bg-indigo-700",
  "bg-violet-700",
  "bg-purple-700",
  "bg-fuchsia-700",
];

/** Cor de fundo determinística baseada no JID/nome */
export function getAvatarColor(seed?: string | null): string {
  if (!seed) return palette[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

/** Formata telefone brasileiro padrão E.164 sem o +55 */
export function formatPhone(phone?: string | null): string {
  if (!phone) return "";
  const onlyDigits = phone.replace(/\D/g, "");
  if (onlyDigits.startsWith("55") && onlyDigits.length >= 12) {
    const ddd = onlyDigits.slice(2, 4);
    const rest = onlyDigits.slice(4);
    if (rest.length === 9) return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    if (rest.length === 8) return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  return `+${onlyDigits}`;
}
