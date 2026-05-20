"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BusinessHoursConfig, AutoReplyConfig } from "@/lib/business-hours";
import type { Json } from "@/types/database";

type Result = { ok: true } | { ok: false; error: string };

export async function saveBusinessHoursAction(
  hours: BusinessHoursConfig,
  reply: AutoReplyConfig
): Promise<Result> {
  if (hours.enabled) {
    if (!/^\d{2}:\d{2}$/.test(hours.start) || !/^\d{2}:\d{2}$/.test(hours.end)) {
      return { ok: false, error: "Hora inválida (use HH:MM)" };
    }
    if (hours.days.length === 0) {
      return { ok: false, error: "Selecione ao menos um dia" };
    }
  }
  if (reply.enabled && !reply.message.trim()) {
    return { ok: false, error: "Mensagem de auto-resposta vazia" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: e1 } = await supabase.from("settings").upsert(
    {
      key: "business_hours",
      value: hours as unknown as Json,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  const { error: e2 } = await supabase.from("settings").upsert(
    {
      key: "auto_reply_outside_hours",
      value: reply as unknown as Json,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (e1 || e2) return { ok: false, error: (e1 ?? e2)!.message };
  revalidatePath("/settings/business-hours");
  return { ok: true };
}
