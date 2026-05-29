// DIAGNÓSTICO TEMPORÁRIO (remover depois): região da função + latência função→DB.
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const svc = createServiceClient();
  const pings: number[] = [];
  for (let i = 0; i < 4; i++) {
    const t = Date.now();
    await svc.from("pipeline_stages").select("id").limit(1);
    pings.push(Date.now() - t);
  }
  return NextResponse.json({
    region: process.env.VERCEL_REGION ?? "unknown",
    dbPingsMs: pings,
    dbPingColdMs: pings[0],
    dbPingWarmMs: Math.round(pings.slice(1).reduce((a, b) => a + b, 0) / 3),
  });
}
