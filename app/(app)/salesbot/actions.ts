"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { salesbotDb } from "@/lib/salesbot/db";
import type { SalesbotEdge, SalesbotFlowStatus, SalesbotNode } from "@/lib/salesbot/types";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

export async function createSalesbotFlowAction(formData: FormData) {
  const supabase = await createClient();
  const db = salesbotDb(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const channel = String(formData.get("channel") ?? "whatsapp");
  if (!name) return;

  const { data, error } = await db
    .from("salesbot_flows")
    .insert({
      name,
      description: description || null,
      channel,
      status: "draft",
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) return;
  revalidatePath("/salesbot");
  redirect(`/salesbot/${data.id}`);
}

export async function updateSalesbotFlowStatusAction(
  flowId: string,
  status: SalesbotFlowStatus
): Promise<ActionResult> {
  const supabase = await createClient();
  const db = salesbotDb(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nao autenticado" };

  const update: Record<string, string> = {
    status,
    updated_by: user.id,
  };
  if (status === "active") update.last_published_at = new Date().toISOString();

  const { error } = await db.from("salesbot_flows").update(update).eq("id", flowId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/salesbot");
  revalidatePath(`/salesbot/${flowId}`);
  return { ok: true };
}

export async function deleteSalesbotFlowAction(flowId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const db = salesbotDb(supabase);
  const { error } = await db.from("salesbot_flows").delete().eq("id", flowId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/salesbot");
  return { ok: true };
}

export async function saveSalesbotGraphAction(
  flowId: string,
  nodes: SalesbotNode[],
  edges: SalesbotEdge[]
): Promise<ActionResult> {
  const supabase = await createClient();
  const db = salesbotDb(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nao autenticado" };

  const normalizedNodes = nodes.map((node) => ({
    flow_id: flowId,
    node_key: node.node_key,
    type: node.type,
    label: node.label,
    position_x: node.position_x,
    position_y: node.position_y,
    config: node.config ?? {},
  }));
  const normalizedEdges = edges.map((edge) => ({
    flow_id: flowId,
    edge_key: edge.edge_key,
    source_node_key: edge.source_node_key,
    target_node_key: edge.target_node_key,
    label: edge.label,
    condition: edge.condition ?? {},
  }));

  const { error: clearEdgesError } = await db.from("salesbot_edges").delete().eq("flow_id", flowId);
  if (clearEdgesError) return { ok: false, error: clearEdgesError.message };

  const { error: clearNodesError } = await db.from("salesbot_nodes").delete().eq("flow_id", flowId);
  if (clearNodesError) return { ok: false, error: clearNodesError.message };

  if (normalizedNodes.length > 0) {
    const { error } = await db.from("salesbot_nodes").insert(normalizedNodes);
    if (error) return { ok: false, error: error.message };
  }
  if (normalizedEdges.length > 0) {
    const { error } = await db.from("salesbot_edges").insert(normalizedEdges);
    if (error) return { ok: false, error: error.message };
  }

  await db.from("salesbot_flows").update({ updated_by: user.id }).eq("id", flowId);
  revalidatePath(`/salesbot/${flowId}`);
  return { ok: true };
}
