"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type FileType = Database["public"]["Tables"]["media_library"]["Row"]["file_type"];
type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

/** Marker em file_path pra identificar mídia hospedada externamente (sem upload no Supabase Storage) */
export const EXTERNAL_PREFIX = "external://";

export type CreateMediaPayload = {
  title: string;
  description: string | null;
  category_id: string | null;
  file_url: string;
  file_path: string;
  file_type: FileType;
  mimetype: string | null;
  file_size: number | null;
};

/**
 * Detecta URL do Google Drive e converte pra formato de download direto.
 * - https://drive.google.com/file/d/FILEID/view?...
 *   → https://drive.google.com/uc?export=download&id=FILEID
 * - https://drive.google.com/open?id=FILEID
 *   → https://drive.google.com/uc?export=download&id=FILEID
 */
export function normalizeExternalUrl(url: string): string {
  const driveMatch =
    url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/) ||
    url.match(/drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
  }
  // Dropbox compartilhamento: ?dl=0 → ?dl=1 (direct download)
  if (url.includes("dropbox.com") && url.includes("dl=0")) {
    return url.replace("dl=0", "dl=1");
  }
  return url;
}

export async function createMediaAction(payload: CreateMediaPayload): Promise<Result> {
  if (!payload.title.trim()) return { ok: false, error: "Título é obrigatório" };
  if (!payload.file_url) {
    return { ok: false, error: "Informe a URL ou faça upload do arquivo" };
  }
  if (!payload.file_path) {
    return { ok: false, error: "Caminho do arquivo inválido" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("media_library").insert({
    title: payload.title.trim(),
    description: payload.description?.trim() || null,
    category_id: payload.category_id,
    file_url: payload.file_url,
    file_path: payload.file_path,
    file_type: payload.file_type,
    mimetype: payload.mimetype,
    file_size: payload.file_size,
    uploaded_by: user?.id ?? null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/media-library");
  revalidatePath("/chat");
  return { ok: true };
}

export async function deleteMediaAction(mediaId: string): Promise<Result> {
  const supabase = await createClient();

  const { data: media } = await supabase
    .from("media_library")
    .select("file_path")
    .eq("id", mediaId)
    .single();

  // Só apaga do Storage se for arquivo hospedado lá (não-externo)
  if (media?.file_path && !media.file_path.startsWith(EXTERNAL_PREFIX)) {
    await supabase.storage.from("media-library").remove([media.file_path]);
  }

  const { error } = await supabase.from("media_library").delete().eq("id", mediaId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/media-library");
  revalidatePath("/chat");
  return { ok: true };
}
