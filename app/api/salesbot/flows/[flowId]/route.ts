import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { salesbotDb } from "@/lib/salesbot/db";
import { requireSalesbotAdmin } from "@/lib/salesbot/permissions";
import type { SalesbotFlowStatus } from "@/lib/salesbot/types";
import { validateSalesbotGraph } from "@/lib/salesbot/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ flowId: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { flowId } = await ctx.params;
  const supabase = await createClient();
  const db = salesbotDb(supabase);

  const [flowRes, nodesRes, edgesRes, triggersRes] = await Promise.all([
    db.from("salesbot_flows").select("*").eq("id", flowId).single(),
    db.from("salesbot_nodes").select("*").eq("flow_id", flowId).order("created_at", { ascending: true }),
    db.from("salesbot_edges").select("*").eq("flow_id", flowId).order("created_at", { ascending: true }),
    db.from("salesbot_triggers").select("*").eq("flow_id", flowId).order("created_at", { ascending: true }),
  ]);

  if (flowRes.error) return NextResponse.json({ ok: false, error: "Fluxo nao encontrado" }, { status: 404 });
  return NextResponse.json({
    ok: true,
    data: {
      flow: flowRes.data,
      nodes: nodesRes.data ?? [],
      edges: edgesRes.data ?? [],
      triggers: triggersRes.data ?? [],
    },
  });
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { flowId } = await ctx.params;
  const supabase = await createClient();
  const permission = await requireSalesbotAdmin(supabase as any);
  if (!permission.ok) {
    return NextResponse.json({ ok: false, error: permission.error }, { status: permission.status });
  }

  const body = await request.json().catch(() => null);
  const update: Record<string, unknown> = { updated_by: permission.userId };

  if (typeof body?.name === "string") update.name = body.name.trim();
  if (typeof body?.description === "string") update.description = body.description.trim() || null;
  if (typeof body?.channel === "string") update.channel = body.channel;
  if (typeof body?.status === "string") {
    const status = body.status as SalesbotFlowStatus;
    if (status === "active") {
      const db = salesbotDb(supabase);
      const [nodesRes, edgesRes, triggersRes] = await Promise.all([
        db.from("salesbot_nodes").select("node_key, type, label").eq("flow_id", flowId),
        db.from("salesbot_edges").select("source_node_key, target_node_key").eq("flow_id", flowId),
        db.from("salesbot_triggers").select("is_active").eq("flow_id", flowId),
      ]);
      const validation = validateSalesbotGraph(
        nodesRes.data ?? [],
        edgesRes.data ?? [],
        triggersRes.data ?? []
      );
      if (!validation.ok) {
        return NextResponse.json({ ok: false, error: validation.errors.join(" ") }, { status: 400 });
      }
      update.last_published_at = new Date().toISOString();
    }
    update.status = status;
  }

  const db = salesbotDb(supabase);
  const { data, error } = await db
    .from("salesbot_flows")
    .update(update)
    .eq("id", flowId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { flowId } = await ctx.params;
  const supabase = await createClient();
  const permission = await requireSalesbotAdmin(supabase as any);
  if (!permission.ok) {
    return NextResponse.json({ ok: false, error: permission.error }, { status: permission.status });
  }

  const db = salesbotDb(supabase);
  const { error } = await db.from("salesbot_flows").delete().eq("id", flowId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
