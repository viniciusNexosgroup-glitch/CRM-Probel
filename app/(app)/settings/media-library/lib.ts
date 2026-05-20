/**
 * Constantes e helpers puros da biblioteca de mídias.
 * Separado de actions.ts porque arquivos "use server" só podem exportar funções async.
 */

/** Marker em file_path pra identificar mídia hospedada externamente (sem upload no Supabase Storage) */
export const EXTERNAL_PREFIX = "external://";

/**
 * Detecta URL do Google Drive e converte pra formato de download direto.
 * - https://drive.google.com/file/d/FILEID/view?...
 *   → https://drive.google.com/uc?export=download&id=FILEID
 * - Dropbox ?dl=0 → ?dl=1
 */
export function normalizeExternalUrl(url: string): string {
  const driveMatch =
    url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/) ||
    url.match(/drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
  }
  if (url.includes("dropbox.com") && url.includes("dl=0")) {
    return url.replace("dl=0", "dl=1");
  }
  return url;
}
