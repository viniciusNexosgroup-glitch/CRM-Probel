#!/usr/bin/env node
/**
 * Roda todas as migrations em supabase/migrations/*.sql, em ordem alfabética.
 * Usa SUPABASE_DB_URL do .env.local.
 *
 * Uso:
 *   npm run migrate
 *
 * As migrations são idempotentes — pode rodar quantas vezes quiser.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(__dirname, "..", "supabase", "migrations");

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("❌ SUPABASE_DB_URL não está definida no .env.local");
  process.exit(1);
}

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error("❌ Nenhum arquivo .sql encontrado em supabase/migrations/");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

const start = Date.now();
try {
  console.log("🔗 Conectando ao Postgres do Supabase...");
  await client.connect();
  console.log("✅ Conectado\n");

  for (const file of files) {
    const sql = readFileSync(resolve(migrationsDir, file), "utf8");
    process.stdout.write(`▶ ${basename(file)} ... `);
    const t0 = Date.now();
    await client.query(sql);
    console.log(`✅ (${Date.now() - t0}ms)`);
  }

  console.log(`\n🎉 ${files.length} migration(s) aplicada(s) em ${((Date.now() - start) / 1000).toFixed(1)}s`);
} catch (err) {
  console.error("\n❌ Falha na migração:");
  console.error(`   ${err.message}`);
  if (err.code === "ENETUNREACH" || err.code === "ENOTFOUND") {
    console.error("\n💡 Dica: pode ser problema de IPv6/IPv4 ou hostname do pooler.");
    console.error("   Vá em Supabase Dashboard → botão verde 'Connect' (topo) → 'Connection string' → 'URI'.");
    console.error("   Copie e cole no .env.local como SUPABASE_DB_URL.");
  }
  process.exit(1);
} finally {
  await client.end();
}
