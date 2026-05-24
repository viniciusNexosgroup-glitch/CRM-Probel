/**
 * Formata o status de presença do contato pra exibir no header da conversa.
 * Aplica TTL: se o evento for muito antigo, retorna null (não mostra).
 */
export function formatPresence(
  status: string | null,
  updatedAt: string | null
): string | null {
  if (!status || !updatedAt) return null;
  const age = Date.now() - new Date(updatedAt).getTime();

  // TTLs por tipo de presença
  if (status === "composing") {
    if (age > 30_000) return null;
    return "digitando…";
  }
  if (status === "recording") {
    if (age > 30_000) return null;
    return "gravando áudio…";
  }
  if (status === "available") {
    if (age > 90_000) return null;
    return "online";
  }
  // 'paused' / 'unavailable' / outros → não mostra
  return null;
}
