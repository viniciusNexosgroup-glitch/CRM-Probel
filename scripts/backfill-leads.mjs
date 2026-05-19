#!/usr/bin/env node
/**
 * Cria leads para conversas existentes que ainda não têm lead vinculado.
 * Usa o primeiro stage do pipeline (Novo Lead).
 * Idempotente — pode rodar quantas vezes quiser.
 */
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const { rows: stages } = await client.query(
  `select id from public.pipeline_stages order by position asc limit 1`
);
if (stages.length === 0) {
  console.error("❌ Nenhum stage encontrado em pipeline_stages. Rode 0004_seed.sql.");
  process.exit(1);
}
const firstStageId = stages[0].id;
console.log(`📌 Stage inicial: ${firstStageId}`);

const { rows: result } = await client.query(
  `
  insert into public.leads (contact_id, conversation_id, stage_id, name, phone, source, status, last_contact_at)
  select
    c.contact_id,
    c.id as conversation_id,
    $1 as stage_id,
    coalesce(co.name, co.push_name) as name,
    co.phone,
    'whatsapp' as source,
    'open' as status,
    c.last_message_at
  from public.conversations c
  join public.contacts co on co.id = c.contact_id
  where co.is_group = false
    and not exists (select 1 from public.leads l where l.contact_id = c.contact_id)
  returning id
  `,
  [firstStageId]
);

console.log(`✅ ${result.length} lead(s) criado(s)`);

const { rows: total } = await client.query(`select count(*)::int as n from public.leads`);
console.log(`📊 Total de leads agora: ${total[0].n}`);

await client.end();
