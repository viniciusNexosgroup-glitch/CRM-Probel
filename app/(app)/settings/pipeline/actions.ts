"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

export async function createStageAction(
  name: string,
  color: string
): Promise<Result> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("pipeline_stages")
    .select("position")
    .order("position", { ascending: false })
    .limit(1);
  const nextPos = (existing?.[0]?.position ?? 0) + 1;
  const { error } = await supabase
    .from("pipeline_stages")
    .insert({ name: name.trim(), color, position: nextPos });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/pipeline");
  revalidatePath("/leads");
  return { ok: true };
}

export async function updateStageAction(
  id: string,
  updates: { name?: string; color?: string; is_won?: boolean; is_lost?: boolean }
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pipeline_stages")
    .update(updates)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/pipeline");
  revalidatePath("/leads");
  return { ok: true };
}

export async function deleteStageAction(id: string): Promise<Result> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", id);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Esse estágio tem ${count} leads. Mova-os antes de excluir.`,
    };
  }

  const { error } = await supabase.from("pipeline_stages").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/pipeline");
  revalidatePath("/leads");
  return { ok: true };
}

export async function reorderStagesAction(orderedIds: string[]): Promise<Result> {
  const supabase = await createClient();
  // Move tudo pra positions negativas primeiro pra contornar o unique constraint
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("pipeline_stages")
      .update({ position: -(i + 1) })
      .eq("id", orderedIds[i]);
    if (error) return { ok: false, error: error.message };
  }
  // Agora coloca nas posições finais
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("pipeline_stages")
      .update({ position: i + 1 })
      .eq("id", orderedIds[i]);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/settings/pipeline");
  revalidatePath("/leads");
  return { ok: true };
}
