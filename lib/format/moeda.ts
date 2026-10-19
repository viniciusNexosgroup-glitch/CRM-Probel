/**
 * Valor em reais: "R$ 1.234,56".
 *
 * O formatador é criado uma vez. `valor.toLocaleString("pt-BR", {...})` cria um
 * `Intl.NumberFormat` novo a cada chamada, e o Kanban formata um valor por
 * cartão -- num quadro com 1.500 leads, eram 1.500 formatadores por tela.
 */
const REAL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarMoeda(valor: number): string {
  return REAL.format(valor);
}
