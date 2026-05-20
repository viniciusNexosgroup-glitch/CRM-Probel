/**
 * Webhook receiver da Evolution API.
 *
 * URL: /api/webhooks/evolution/<EVOLUTION_WEBHOOK_SECRET>
 *
 * Por que o secret no path? Evolution v2.3.7 manda webhook sem headers
 * customizáveis; colocar o secret no path autentica a chamada sem expor
 * em logs de proxies (vs query string).
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  handleMessagesUpsert,
  handleMessagesUpdate,
  handleConnectionUpdate,
  handleContactsUpsert,
  handleChatsUpdate,
} from "@/lib/evolution/webhook-handlers";
import type { WebhookPayload } from "@/lib/evolution/webhook-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ secret: string }> }
) {
  const { secret } = await ctx.params;
  const expected = process.env.EVOLUTION_WEBHOOK_SECRET;

  if (!expected) {
    console.error("[webhook] EVOLUTION_WEBHOOK_SECRET não está definido");
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
  }

  // Comparação resistente a timing attack (mesma length antes de comparar)
  if (secret.length !== expected.length || secret !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = (await request.json()) as WebhookPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const event = String(payload.event ?? "");
  const instance = String(payload.instance ?? "");

  console.log(`[webhook] event=${event} instance=${instance}`);

  try {
    switch (event) {
      case "messages.upsert":
        await handleMessagesUpsert(instance, payload.data as never);
        break;
      case "messages.update":
        await handleMessagesUpdate(instance, payload.data as never);
        break;
      case "connection.update":
        await handleConnectionUpdate(instance, payload.data as never);
        break;
      case "contacts.upsert":
      case "contacts.update":
        await handleContactsUpsert(instance, payload.data as never);
        break;
      case "chats.update":
      case "chats.upsert":
        await handleChatsUpdate(instance, payload.data as never);
        break;
      default:
        // ignora silenciosamente eventos que ainda não processamos
        break;
    }
  } catch (err) {
    console.error(`[webhook] erro processando ${event}:`, (err as Error).message);
    // Retorna 200 mesmo em erro pra Evolution não ficar reenviando indefinidamente.
    // Erros ficam no log pra debug.
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}

// Aceita GET pra teste manual / healthcheck
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ secret: string }> }
) {
  const { secret } = await ctx.params;
  const expected = process.env.EVOLUTION_WEBHOOK_SECRET;
  if (!expected) return NextResponse.json({ ok: false }, { status: 500 });
  if (secret !== expected) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, message: "Evolution webhook receiver online" });
}
