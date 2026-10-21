"use client";

import { useEffect, useState } from "react";
import { Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type Loja = { id: string; nome: string; ativa: boolean };

/**
 * Para onde ir depois de trocar de loja.
 *
 * Fica na mesma seção, mas sem nada que pertença à loja anterior: a conversa
 * aberta (?c=), o quadro de um vendedor (?board=) ou um robô (/salesbot/<id>)
 * são da outra empresa e não existem na nova.
 */
function destinoAposTroca(): string {
  const caminho = window.location.pathname
    .split("/")
    .filter((parte) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parte))
    .join("/");
  return caminho || "/chat";
}

/**
 * Seletor de loja, para quem tem acesso a mais de uma.
 *
 * Quem tem uma loja só não vê nada: o componente não renderiza. A lista vem do
 * banco (`minhas_lojas`), que só devolve as lojas liberadas para quem pergunta
 * -- liberar uma loja é decisão do servidor, nunca da tela.
 *
 * Trocar recarrega a página inteira, de propósito. Tudo o que está na tela --
 * conversas, leads, tarefas, contadores -- é da loja anterior, e uma navegação
 * comum reaproveitaria parte disso.
 */
export function SeletorLoja({
  variante,
  onLojaAtiva,
}: {
  variante: "lateral" | "celular";
  /** Avisa o nome da loja ativa, para quem quiser exibi-lo em outro lugar. */
  onLojaAtiva?: (nome: string) => void;
}) {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [trocando, setTrocando] = useState(false);

  useEffect(() => {
    let vivo = true;
    createClient()
      .rpc("minhas_lojas")
      .then(({ data, error }) => {
        if (!vivo || error || !data) return;
        setLojas(data);
        const ativa = data.find((l) => l.ativa);
        if (ativa) onLojaAtiva?.(ativa.nome);
      });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (lojas.length < 2) return null;

  async function trocar(id: string) {
    if (trocando) return;
    setTrocando(true);
    const { error } = await createClient().rpc("trocar_loja", { p_instance: id });
    if (error) {
      setTrocando(false);
      toast.error("Não consegui trocar de loja", { description: error.message });
      return;
    }
    window.location.assign(destinoAposTroca());
  }

  const ativa = lojas.find((l) => l.ativa)?.id ?? "";

  return (
    <label
      className={cn(
        "flex items-center gap-2",
        variante === "lateral" ? "w-full" : "w-full px-4 py-3 border-b border-wa-border"
      )}
    >
      {trocando ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
      ) : (
        <Store className="h-4 w-4 text-primary shrink-0" />
      )}
      <span className="sr-only">Loja que você está vendo</span>
      <select
        value={ativa}
        disabled={trocando}
        onChange={(e) => trocar(e.target.value)}
        className={cn(
          "min-w-0 flex-1 rounded-md bg-wa-panel border border-wa-border text-wa-textPrimary",
          "focus:outline-none focus:border-primary/40 disabled:opacity-60",
          variante === "lateral" ? "h-8 text-xs px-1.5" : "h-10 text-sm px-2"
        )}
      >
        {lojas.map((l) => (
          <option key={l.id} value={l.id}>
            {l.nome}
          </option>
        ))}
      </select>
    </label>
  );
}
