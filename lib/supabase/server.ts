import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { urlDoServidor, nomeDoCookie } from "./endereco";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    urlDoServidor(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Fixa o nome do cookie: a biblioteca o derivaria do endereço, e como o
      // servidor usa a rede interna e o navegador o endereço público, cada lado
      // criaria um cookie diferente e a sessão se perderia.
      cookieOptions: { name: nomeDoCookie() },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component sem permissão de setar cookies — ignorar.
            // O middleware mantém a sessão atualizada.
          }
        },
      },
    }
  );
}

/**
 * Client com Service Role — use APENAS em rotas internas (webhooks, jobs).
 * Nunca exponha no frontend. Bypassa RLS.
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    urlDoServidor(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
