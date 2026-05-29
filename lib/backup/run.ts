import { createServiceClient } from "@/lib/supabase/server";

// Backup diário dos dados de CRM em JSON no Storage (retenção 30 dias).
// NÃO inclui `messages` (volumoso e recuperável via WhatsApp/Evolution).
const BACKUP_TABLES = [
  "leads",
  "contacts",
  "conversations",
  "tags",
  "lead_tags",
  "pipeline_stages",
  "tasks",
  "lead_activity",
  "internal_notes",
  "quick_replies",
  "media_categories",
  "media_library",
  "settings",
  "profiles",
];

const RETENTION_DAYS = 30;
const BUCKET = "contact-media";
const PREFIX = "backups";

export async function runBackup(): Promise<{ ok: boolean; file?: string; error?: string }> {
  try {
    const svc = createServiceClient();

    const dump: Record<string, unknown> = {
      _meta: { generatedAt: new Date().toISOString(), tables: BACKUP_TABLES },
    };
    for (const t of BACKUP_TABLES) {
      // chama com `this` preservado (svc.from(...)); cast só pra satisfazer o tipo
      const { data, error } = await svc.from(t as never).select("*");
      dump[t] = error ? { _error: (error as { message: string }).message } : (data ?? []);
    }

    const date = new Date().toISOString().slice(0, 10);
    const path = `${PREFIX}/backup-${date}.json`;
    const body = Buffer.from(JSON.stringify(dump));

    const { error: upErr } = await svc.storage
      .from(BUCKET)
      .upload(path, body, { contentType: "application/json", upsert: true });
    if (upErr) return { ok: false, error: upErr.message };

    // Prune backups com mais de 30 dias
    const { data: files } = await svc.storage.from(BUCKET).list(PREFIX, { limit: 1000 });
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const toDelete = (files ?? [])
      .filter((f) => {
        const m = f.name.match(/^backup-(\d{4}-\d{2}-\d{2})\.json$/);
        return m ? new Date(m[1]).getTime() < cutoff : false;
      })
      .map((f) => `${PREFIX}/${f.name}`);
    if (toDelete.length > 0) await svc.storage.from(BUCKET).remove(toDelete);

    return { ok: true, file: path };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
