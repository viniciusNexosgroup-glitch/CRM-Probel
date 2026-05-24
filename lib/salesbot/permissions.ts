import type { SupabaseClient } from "@supabase/supabase-js";

type PermissionResult =
  | { ok: true; userId: string; role: "admin" | "user" }
  | { ok: false; error: string; status: number };

export async function requireSalesbotAdmin(client: SupabaseClient<any>): Promise<PermissionResult> {
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return { ok: false, error: "Nao autenticado", status: 401 };

  const { data: profile, error } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error) return { ok: false, error: error.message, status: 500 };
  if (profile?.role !== "admin" && profile?.role !== "user") {
    return { ok: false, error: "Sem permissao para gerenciar SalesBot", status: 403 };
  }

  return { ok: true, userId: user.id, role: profile.role };
}
