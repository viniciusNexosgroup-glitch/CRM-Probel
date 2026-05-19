#!/usr/bin/env node
/**
 * Verifica que o schema do CRM foi aplicado corretamente.
 */
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const checks = [
  {
    label: "Tabelas públicas",
    sql: `select count(*)::int as n from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`,
    expect: 15,
  },
  {
    label: "Pipeline stages (seed)",
    sql: `select count(*)::int as n from public.pipeline_stages`,
    expect: 7,
  },
  {
    label: "Tags (seed)",
    sql: `select count(*)::int as n from public.tags`,
    expect: 9,
  },
  {
    label: "Categorias de mídia (seed)",
    sql: `select count(*)::int as n from public.media_categories`,
    expect: 5,
  },
  {
    label: "Settings (seed)",
    sql: `select count(*)::int as n from public.settings`,
    expect: 3,
  },
  {
    label: "Buckets de storage",
    sql: `select count(*)::int as n from storage.buckets where id in ('contact-media','media-library','avatars')`,
    expect: 3,
  },
  {
    label: "RLS habilitada (tabelas com policies)",
    sql: `select count(distinct tablename)::int as n from pg_policies where schemaname='public'`,
    expect: 15,
  },
];

let ok = 0;
let fail = 0;

for (const check of checks) {
  const { rows } = await client.query(check.sql);
  const got = rows[0].n;
  const passed = got === check.expect;
  if (passed) {
    console.log(`✅ ${check.label}: ${got}`);
    ok++;
  } else {
    console.log(`❌ ${check.label}: esperado ${check.expect}, obtido ${got}`);
    fail++;
  }
}

console.log(`\n${ok}/${ok + fail} checks ok`);
await client.end();
process.exit(fail === 0 ? 0 : 1);
