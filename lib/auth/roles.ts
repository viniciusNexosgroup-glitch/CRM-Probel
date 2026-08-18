import { getCachedProfile, type CurrentProfile } from "./current-user";

export type { CurrentProfile };

/**
 * Perfil do usuário logado (id, role, nome, email) ou null se não autenticado.
 * Memorizado por requisição — ver lib/auth/current-user.ts.
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  return getCachedProfile();
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const p = await getCurrentProfile();
  return p?.role === "admin";
}
