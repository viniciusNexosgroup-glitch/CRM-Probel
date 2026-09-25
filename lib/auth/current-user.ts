import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentProfile = {
  id: string;
  role: "admin" | "user";
  full_name: string | null;
  email: string | null;
  /** Loja (instância de WhatsApp) à qual o usuário pertence. */
  instance_id: string | null;
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

/**
 * Perfil (id, papel, loja) do usuário logado — memorizado por requisição.
 *
 * Buscar o perfil só DEPOIS de validar a sessão custava duas idas à rede em
 * fila, em toda página. Aqui as duas saem juntas: o id vem do cookie (leitura
 * local, sem rede) e serve para disparar a busca do perfil, enquanto a
 * validação da sessão corre em paralelo.
 *
 * A validação continua mandando: se ela não confirmar o usuário, ou confirmar
 * outro, devolvemos null. Ou seja, ganha-se tempo sem afrouxar a checagem.
 */
export const getCachedProfile = cache(async (): Promise<CurrentProfile | null> => {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const idDoCookie = session?.user?.id ?? null;
  if (!idDoCookie) return null;

  const [user, perfil] = await Promise.all([
    getCachedUser(),
    supabase
      .from("profiles")
      .select("id, role, full_name, email, instance_id")
      .eq("id", idDoCookie)
      .single(),
  ]);

  // A sessão do cookie não basta: só vale o que o servidor de autenticação
  // confirmou.
  if (!user || user.id !== idDoCookie) return null;
  return (perfil.data as CurrentProfile) ?? null;
});

/** Id da loja do usuário logado — usado para gravar dados na loja certa. */
export async function getCurrentInstanceId(): Promise<string | null> {
  return (await getCachedProfile())?.instance_id ?? null;
}
