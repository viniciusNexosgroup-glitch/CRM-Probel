"use client";

import { useEffect } from "react";

/**
 * Cola imagem direto na conversa, como no WhatsApp Business.
 *
 * O atendente dá Ctrl+C num print, num anúncio ou numa foto de produto e
 * Ctrl+V aqui — sem salvar no computador antes, sem procurar a pasta depois.
 * As imagens vão para a mesma tela de conferência da galeria (PreviaEnvio);
 * colar de novo com ela aberta junta mais imagens ao mesmo envio.
 *
 * O ouvinte fica na janela, não no campo de texto: quem copia uma imagem e
 * cola raramente clica no campo antes, e exigir isso faria a função parecer
 * quebrada. Colar texto continua normal — só imagem é interceptada.
 *
 * `aoColar` deve ser estável (useCallback), senão o ouvinte é refeito a cada
 * desenho da tela.
 */
export function useImagemColada(aoColar: (imagens: File[]) => void) {
  useEffect(() => {
    function ouvir(e: ClipboardEvent) {
      const dados = e.clipboardData;
      if (!dados) return;

      const imagens = Array.from(dados.files).filter((f) => f.type.startsWith("image/"));
      if (imagens.length === 0) return; // texto ou outro conteúdo: deixa passar

      e.preventDefault();
      aoColar(imagens);
    }
    window.addEventListener("paste", ouvir);
    return () => window.removeEventListener("paste", ouvir);
  }, [aoColar]);
}
