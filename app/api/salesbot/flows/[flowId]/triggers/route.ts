import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { salesbotDb } from "@/lib/salesbot/db";
import { requireSalesbotAdmin } from "@/lib/salesbot/permissions";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ flowId: string }> };

const ALLOWED_TYPES = new Set([
  "new_conversation",
  "new_message",
  "lead_created",
  "stage_changed",
  "no_response",
  "keyword_detected",
  "instagram_comment",
  "outside_business_hours",
]);

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { flowId } = await ctx.params;
  const supabase = await createClient();
  const db = salesbotDb(supabase);
  const { data, error } = await db
    .from("salesbot_triggers")
    .select("*")
    .eq("flow_id", flowId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { flowId } = await ctx.params;
  const supabase = await createClient();
  const permission = await requireSalesbotAdmin(supabase as any);
  if (!permission.ok) {
    return NextResponse.json({ ok: false, error: permission.error }, { status: permission.status });
  }

  const body = await request.json().catch(() => null);
  const triggers = Array.isArray(body?.triggers) ? body.triggers : [];
  const normalized = triggers
    .filter((trigger: { type?: unknown }) => typeof trigger.type === "string" && ALLOWED_TYPES.has(trigger.type))
    .map((trigger: { type: string; config?: unknown; is_active?: unknown }) => ({
      flow_id: flowId,
      type: trigger.type,
      config: trigger.config && typeof trigger.config === "object" ? trigger.config : {},
      is_active: trigger.is_active !== false,
    }));

  if (normalized.length === 0) {
    return NextResponse.json({ ok: false, error: "Informe ao menos um gatilho valido." }, { status: 400 });
  }

  const db = salesbotDb(supabase);
  await db.from("salesbot_triggers").delete().eq("flow_id", flowId);
  const { data, error } = await db.from("salesbot_triggers").insert(normalized).select("*");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  await db.from("salesbot_flows").update({ updated_by: permission.userId }).eq("id", flowId);
  return NextResponse.json({ ok: true, data });
}
