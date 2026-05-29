import { createClient } from "@/lib/supabase/server";

export type CurrentProfile = {
  id: string;
  role: "admin" | "user";
  full_name: string | null;
  email: string | null;
};

/**
 * Perfil do usuário logado (id, role, nome, email) ou null se não autenticado.
 * Use em server components / actions pra decidir o que mostrar/permitir.
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, role, full_name, email")
    .eq("id", user.id)
    .single();
  return (data as CurrentProfile) ?? null;
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const p = await getCurrentProfile();
  return p?.role === "admin";
}
