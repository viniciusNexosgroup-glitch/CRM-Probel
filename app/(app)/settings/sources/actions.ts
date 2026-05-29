"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LeadSource } from "@/lib/lead-sources";
import type { Json } from "@/types/database";

type Result = { ok: true } | { ok: false; error: string };

export async function saveLeadSourcesAction(sources: LeadSource[]): Promise<Result> {
  const clean = sources
    .map((s) => ({ value: s.value.trim(), label: s.label.trim() }))
    .filter((s) => s.value && s.label);

  if (clean.length === 0) return { ok: false, error: "Adicione ao menos uma origem" };

  // valores únicos
  const seen = new Set<string>();
  for (const s of clean) {
    if (seen.has(s.value)) return { ok: false, error: `Origem duplicada: ${s.value}` };
    seen.add(s.value);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("settings").upsert(
    {
      key: "lead_sources",
      value: clean as unknown as Json,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/sources");
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { ok: true };
}
