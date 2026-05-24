import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { salesbotDb } from "@/lib/salesbot/db";
import { requireSalesbotAdmin } from "@/lib/salesbot/permissions";
import { validateSalesbotEdgesForSave } from "@/lib/salesbot/validation";
import type { SalesbotEdge, SalesbotNode } from "@/lib/salesbot/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ flowId: string }> };

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { flowId } = await ctx.params;
  const supabase = await createClient();
  const permission = await requireSalesbotAdmin(supabase as any);
  if (!permission.ok) {
    return NextResponse.json({ ok: false, error: permission.error }, { status: permission.status });
  }

  const body = await request.json().catch(() => null);
  const nodes = Array.isArray(body?.nodes) ? (body.nodes as SalesbotNode[]) : [];
  const edges = Array.isArray(body?.edges) ? (body.edges as SalesbotEdge[]) : [];
  const validation = validateSalesbotEdgesForSave(nodes, edges);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.errors.join(" ") }, { status: 400 });
  }

  const db = salesbotDb(supabase);
  const { error } = await db.rpc("save_salesbot_graph", {
    p_flow_id: flowId,
    p_nodes: nodes.map((node) => ({
      node_key: node.node_key,
      type: node.type,
      label: node.label,
      position_x: node.position_x,
      position_y: node.position_y,
      config: node.config ?? {},
    })),
    p_edges: edges.map((edge) => ({
      edge_key: edge.edge_key,
      source_node_key: edge.source_node_key,
      target_node_key: edge.target_node_key,
      label: edge.label,
      condition: edge.condition ?? {},
    })),
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  await db.from("salesbot_flows").update({ updated_by: permission.userId }).eq("id", flowId);
  return NextResponse.json({ ok: true });
}
