import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/** Tempo máximo esperando o Supabase validar a sessão. */
const AUTH_TIMEOUT_MS = 3000;

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() revalida o token a cada request (não confiar em getSession).
  //
  // Essa é uma ida à rede, do edge da Vercel até o Supabase na VPS, em TODA
  // página. Sem tempo limite, qualquer travada lá (reinício de container,
  // pressão de memória, oscilação de rede) derrubava o app inteiro com
  // "504 MIDDLEWARE_INVOCATION_TIMEOUT" — em vez de afetar só aquela chamada.
  //
  // Com o limite, uma oscilação deixa de ser tela de erro: seguimos adiante e
  // a própria página confere a sessão (todas usam getCachedUser e redirecionam
  // pro login se não houver usuário). Ou seja, não afrouxa o acesso.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  let authIndisponivel = false;
  try {
    const resultado = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout ao validar a sessão")), AUTH_TIMEOUT_MS)
      ),
    ]);
    user = resultado.data.user;
  } catch (e) {
    authIndisponivel = true;
    console.error("[middleware] sessão não validada:", (e as Error).message);
  }

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Se a validação não respondeu, não dá para afirmar que o usuário está
  // deslogado — mandar pro login nesse caso expulsaria quem está trabalhando.
  // Deixa passar; a página decide.
  if (authIndisponivel) return response;

  // Não autenticado em rota privada → /login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // Autenticado em rota de auth → /chat
  if (user && (pathname === "/login" || pathname === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/chat";
    url.searchParams.delete("redirectTo");
    return NextResponse.redirect(url);
  }

  return response;
}
