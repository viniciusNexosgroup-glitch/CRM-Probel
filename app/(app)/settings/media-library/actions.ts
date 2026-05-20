"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { EXTERNAL_PREFIX } from "./lib";

type FileType = Database["public"]["Tables"]["media_library"]["Row"]["file_type"];
type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

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

export type UpdateMediaPayload = {
  title?: string;
  description?: string | null;
  category_id?: string | null;
  file_type?: FileType;
};

export async function updateMediaAction(
  mediaId: string,
  payload: UpdateMediaPayload
): Promise<Result> {
  const supabase = await createClient();
  const updates: Database["public"]["Tables"]["media_library"]["Update"] = {};
  if (payload.title !== undefined) updates.title = payload.title.trim();
  if (payload.description !== undefined)
    updates.description = payload.description?.trim() || null;
  if (payload.category_id !== undefined) updates.category_id = payload.category_id;
  if (payload.file_type !== undefined) updates.file_type = payload.file_type;

  const { error } = await supabase.from("media_library").update(updates).eq("id", mediaId);
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
