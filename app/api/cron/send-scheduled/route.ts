/**
 * Cron endpoint que envia mensagens programadas cujo scheduled_for já passou.
 *
 * Como acionar:
 * - Vercel Cron (Pro): configurado em vercel.json
 * - Externo (free): cron-job.org chamando este endpoint a cada minuto
 *
 * Auth: header `Authorization: Bearer <CRON_SECRET>`
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { evolution, EvolutionError } from "@/lib/evolution/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return { ok: false, status: 500, error: "CRON_SECRET não definido" };
  const auth = request.headers.get("authorization");
  // Vercel Cron envia "Bearer <token>" também
  if (auth !== `Bearer ${expected}`) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true } as const;
}

async function run() {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: pending, error: pendingErr } = await supabase
    .from("scheduled_messages")
    .select(
      `id, conversation_id, instance_id, content, scheduled_for,
       conversation:conversations!scheduled_messages_conversation_id_fkey(remote_jid)`
    )
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(50);

  if (pendingErr) {
    return { sent: 0, failed: 0, error: pendingErr.message };
  }

  let sent = 0;
  let failed = 0;

  for (const msg of pending ?? []) {
    const remoteJid = (msg as unknown as { conversation: { remote_jid: string } | null }).conversation
      ?.remote_jid;
    if (!remoteJid) {
      await supabase
        .from("scheduled_messages")
        .update({ status: "failed", error_message: "Conversa sem JID" })
        .eq("id", msg.id);
      failed++;
      continue;
    }

    try {
      const r = await evolution.sendText(remoteJid, msg.content);
      const sentAt = new Date().toISOString();

      await supabase.from("messages").insert({
        conversation_id: msg.conversation_id,
        instance_id: msg.instance_id,
        evolution_message_id: r.key.id,
        remote_jid: remoteJid,
        from_me: true,
        message_type: "text",
        content: msg.content,
        status: "sent",
        timestamp: sentAt,
      });

      await supabase
        .from("conversations")
        .update({
          last_message_text: msg.content,
          last_message_at: sentAt,
          last_message_from_me: true,
          unread_count: 0,
        })
        .eq("id", msg.conversation_id);

      await supabase
        .from("scheduled_messages")
        .update({ status: "sent", sent_at: sentAt })
        .eq("id", msg.id);

      sent++;
    } catch (e) {
      const errMsg = e instanceof EvolutionError ? e.message : (e as Error).message;
      await supabase
        .from("scheduled_messages")
        .update({ status: "failed", error_message: errMsg })
        .eq("id", msg.id);
      failed++;
    }
  }

  return { sent, failed };
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const result = await run();
  return NextResponse.json({ ok: true, ...result });
}

// GET pra Vercel Cron (que usa GET por padrão) + manual via browser
export async function GET(request: NextRequest) {
  const auth = await authorize(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const result = await run();
  return NextResponse.json({ ok: true, ...result });
}
