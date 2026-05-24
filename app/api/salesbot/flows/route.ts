import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { salesbotDb } from "@/lib/salesbot/db";
import { requireSalesbotAdmin } from "@/lib/salesbot/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const db = salesbotDb(supabase);
  const { data, error } = await db
    .from("salesbot_flows")
    .select("*")
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const permission = await requireSalesbotAdmin(supabase as any);
  if (!permission.ok) {
    return NextResponse.json({ ok: false, error: permission.error }, { status: permission.status });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const channel = typeof body?.channel === "string" ? body.channel : "whatsapp";
  if (!name) return NextResponse.json({ ok: false, error: "Nome e obrigatorio" }, { status: 400 });

  const db = salesbotDb(supabase);
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
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  await db.from("salesbot_triggers").insert({
    flow_id: data.id,
    type: "new_message",
    config: {},
    is_active: true,
  });

  return NextResponse.json({ ok: true, data }, { status: 201 });
}
