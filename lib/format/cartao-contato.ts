/** Contato compartilhado numa conversa do WhatsApp. */
export type CartaoContato = { nome: string; telefones: string[] };

function limparNome(valor: string): string {
  return valor
    .replace(/\\([,;\\])/g, "$1")
    .replace(/\\n/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lê o vCard que o WhatsApp manda. O telefone chega assim:
 *
 *   item1.TEL;waid=5500900000000:+55 00 90000-0000
 *
 * `waid` é o número como o WhatsApp o conhece. Fica o texto digitado quando ele
 * já é internacional; sem o "+", usa-se o `waid`, que sempre tem o país.
 *
 * Devolve null se o cartão não tiver nem nome nem telefone.
 */
export function lerVcard(vcard: string, nomeExibido?: string | null): CartaoContato | null {
  // Linha longa no vCard continua na seguinte, começando com espaço.
  const linhas = vcard.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");

  let nome = limparNome(nomeExibido ?? "");
  const telefones: string[] = [];

  for (const linha of linhas) {
    const separador = linha.indexOf(":");
    if (separador < 0) continue;
    const chave = linha.slice(0, separador);
    const valor = linha.slice(separador + 1).trim();
    const propriedade = chave.split(";")[0].split(".").pop()?.toUpperCase();

    if (propriedade === "FN" && !nome) nome = limparNome(valor);
    if (propriedade !== "TEL") continue;

    const waid = /waid=(\d+)/i.exec(chave)?.[1];
    const digitado = valor.replace(/^tel:/i, "").trim();
    const telefone = waid && !digitado.startsWith("+") ? `+${waid}` : digitado;
    if (/\d/.test(telefone) && !telefones.includes(telefone)) telefones.push(telefone);
  }

  if (!nome && telefones.length === 0) return null;
  return { nome: nome || "Contato", telefones };
}

/**
 * Como o cartão fica em `messages.content`: nome na primeira linha, telefones
 * nas seguintes, e uma linha em branco entre um contato e outro. Em texto
 * simples, porque a busca e o encaminhamento usam esse campo como está.
 */
export function cartoesParaTexto(cartoes: CartaoContato[]): string {
  return cartoes.map((c) => [c.nome, ...c.telefones].join("\n")).join("\n\n");
}

export function textoParaCartoes(texto: string | null | undefined): CartaoContato[] {
  if (!texto?.trim()) return [];
  return texto
    .trim()
    .split(/\n\s*\n/)
    .map((bloco) => {
      const [nome, ...telefones] = bloco.split("\n").map((l) => l.trim());
      return { nome, telefones: telefones.filter(Boolean) };
    });
}

/** Texto curto para a lista de conversas e para mensagens citadas. */
export function previaDoCartao(texto: string | null | undefined): string {
  const cartoes = textoParaCartoes(texto);
  if (cartoes.length === 0) return "👤 Contato";
  const extras = cartoes.length - 1;
  return `👤 ${cartoes[0].nome}${extras > 0 ? ` e mais ${extras}` : ""}`;
}
