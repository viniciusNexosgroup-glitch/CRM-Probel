/**
 * Cron endpoint do follow-up automático: manda, no máximo, uma mensagem por
 * loja por chamada, respeitando janela, teto diário e intervalo (ver
 * lib/follow-up/fila.ts).
 *
 * Como acionar: cron da VPS, a cada minuto (/etc/cron.d/crm-probel).
 *
 * Auth: header `Authorization: Bearer <CRON_SECRET>`
 */
import { NextResponse, type NextRequest } from "next/server";
import { processarFilaFollowUp } from "@/lib/follow-up/fila";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorizado(request: NextRequest) {
  const esperado = process.env.CRON_SECRET;
  return !!esperado && request.headers.get("authorization") === `Bearer ${esperado}`;
}

async function executar(request: NextRequest) {
  if (!autorizado(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await processarFilaFollowUp());
}

export const POST = executar;
export const GET = executar;
