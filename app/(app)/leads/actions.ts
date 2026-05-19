"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateLeadStageAction(leadId: string, stageId: string): Promise<ActionResult> {
  const supabase = await createClient();

  // Busca o stage de destino pra ver se é ganho/perdido
  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("is_won, is_lost")
    .eq("id", stageId)
    .single();

  const status: "open" | "won" | "lost" = stage?.is_won
    ? "won"
    : stage?.is_lost
      ? "lost"
      : "open";

  const { error } = await supabase
    .from("leads")
    .update({ stage_id: stageId, status })
    .eq("id", leadId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/leads");
  return { ok: true };
}

export type LeadFormPayload = {
  name?: string | null;
  source?: string | null;
  campaign_name?: string | null;
  ad_name?: string | null;
  interest?: string | null;
  estimated_value?: number | null;
  closed_value?: number | null;
  lost_reason?: string | null;
  next_action?: string | null;
  next_action_at?: string | null;
  notes?: string | null;
};

export async function updateLeadAction(
  leadId: string,
  payload: LeadFormPayload
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("leads").update(payload).eq("id", leadId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/leads");
  return { ok: true };
}
