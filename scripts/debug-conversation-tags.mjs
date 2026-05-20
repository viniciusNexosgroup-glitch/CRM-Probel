#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Procura conversa onde o lead tem tags
const { data, error } = await supabase
  .from("conversations")
  .select(
    `
    id, last_message_at,
    contact:contacts!conversations_contact_id_fkey (
      id, name, push_name,
      leads:leads_contact_id_fkey (
        id,
        lead_tags ( tag:tags(*) )
      )
    )
  `
  );

if (error) {
  console.error("Erro:", error);
  process.exit(1);
}

const withTags = data.filter((c) => {
  const lead = c.contact?.leads;
  return lead?.lead_tags?.length > 0;
});

console.log(`📊 Total conversas: ${data.length}`);
console.log(`📊 Com tags: ${withTags.length}`);
console.log();

for (const conv of withTags) {
  console.log("Conv", conv.id);
  console.log("  Contact:", conv.contact.name ?? conv.contact.push_name);
  console.log("  Tags:", conv.contact.leads.lead_tags.map((lt) => lt.tag.name).join(", "));
  console.log();
}
