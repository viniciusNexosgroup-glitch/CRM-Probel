/** Um pedaço do texto da mensagem: `href` preenchido quando é um link. */
export type TrechoDeTexto = { texto: string; href: string | null };

/**
 * O que conta como link numa mensagem, nesta ordem:
 *  1. começa com http://, https:// ou www.;
 *  2. encurtadores conhecidos, com caminho (wa.me/..., bit.ly/...);
 *  3. domínio solto com terminação comum (loja.com.br).
 *
 * A lista do item 3 é curta de propósito, e só em minúsculas: quem esquece o
 * espaço depois do ponto escreve "Bom dia.Me avisa", e isso não pode virar link.
 *
 * Os limites {1,63} e {1,8} evitam que uma mensagem enorme, com milhares de
 * letras ou pontos seguidos, trave a tela do atendente.
 */
const LINK =
  /(?:[hH][tT][tT][pP][sS]?:\/\/|[wW]{3}\.)[^\s<>"'\p{Extended_Pictographic}]+|(?:wa\.me|bit\.ly|youtu\.be|t\.me|goo\.gl|maps\.app\.goo\.gl|forms\.gle)\/[^\s<>"'\p{Extended_Pictographic}]+|\b(?:[a-z0-9-]{1,63}\.){1,8}(?:com\.br|net\.br|org\.br|gov\.br|edu\.br|com|net|org|shop|store)(?![a-z0-9-])(?:[/?#][^\s<>"'\p{Extended_Pictographic}]*)?/gu;

/** Tira do fim o que é pontuação da frase, e não parte do endereço. */
function aparar(url: string): string {
  let fim = url.length;
  while (fim > 0) {
    const c = url[fim - 1];
    if (".,;:!?*_~".includes(c)) {
      fim--;
      continue;
    }
    const abre = { ")": "(", "]": "[", "}": "{" }[c];
    if (abre) {
      const trecho = url.slice(0, fim);
      if (trecho.split(c).length > trecho.split(abre).length) {
        fim--;
        continue;
      }
    }
    break;
  }
  return url.slice(0, fim);
}

function hrefDe(texto: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(texto) ? texto : `https://${texto}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Separa o texto em trechos comuns e links.
 *
 * Sem protocolo, o endereço precisa estar solto na frase: "kiwa.me/x" não é o
 * encurtador wa.me, e em "nome@loja.com.br" o domínio faz parte de um e-mail.
 */
export function dividirLinks(texto: string): TrechoDeTexto[] {
  if (!texto.includes(".")) return [{ texto, href: null }];

  const trechos: TrechoDeTexto[] = [];
  let cursor = 0;

  for (const achado of texto.matchAll(LINK)) {
    const inicio = achado.index;
    const link = aparar(achado[0]);
    if (!link) continue;

    const antes = texto.slice(Math.max(0, inicio - 2), inicio);
    const colado = /[\p{L}\p{N}@._-]$/u.test(antes);
    if (!/^https?:/i.test(link) && colado) continue;
    if (texto[inicio + link.length] === "@") continue;

    const href = hrefDe(link);
    if (!href) continue;

    if (inicio > cursor) trechos.push({ texto: texto.slice(cursor, inicio), href: null });
    trechos.push({ texto: link, href });
    cursor = inicio + link.length;
  }

  if (cursor < texto.length) trechos.push({ texto: texto.slice(cursor), href: null });
  return trechos;
}
