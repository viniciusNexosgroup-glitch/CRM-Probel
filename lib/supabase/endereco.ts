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
