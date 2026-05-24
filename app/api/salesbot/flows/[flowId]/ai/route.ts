import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { salesbotDb } from "@/lib/salesbot/db";
import { requireSalesbotAdmin } from "@/lib/salesbot/permissions";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ flowId: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { flowId } = await ctx.params;
  const supabase = await createClient();
  const db = salesbotDb(supabase);
  const { data, error } = await db
    .from("salesbot_ai_settings")
    .select("*")
    .eq("flow_id", flowId)
    .maybeSingle();

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
  const payload = {
    flow_id: flowId,
    model: typeof body?.model === "string" && body.model.trim() ? body.model.trim() : "gpt-4.1-mini",
    system_prompt: typeof body?.system_prompt === "string" ? body.system_prompt : null,
    fallback_message: typeof body?.fallback_message === "string" ? body.fallback_message : null,
    handoff_on_uncertainty: body?.handoff_on_uncertainty !== false,
    enabled: body?.enabled === true,
  };

  const db = salesbotDb(supabase);
  await db.from("salesbot_ai_settings").delete().eq("flow_id", flowId);
  const { data, error } = await db.from("salesbot_ai_settings").insert(payload).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  await db.from("salesbot_flows").update({ updated_by: permission.userId }).eq("id", flowId);
  return NextResponse.json({ ok: true, data });
}
