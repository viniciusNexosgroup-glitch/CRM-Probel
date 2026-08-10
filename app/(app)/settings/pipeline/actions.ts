"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";

type Result = { ok: true } | { ok: false; error: string };

// Resolve em qual board (dono) a coluna será criada.
// vendedor: sempre no próprio. admin: pode passar targetUserId (uuid de outro
// vendedor) ou `null` explícito (board "Sem vendedor"). undefined = próprio.
function resolveOwner(
  profileRole: "admin" | "user",
  profileId: string,
  targetUserId: string | null | undefined
): string | null {
  if (profileRole !== "admin") return profileId;
  if (targetUserId === undefined) return profileId;
  return targetUserId; // pode ser um uuid ou null (board sem vendedor)
}

export async function createStageAction(
  name: string,
  color: string,
  targetUserId?: string | null
): Promise<Result> {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Não autenticado" };

  const ownerId = resolveOwner(profile.role, profile.id, targetUserId);

  // próxima posição DENTRO do board escolhido
  let posQuery = supabase
    .from("pipeline_stages")
    .select("position")
    .order("position", { ascending: false })
    .limit(1);
  posQuery = ownerId === null ? posQuery.is("user_id", null) : posQuery.eq("user_id", ownerId);
  const { data: existing } = await posQuery;
  const nextPos = (existing?.[0]?.position ?? -1) + 1;

  const { error } = await supabase
    .from("pipeline_stages")
    .insert({ name: name.trim(), color, position: nextPos, user_id: ownerId });
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
  // RLS garante que só o dono (ou admin) atualiza o estágio.
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

  // RLS garante que só o dono (ou admin) exclui.
  const { error } = await supabase.from("pipeline_stages").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/pipeline");
  revalidatePath("/leads");
  return { ok: true };
}

export async function reorderStagesAction(orderedIds: string[]): Promise<Result> {
  const supabase = await createClient();
  // Move tudo pra positions negativas primeiro pra contornar o unique(board, position)
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("pipeline_stages")
      .update({ position: -(i + 1) })
      .eq("id", orderedIds[i]);
    if (error) return { ok: false, error: error.message };
  }
  // Agora coloca nas posições finais (0-based, alinhado com o seed)
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("pipeline_stages")
      .update({ position: i })
      .eq("id", orderedIds[i]);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/settings/pipeline");
  revalidatePath("/leads");
  return { ok: true };
}
