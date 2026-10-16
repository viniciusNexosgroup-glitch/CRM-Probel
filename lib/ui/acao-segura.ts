export type ResultadoAcao = { ok: true } | { ok: false; error: string };

/**
 * Executa uma ação do servidor sem deixar a falha escapar para a tela.
 *
 * Uma ação do servidor que devolve `{ ok: false }` é um erro tratado. Mas
 * quando o servidor some no meio do caminho — reinício da máquina, queda de
 * rede, tempo esgotado, container recriado por uma publicação — a chamada não
 * devolve nada: ela REJEITA. Sem captura, a rejeição sobe até o limite de erro
 * do React e o Next troca a tela ou recarrega a página.
 *
 * Foi exatamente o que os atendentes relataram: "o CRM trava e atualiza
 * sozinho, e a mensagem não vai". Pior, o texto ou o áudio em andamento se
 * perdia junto, porque o componente era destruído antes de poder avisar.
 *
 * Aqui a falha vira um resultado comum, que cada tela trata com um aviso e
 * mantém o que o atendente escreveu.
 */
export async function acaoSegura<T extends ResultadoAcao>(
  executar: () => Promise<T>
): Promise<T | { ok: false; error: string }> {
  try {
    return await executar();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    // Quando o servidor está inalcançável o navegador não diz o motivo — só
    // "failed to fetch". Traduzir evita que o atendente leia jargão e ajuda a
    // decidir o que fazer: esperar e repetir, em vez de reescrever tudo.
    const semResposta =
      /failed to fetch|load failed|networkerror|network request failed|aborted|timeout/i.test(msg);

    console.error("[acao-segura] falha não tratada:", e);

    return {
      ok: false,
      error: semResposta
        ? "O servidor não respondeu. Nada foi enviado — confira a conexão e tente de novo."
        : `Falha inesperada no servidor: ${msg}`,
    };
  }
}
