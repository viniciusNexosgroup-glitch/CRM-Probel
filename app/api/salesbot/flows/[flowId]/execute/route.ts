import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireSalesbotAdmin } from "@/lib/salesbot/permissions";
import { runSalesbotForMessage } from "@/lib/salesbot/engine";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ flowId: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const { flowId } = await ctx.params;
  const supabase = await createClient();
  const permission = await requireSalesbotAdmin(supabase as any);
  if (!permission.ok) {
    return NextResponse.json({ ok: false, error: permission.error }, { status: permission.status });
  }

  const body = await request.json().catch(() => null);
  const required = ["instanceId", "conversationId", "contactId", "remoteJid"];
  const missing = required.filter((key) => typeof body?.[key] !== "string" || !body[key]);
  if (missing.length > 0) {
    return NextResponse.json({ ok: false, error: `Campos obrigatorios: ${missing.join(", ")}` }, { status: 400 });
  }

  const result = await runSalesbotForMessage({
    event: "new_message",
    flowId,
    instanceId: body.instanceId,
    conversationId: body.conversationId,
    contactId: body.contactId,
    leadId: typeof body.leadId === "string" ? body.leadId : null,
    remoteJid: body.remoteJid,
    messageText: typeof body.messageText === "string" ? body.messageText : null,
    evolutionMessageId: typeof body.evolutionMessageId === "string" ? body.evolutionMessageId : `manual-${Date.now()}`,
  });

  return NextResponse.json({ ok: true, data: result });
}
