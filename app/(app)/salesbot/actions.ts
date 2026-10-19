"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { salesbotDb } from "@/lib/salesbot/db";
import { requireSalesbotAdmin } from "@/lib/salesbot/permissions";
import type { SalesbotEdge, SalesbotFlowStatus, SalesbotNode, SalesbotTriggerType } from "@/lib/salesbot/types";
import {
  validateSalesbotEdgesForSave,
  validateSalesbotGraph,
} from "@/lib/salesbot/validation";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

export async function createSalesbotFlowAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const db = salesbotDb(supabase);
  const permission = await requireSalesbotAdmin(supabase as any);
  if (!permission.ok) return { ok: false, error: permission.error };

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const channel = String(formData.get("channel") ?? "whatsapp");
  if (!name) return { ok: false, error: "Informe um nome para o fluxo." };

  const { data, error } = await db
    .from("salesbot_flows")
    .insert({
      name,
      description: description || null,
      channel,
      status: "draft",
      created_by: permission.userId,
      updated_by: permission.userId,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Falha ao criar fluxo." };
  const { error: triggerError } = await db.from("salesbot_triggers").insert({
    flow_id: data.id,
    type: "lead_created",
    config: {},
    is_active: true,
  });
  if (triggerError) return { ok: false, error: triggerError.message };

  revalidatePath("/salesbot");
  return { ok: true, data: { id: data.id } };
}

export async function updateSalesbotFlowStatusAction(
  flowId: string,
  status: SalesbotFlowStatus
): Promise<ActionResult> {
  const supabase = await createClient();
  const db = salesbotDb(supabase);
  const permission = await requireSalesbotAdmin(supabase as any);
  if (!permission.ok) return { ok: false, error: permission.error };

  if (status === "active") {
    const [nodesRes, edgesRes, triggersRes] = await Promise.all([
      db.from("salesbot_nodes").select("node_key, type, label").eq("flow_id", flowId),
      db
        .from("salesbot_edges")
        .select("source_node_key, target_node_key")
        .eq("flow_id", flowId),
      db.from("salesbot_triggers").select("is_active").eq("flow_id", flowId),
    ]);

    if (nodesRes.error) return { ok: false, error: nodesRes.error.message };
    if (edgesRes.error) return { ok: false, error: edgesRes.error.message };
    if (triggersRes.error) return { ok: false, error: triggersRes.error.message };

    const validation = validateSalesbotGraph(
      nodesRes.data ?? [],
      edgesRes.data ?? [],
      triggersRes.data ?? []
    );
    if (!validation.ok) {
      return { ok: false, error: validation.errors.join(" ") };
    }
  }

  const update: Record<string, string> = {
    status,
    updated_by: permission.userId,
  };
  if (status === "active") update.last_published_at = new Date().toISOString();

  const { error } = await db.from("salesbot_flows").update(update).eq("id", flowId);
  if (error) return { ok: false, error: error.message };

  if (status === "active") await pausarConcorrentes(db, flowId);

  revalidatePath("/salesbot");
  revalidatePath(`/salesbot/${flowId}`);
  return { ok: true };
}

/**
 * Pausa os outros fluxos da mesma loja que disparam no mesmo evento.
 *
 * Dois fluxos ativos no mesmo gatilho rodam os dois para o mesmo lead, cada um
 * atribuindo a um vendedor diferente -- e quem fica com ele depende de qual
 * terminou por último. A loja tem um fluxo de rodízio e um por vendedor
 * justamente para alternar entre eles, então ligar um tem que desligar os
 * concorrentes.
 */
async function pausarConcorrentes(
  db: ReturnType<typeof salesbotDb>,
  flowId: string
): Promise<void> {
  try {
    const { data: fluxo } = await db
      .from("salesbot_flows")
      .select("instance_id")
      .eq("id", flowId)
      .maybeSingle();
    if (!fluxo?.instance_id) return;

    const { data: gatilhos } = await db
      .from("salesbot_triggers")
      .select("type")
      .eq("flow_id", flowId)
      .eq("is_active", true);
    const tipos = (gatilhos ?? []).map((g: { type: string }) => g.type);
    if (tipos.length === 0) return;

    const { data: irmaos } = await db
      .from("salesbot_flows")
      .select("id, salesbot_triggers(type, is_active)")
      .eq("instance_id", fluxo.instance_id)
      .eq("status", "active")
      .neq("id", flowId);

    const conflitantes = (irmaos ?? [])
      .filter((f: { salesbot_triggers?: { type: string; is_active: boolean }[] }) =>
        (f.salesbot_triggers ?? []).some((g) => g.is_active && tipos.includes(g.type))
      )
      .map((f: { id: string }) => f.id);

    if (conflitantes.length > 0) {
      await db.from("salesbot_flows").update({ status: "paused" }).in("id", conflitantes);
    }
  } catch (e) {
    // Nunca derruba a ativação: o fluxo pedido já está ativo.
    console.warn("[salesbot] falha ao pausar concorrentes:", e instanceof Error ? e.message : e);
  }
}

export async function deleteSalesbotFlowAction(flowId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const permission = await requireSalesbotAdmin(supabase as any);
  if (!permission.ok) return { ok: false, error: permission.error };
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
  const permission = await requireSalesbotAdmin(supabase as any);
  if (!permission.ok) return { ok: false, error: permission.error };

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

  const validation = validateSalesbotEdgesForSave(normalizedNodes, normalizedEdges);
  if (!validation.ok) return { ok: false, error: validation.errors.join(" ") };

  const { error: saveError } = await db.rpc("save_salesbot_graph", {
    p_flow_id: flowId,
    p_nodes: normalizedNodes,
    p_edges: normalizedEdges,
  });
  if (saveError) return { ok: false, error: saveError.message };

  await db.from("salesbot_flows").update({ updated_by: permission.userId }).eq("id", flowId);
  revalidatePath(`/salesbot/${flowId}`);
  return { ok: true };
}

export async function updateSalesbotTriggersAction(
  flowId: string,
  triggers: Array<{
    type: SalesbotTriggerType;
    config?: Record<string, unknown>;
    is_active?: boolean;
  }>
): Promise<ActionResult> {
  const supabase = await createClient();
  const db = salesbotDb(supabase);
  const permission = await requireSalesbotAdmin(supabase as any);
  if (!permission.ok) return { ok: false, error: permission.error };

  const normalized = triggers
    .filter((trigger) => trigger.type)
    .map((trigger) => ({
      flow_id: flowId,
      type: trigger.type,
      config: trigger.config ?? {},
      is_active: trigger.is_active !== false,
    }));

  if (normalized.length === 0) {
    return { ok: false, error: "Configure ao menos um gatilho." };
  }

  await db.from("salesbot_triggers").delete().eq("flow_id", flowId);
  const { error } = await db.from("salesbot_triggers").insert(normalized);
  if (error) return { ok: false, error: error.message };

  await db.from("salesbot_flows").update({ updated_by: permission.userId }).eq("id", flowId);
  revalidatePath(`/salesbot/${flowId}`);
  return { ok: true };
}
