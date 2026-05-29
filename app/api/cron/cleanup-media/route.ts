/**
 * Cron de retenção de mídia: apaga do Storage as mídias RECEBIDAS com mais de
 * RETENTION_DAYS dias e zera a media_url da mensagem (a UI passa a mostrar um
 * placeholder no lugar). Mantém o Storage longe do limite de 1GB do plano grátis.
 *
 * Só mexe em `received/` — mídia enviada (adhoc) e biblioteca não são tocadas.
 *
 * Auth: header `Authorization: Bearer <CRON_SECRET>` (a Vercel injeta isso
 * automaticamente nos crons quando CRON_SECRET está definido).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RETENTION_DAYS = 30;
const STORAGE_MARKER = "/object/public/contact-media/";

async function authorize(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return { ok: false, status: 500, error: "CRON_SECRET não definido" };
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) return { ok: false, status: 401, error: "Unauthorized" };
  return { ok: true } as const;
}

async function run() {
  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: old, error } = await supabase
    .from("messages")
    .select("id, media_url")
    .lt("timestamp", cutoff)
    .like("media_url", `%${STORAGE_MARKER}received/%`)
    .limit(2000);

  if (error) return { deleted: 0, error: error.message };
  if (!old || old.length === 0) return { deleted: 0, cutoff };

  const paths: string[] = [];
  const ids: string[] = [];
  for (const m of old) {
    const url = m.media_url as string;
    const idx = url.indexOf(STORAGE_MARKER);
    if (idx === -1) continue;
    paths.push(decodeURIComponent(url.slice(idx + STORAGE_MARKER.length)));
    ids.push(m.id);
  }

  // Remove do Storage em lotes
  let deleted = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { error: rmErr } = await supabase.storage.from("contact-media").remove(batch);
    if (rmErr) {
      console.warn("[cleanup-media] remove falhou:", rmErr.message);
      continue;
    }
    deleted += batch.length;
  }

  // Zera media_url (UI mostra placeholder no lugar do link morto)
  for (let i = 0; i < ids.length; i += 200) {
    await supabase
      .from("messages")
      .update({ media_url: null })
      .in("id", ids.slice(i, i + 200));
  }

  return { deleted, messages: ids.length, cutoff };
}

export async function GET(request: NextRequest) {
  const auth = await authorize(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  return NextResponse.json({ ok: true, ...(await run()) });
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  return NextResponse.json({ ok: true, ...(await run()) });
}
