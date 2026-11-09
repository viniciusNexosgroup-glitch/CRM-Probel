"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MessageCircle, UserRound } from "lucide-react";
import { textoParaCartoes } from "@/lib/format/cartao-contato";
import { acaoSegura } from "@/lib/ui/acao-segura";
import { localizarConversaDoNumeroAction } from "../actions";
import { NewConversationDialog } from "./new-conversation-dialog";

/**
 * Contato que o cliente compartilhou na conversa.
 *
 * "Conversar" abre a conversa que já existe com aquele número. Se não existir,
 * abre a "Nova conversa" já preenchida, porque a conversa só nasce com a
 * primeira mensagem, e quem escreve é o atendente.
 */
export function CartoesContato({ texto }: { texto: string | null }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [buscando, setBuscando] = useState<string | null>(null);
  const [novaConversa, setNovaConversa] = useState<{ telefone: string; nome: string } | null>(null);

  const cartoes = textoParaCartoes(texto);

  function chamar(telefone: string, nome: string) {
    if (buscando) return;
    setBuscando(telefone);
    startTransition(async () => {
      const res = await acaoSegura(() => localizarConversaDoNumeroAction(telefone));
      setBuscando(null);
      if (!res.ok) {
        toast.error("Não consegui abrir este contato", { description: res.error });
        return;
      }
      if (res.data?.conversationId) {
        router.push(`/chat?c=${res.data.conversationId}`);
        return;
      }
      if (res.data?.deOutroVendedor) {
        toast.info("Este contato já está em atendimento com outro vendedor.");
        return;
      }
      setNovaConversa({ telefone, nome });
    });
  }

  if (cartoes.length === 0) {
    // Mensagens antigas foram gravadas sem o nome e o telefone do contato.
    return (
      <div className="flex items-center gap-2 px-1 py-1 pr-12">
        <UserRound className="h-5 w-5 opacity-70 shrink-0" />
        <div className="text-sm">
          <p className="font-medium">Contato compartilhado</p>
          <p className="text-xs opacity-70">Abra no celular para ver o número</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-[220px] space-y-1.5 pb-1">
      {cartoes.map((cartao, i) => (
        <div key={i} className="rounded-md bg-black/20 p-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/25">
              <UserRound className="h-5 w-5 opacity-70" />
            </span>
            <p className="min-w-0 truncate font-medium">{cartao.nome}</p>
          </div>
          {cartao.telefones.map((telefone) => (
            <button
              key={telefone}
              type="button"
              onClick={() => chamar(telefone, cartao.nome)}
              disabled={buscando !== null}
              title={`Conversar com ${cartao.nome}`}
              className="mt-1.5 flex w-full items-center justify-between gap-2 rounded bg-black/20 px-2 py-2 text-left text-xs transition-colors hover:bg-black/30 disabled:opacity-60"
            >
              <span className="min-w-0 truncate">{telefone}</span>
              <span className="inline-flex shrink-0 items-center gap-1 font-medium text-emerald-400">
                {buscando === telefone ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MessageCircle className="h-3.5 w-3.5" />
                )}
                Conversar
              </span>
            </button>
          ))}
        </div>
      ))}

      {novaConversa && (
        <NewConversationDialog
          open
          onClose={() => setNovaConversa(null)}
          telefoneInicial={novaConversa.telefone}
          nomeContato={novaConversa.nome}
        />
      )}
    </div>
  );
}
