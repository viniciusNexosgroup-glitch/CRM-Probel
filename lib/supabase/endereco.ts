/**
 * Por onde o servidor fala com o Supabase.
 *
 * Rodando na mesma máquina que o banco, usar o endereço público faria o
 * tráfego sair até o roteador e voltar — medido em 68-134ms por chamada,
 * contra poucos milissegundos pela rede interna. Com 6-7 chamadas por tela,
 * é a diferença que justifica ter saído da Vercel.
 *
 * O NAVEGADOR continua usando o endereço público (precisa, é outra máquina).
 */
export function urlDoServidor(): string {
  return process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
}

/**
 * Nome do cookie de sessão.
 *
 * A biblioteca deriva esse nome do endereço do Supabase. Como servidor e
 * navegador passam a usar endereços diferentes, cada lado criaria um cookie
 * com nome próprio e o login se perderia. Fixamos pelo endereço público, que
 * é o que o navegador enxerga.
 */
export function nomeDoCookie(): string {
  const publico = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const host = publico.replace(/^https?:\/\//, "").split(/[.:/]/)[0];
  return `sb-${host || "localhost"}-auth-token`;
}

/**
 * Reescreve uma URL do Supabase para o endereço público.
 *
 * `getPublicUrl` monta o link a partir do endereço que o cliente está usando —
 * e no servidor esse endereço é o interno (`http://supabase:8000`), um apelido
 * que só existe dentro da rede Docker do CRM.
 *
 * Um link desses é inútil para quem está de fora. O navegador do atendente não
 * resolve esse nome, e a Evolution — que roda noutra rede Docker — também não:
 * ela tenta buscar o arquivo, não acha, e responde 400. Era o motivo de o envio
 * de áudio falhar só no CRM da VPS; na Vercel a variável não existe e o link já
 * saía público.
 *
 * Então tudo que deixa o servidor (vai pra Evolution, pro banco, pro navegador)
 * passa por aqui.
 */
export function urlPublica(url: string): string {
  const interno = process.env.SUPABASE_INTERNAL_URL?.replace(/\/+$/, "");
  const publico = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!interno || !publico || !url.startsWith(interno)) return url;
  return publico + url.slice(interno.length);
}
