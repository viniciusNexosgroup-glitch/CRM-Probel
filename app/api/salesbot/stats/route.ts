import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { salesbotDb } from "@/lib/salesbot/db";
import { requireSalesbotAdmin } from "@/lib/salesbot/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const permission = await requireSalesbotAdmin(supabase as any);
  if (!permission.ok) {
    return NextResponse.json({ ok: false, error: permission.error }, { status: permission.status });
  }

  const db = salesbotDb(supabase);
  const { data, error } = await db
    .from("salesbot_executions")
    .select("id, status, variables, created_at");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const executions = data ?? [];
  return NextResponse.json({
    ok: true,
    data: {
      totalExecutions: executions.length,
      completedExecutions: executions.filter((item: { status: string }) => item.status === "completed").length,
      failedExecutions: executions.filter((item: { status: string }) => item.status === "failed").length,
      humanHandoffs: executions.filter((item: { variables?: { handoff?: unknown } }) => Boolean(item.variables?.handoff)).length,
    },
  });
}
