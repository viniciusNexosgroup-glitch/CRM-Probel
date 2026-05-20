"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

export type QuickReplyPayload = {
  shortcut: string;
  title: string;
  content: string;
  category?: string | null;
};

function validateShortcut(s: string): string | null {
  const v = s.trim();
  if (!v) return "Atalho é obrigatório";
  if (!v.startsWith("/")) return "Atalho deve começar com /";
  if (v.length < 2) return "Atalho muito curto";
  if (!/^\/[a-z0-9_-]+$/i.test(v)) return "Use só letras, números, - ou _";
  return null;
}

export async function createQuickReplyAction(payload: QuickReplyPayload): Promise<Result> {
  const err = validateShortcut(payload.shortcut);
  if (err) return { ok: false, error: err };
  if (!payload.title.trim()) return { ok: false, error: "Título é obrigatório" };
  if (!payload.content.trim()) return { ok: false, error: "Conteúdo é obrigatório" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("quick_replies").insert({
    shortcut: payload.shortcut.trim().toLowerCase(),
    title: payload.title.trim(),
    content: payload.content,
    category: payload.category?.trim() || null,
    user_id: user?.id ?? null,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Já existe uma resposta com esse atalho." };
    return { ok: false, error: error.message };
  }
  revalidatePath("/settings/quick-replies");
  revalidatePath("/chat");
  return { ok: true };
}

export async function updateQuickReplyAction(
  id: string,
  payload: QuickReplyPayload
): Promise<Result> {
  const err = validateShortcut(payload.shortcut);
  if (err) return { ok: false, error: err };
  if (!payload.title.trim()) return { ok: false, error: "Título é obrigatório" };
  if (!payload.content.trim()) return { ok: false, error: "Conteúdo é obrigatório" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("quick_replies")
    .update({
      shortcut: payload.shortcut.trim().toLowerCase(),
      title: payload.title.trim(),
      content: payload.content,
      category: payload.category?.trim() || null,
    })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Já existe uma resposta com esse atalho." };
    return { ok: false, error: error.message };
  }
  revalidatePath("/settings/quick-replies");
  revalidatePath("/chat");
  return { ok: true };
}

export async function deleteQuickReplyAction(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("quick_replies").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/quick-replies");
  revalidatePath("/chat");
  return { ok: true };
}
