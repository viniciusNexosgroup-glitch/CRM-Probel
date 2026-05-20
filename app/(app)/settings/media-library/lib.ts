/**
 * Constantes e helpers puros da biblioteca de mídias.
 * Separado de actions.ts porque arquivos "use server" só podem exportar funções async.
 */

/** Marker em file_path pra identificar mídia hospedada externamente (sem upload no Supabase Storage) */
export const EXTERNAL_PREFIX = "external://";

/**
 * Detecta URL do Google Drive e converte pra formato de download direto que
 * bypassa o aviso de scan de vírus (`confirm=t` no novo subdomínio).
 */
export function normalizeExternalUrl(url: string): string {
  const driveMatch =
    url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/) ||
    url.match(/drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/) ||
    url.match(/drive\.google\.com\/uc\?export=[^&]*&id=([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    // Subdomínio drive.usercontent.google.com + confirm=t serve arquivos
    // grandes sem o HTML de aviso de vírus
    return `https://drive.usercontent.google.com/download?id=${driveMatch[1]}&export=download&authuser=0&confirm=t`;
  }
  if (url.includes("dropbox.com") && url.includes("dl=0")) {
    return url.replace("dl=0", "dl=1");
  }
  return url;
}

/** Mimetype padrão sugerido pelo tipo da mídia (quando URL externa não fornece). */
export function defaultMimeType(fileType: "image" | "video" | "audio" | "document"): string {
  switch (fileType) {
    case "image":
      return "image/jpeg";
    case "video":
      return "video/mp4";
    case "audio":
      return "audio/mpeg";
    case "document":
      return "application/pdf";
  }
}

/** Gera filename com extensão pra WhatsApp reconhecer o tipo. */
export function suggestedFileName(title: string, fileType: "image" | "video" | "audio" | "document"): string {
  const ext = {
    image: "jpg",
    video: "mp4",
    audio: "mp3",
    document: "pdf",
  }[fileType];
  const safe = title.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60) || "media";
  // Se já termina com extensão, mantém
  if (/\.[a-z0-9]{2,4}$/i.test(safe)) return safe;
  return `${safe}.${ext}`;
}
