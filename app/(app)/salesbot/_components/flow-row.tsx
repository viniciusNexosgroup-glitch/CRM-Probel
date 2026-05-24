"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SalesbotFlow } from "@/lib/salesbot/types";
import {
  deleteSalesbotFlowAction,
  updateSalesbotFlowStatusAction,
} from "../actions";

type Props = {
  flow: SalesbotFlow;
};

function statusBadge(status: SalesbotFlow["status"]) {
  if (status === "active") return <Badge variant="success">Ativo</Badge>;
  if (status === "paused") return <Badge variant="warning">Pausado</Badge>;
  if (status === "archived") return <Badge variant="secondary">Arquivado</Badge>;
  return <Badge variant="outline">Rascunho</Badge>;
}

export function FlowRow({ flow }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const active = flow.status === "active";

  function toggleStatus() {
    startTransition(async () => {
      const result = await updateSalesbotFlowStatusAction(
        flow.id,
        active ? "paused" : "active"
      );
      if (result.ok) {
        toast.success(active ? "Fluxo pausado" : "Fluxo ativado");
        router.refresh();
      } else {
        toast.error("Falha ao atualizar", { description: result.error });
      }
    });
  }

  function deleteFlow() {
    const confirmed = window.confirm(`Excluir o fluxo "${flow.name}"?`);
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteSalesbotFlowAction(flow.id);
      if (result.ok) {
        toast.success("Fluxo excluido");
        router.refresh();
      } else {
        toast.error("Falha ao excluir", { description: result.error });
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-wa-hover transition-colors">
      <Link href={`/salesbot/${flow.id}`} className="min-w-0 flex-1">
        <p className="text-sm font-medium text-wa-textPrimary truncate">{flow.name}</p>
        <p className="text-xs text-wa-textSecondary truncate">
          {flow.description || "Sem descrição"} · {flow.channel}
        </p>
      </Link>

      <div className="flex items-center gap-3 shrink-0">
        {statusBadge(flow.status)}

        <button
          type="button"
          onClick={toggleStatus}
          disabled={isPending}
          className={cn(
            "relative h-6 w-11 rounded-full border transition-colors disabled:opacity-50",
            active
              ? "border-primary/70 bg-primary/25"
              : "border-wa-border bg-wa-bg"
          )}
          title={active ? "Desativar fluxo" : "Ativar fluxo"}
          aria-label={active ? "Desativar fluxo" : "Ativar fluxo"}
        >
          <span
            className={cn(
              "absolute top-1 h-4 w-4 rounded-full transition-transform flex items-center justify-center",
              active
                ? "left-5 bg-primary text-primary-foreground"
                : "left-1 bg-wa-active text-wa-textSecondary"
            )}
          >
            {active ? <PlayCircle className="h-3 w-3" /> : <PauseCircle className="h-3 w-3" />}
          </span>
        </button>

        <button
          type="button"
          onClick={deleteFlow}
          disabled={isPending}
          className="h-8 w-8 rounded-md flex items-center justify-center text-wa-textSecondary hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
          title="Excluir fluxo"
          aria-label="Excluir fluxo"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
