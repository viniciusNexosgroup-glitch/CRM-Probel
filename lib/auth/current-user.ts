import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentProfile = {
  id: string;
  role: "admin" | "user";
  full_name: string | null;
  email: string | null;
};

/**
 * Usuário logado, memorizado por requisição.
 *
 * Sem isso, layout do app + layout do chat + página chamavam `auth.getUser()`
 * cada um por conta própria — 3 idas à rede até o servidor só pra responder a
 * mesma pergunta. O `cache()` do React reaproveita a primeira resposta dentro
 * da mesma requisição.
 */
export const getCachedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Perfil (id, papel, nome) do usuário logado — também memorizado por requisição. */
export const getCachedProfile = cache(async (): Promise<CurrentProfile | null> => {
  const user = await getCachedUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, role, full_name, email")
    .eq("id", user.id)
    .single();
  return (data as CurrentProfile) ?? null;
});
