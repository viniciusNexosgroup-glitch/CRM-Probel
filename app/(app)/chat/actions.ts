"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markAsReadAction(conversationId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("conversations")
    .update({ unread_count: 0 })
    .eq("id", conversationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}
