"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { moverLeadParaEtapaAction } from "../actions";

type Etapa = { id: string; name: string; meta_event_name: string | null };

/**
 * Permite avançar o lead direto da tela de disparos, sem passar pelo funil.
 * Usa o mesmo caminho das outras formas de mover, então o evento da etapa
 * escolhida dispara junto.
 */
export function SeletorEtapa({
  leadId,
  etapaAtualId,
  etapas,
}: {
  leadId: string;
  etapaAtualId: string | null;
  etapas: Etapa[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function mover(stageId: string) {
    if (!stageId || stageId === etapaAtualId) return;
    const destino = etapas.find((e) => e.id === stageId);
    startTransition(async () => {
      const res = await moverLeadParaEtapaAction(leadId, stageId);
      if (res.ok) {
        toast.success(`Movido para "${destino?.name}"`, {
          description: destino?.meta_event_name
            ? `Evento ${destino.meta_event_name} enviado ao Meta.`
            : "Esta etapa não dispara evento.",
        });
        router.refresh();
      } else {
        toast.error("Não deu para mover", { description: res.error });
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        value={etapaAtualId ?? ""}
        onChange={(e) => mover(e.target.value)}
        disabled={pending || etapas.length === 0}
        className="h-8 max-w-[190px] text-xs rounded-md bg-wa-bg border border-wa-border px-2 text-wa-textPrimary focus:outline-none focus:border-primary/40 disabled:opacity-50"
        aria-label="Mudar a etapa do lead"
      >
        {!etapaAtualId && <option value="">Sem etapa</option>}
        {etapas.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
            {e.meta_event_name ? ` → ${e.meta_event_name}` : ""}
          </option>
        ))}
      </select>
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-wa-textSecondary" />}
    </span>
  );
}
