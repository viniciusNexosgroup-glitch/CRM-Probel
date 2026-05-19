#!/usr/bin/env node
/**
 * Diagnóstico do Realtime do Supabase.
 * Verifica:
 *  - Publication 'supabase_realtime' existe
 *  - Quais tabelas estão publicadas
 *  - REPLICA IDENTITY das tabelas (precisa ser DEFAULT ou FULL)
 */
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

console.log("📡 Publication supabase_realtime:");
const { rows: pubs } = await client.query(
  `select pubname from pg_publication where pubname = 'supabase_realtime'`
);
console.log(pubs.length ? `  ✅ existe` : `  ❌ NÃO existe`);

console.log("\n📋 Tabelas publicadas:");
const { rows: tables } = await client.query(`
  select schemaname, tablename
  from pg_publication_tables
  where pubname = 'supabase_realtime'
  order by tablename
`);
for (const t of tables) {
  console.log(`  • ${t.schemaname}.${t.tablename}`);
}
if (tables.length === 0) console.log("  ⚠️ NENHUMA tabela publicada");

console.log("\n🔧 REPLICA IDENTITY das tabelas críticas:");
const { rows: replicas } = await client.query(`
  select c.relname as table,
         case c.relreplident
           when 'd' then 'default'
           when 'n' then 'nothing'
           when 'f' then 'full'
           when 'i' then 'index'
         end as identity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('messages','conversations','contacts','whatsapp_instances')
  order by c.relname
`);
for (const r of replicas) {
  const ok = r.identity === "default" || r.identity === "full";
  console.log(`  ${ok ? "✅" : "❌"} ${r.table}: ${r.identity}`);
}

await client.end();
