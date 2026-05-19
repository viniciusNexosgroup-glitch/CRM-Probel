#!/usr/bin/env node
/**
 * Verifica se webhook está recebendo eventos da Evolution.
 * Conta linhas em contacts, conversations, messages criadas nos últimos 5 min.
 */
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const queries = [
  { label: "Mensagens últimos 5 min", sql: "select count(*)::int as n from public.messages where created_at > now() - interval '5 minutes'" },
  { label: "Mensagens últimos 30 min", sql: "select count(*)::int as n from public.messages where created_at > now() - interval '30 minutes'" },
  { label: "Total de mensagens", sql: "select count(*)::int as n from public.messages" },
  { label: "Total de contatos", sql: "select count(*)::int as n from public.contacts" },
  { label: "Total de conversas", sql: "select count(*)::int as n from public.conversations" },
];

for (const q of queries) {
  const { rows } = await client.query(q.sql);
  console.log(`📊 ${q.label}: ${rows[0].n}`);
}

console.log("\n🔍 Últimas 5 mensagens recebidas (se houver):");
const { rows: latest } = await client.query(`
  select
    m.id,
    m.message_type as type,
    m.from_me,
    substring(coalesce(m.content, m.media_caption, '(sem texto)') from 1 for 60) as preview,
    m.timestamp,
    c.push_name,
    c.phone
  from public.messages m
  left join public.contacts c on c.id = (
    select contact_id from public.conversations where id = m.conversation_id
  )
  order by m.timestamp desc
  limit 5
`);

if (latest.length === 0) {
  console.log("  (nenhuma ainda)");
} else {
  for (const r of latest) {
    const arrow = r.from_me ? "→" : "←";
    const from = r.push_name ?? r.phone ?? "?";
    console.log(`  ${arrow} ${r.type.padEnd(10)} | ${from.padEnd(20)} | ${r.preview}`);
  }
}

await client.end();
