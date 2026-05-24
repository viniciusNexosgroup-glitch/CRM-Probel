import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { salesbotDb } from "@/lib/salesbot/db";
import { requireSalesbotAdmin } from "@/lib/salesbot/permissions";
import { validateSalesbotGraph } from "@/lib/salesbot/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ flowId: string }> };

export async function POST(_request: NextRequest, ctx: Ctx) {
  const { flowId } = await ctx.params;
  const supabase = await createClient();
  const permission = await requireSalesbotAdmin(supabase as any);
  if (!permission.ok) {
    return NextResponse.json({ ok: false, error: permission.error }, { status: permission.status });
  }

  const db = salesbotDb(supabase);
  const [nodesRes, edgesRes, triggersRes] = await Promise.all([
    db.from("salesbot_nodes").select("node_key, type, label").eq("flow_id", flowId),
    db.from("salesbot_edges").select("source_node_key, target_node_key").eq("flow_id", flowId),
    db.from("salesbot_triggers").select("is_active").eq("flow_id", flowId),
  ]);

  if (nodesRes.error) return NextResponse.json({ ok: false, error: nodesRes.error.message }, { status: 400 });
  if (edgesRes.error) return NextResponse.json({ ok: false, error: edgesRes.error.message }, { status: 400 });
  if (triggersRes.error) return NextResponse.json({ ok: false, error: triggersRes.error.message }, { status: 400 });

  const validation = validateSalesbotGraph(nodesRes.data ?? [], edgesRes.data ?? [], triggersRes.data ?? []);
  return NextResponse.json({ ok: validation.ok, errors: validation.errors });
}
