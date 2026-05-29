"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

export async function createTagAction(name: string, color: string): Promise<Result> {
  if (!name.trim()) return { ok: false, error: "Nome obrigatório" };
  const supabase = await createClient();
  const { error } = await supabase.from("tags").insert({ name: name.trim(), color });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/tags");
  revalidatePath("/chat");
  return { ok: true };
}

export async function updateTagAction(id: string, name: string, color: string): Promise<Result> {
  if (!name.trim()) return { ok: false, error: "Nome obrigatório" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("tags")
    .update({ name: name.trim(), color })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/tags");
  revalidatePath("/chat");
  return { ok: true };
}

export async function deleteTagAction(id: string): Promise<Result> {
  const supabase = await createClient();
  // remove os vínculos primeiro (caso o FK não seja cascade)
  await supabase.from("lead_tags").delete().eq("tag_id", id);
  const { error } = await supabase.from("tags").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/tags");
  revalidatePath("/chat");
  return { ok: true };
}
