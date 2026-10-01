"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MessageCircle, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickReplyDialog } from "./quick-reply-dialog";
import { deleteQuickReplyAction, reordenarRespostasAction } from "../actions";
import type { Database } from "@/types/database";

type QuickReplyRow = Database["public"]["Tables"]["quick_replies"]["Row"];

export function QuickReplyList({ initial }: { initial: QuickReplyRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QuickReplyRow | null>(null);
  const [pending, startTransition] = useTransition();

  // A ordem vale para a lista inteira (é a mesma que aparece no chat), então
  // mover considera a posição geral, não a posição dentro da categoria.
  function mover(id: string, direcao: -1 | 1) {
    const ordem = initial.map((r) => r.id);
    const i = ordem.indexOf(id);
    const destino = i + direcao;
    if (i < 0 || destino < 0 || destino >= ordem.length) return;
    [ordem[i], ordem[destino]] = [ordem[destino], ordem[i]];
    startTransition(async () => {
      const res = await reordenarRespostasAction(ordem);
      if (res.ok) router.refresh();
      else toast.error("Não deu para reordenar", { description: res.error });
    });
  }

  function onNew() {
    setEditing(null);
    setOpen(true);
  }

  function onEdit(r: QuickReplyRow) {
    setEditing(r);
    setOpen(true);
  }

  async function onDelete(r: QuickReplyRow) {
    if (!confirm(`Deletar resposta "${r.title}" (${r.shortcut})?`)) return;
    const res = await deleteQuickReplyAction(r.id);
    if (res.ok) {
      toast.success("Removida");
      router.refresh();
    } else {
      toast.error("Falha", { description: res.error });
    }
  }

  // Agrupa por categoria
  const grouped = initial.reduce(
    (acc, r) => {
      const cat = r.category ?? "Sem categoria";
      acc[cat] = acc[cat] ?? [];
      acc[cat].push(r);
      return acc;
    },
    {} as Record<string, QuickReplyRow[]>
  );

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={onNew}>
          <Plus className="h-4 w-4" />
          Nova resposta
        </Button>
      </div>

      {initial.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhuma resposta rápida cadastrada.</p>
          <p className="text-xs mt-1">Clique em &ldquo;Nova resposta&rdquo; pra criar a primeira.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, list]) => (
            <div key={category}>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                {category}
              </h3>
              <ul className="space-y-2">
                {list.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-lg border border-border bg-card p-3 hover:border-primary/40 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-primary/15 text-primary px-1.5 py-0.5 rounded">
                            {r.shortcut}
                          </code>
                          <p className="font-medium text-sm text-foreground">{r.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap line-clamp-3">
                          {r.content}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="flex flex-col mr-1">
                          <button
                            onClick={() => mover(r.id, -1)}
                            disabled={pending || initial[0]?.id === r.id}
                            className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent"
                            aria-label={`Subir ${r.title}`}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => mover(r.id, 1)}
                            disabled={pending || initial[initial.length - 1]?.id === r.id}
                            className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent"
                            aria-label={`Descer ${r.title}`}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </span>
                        <button
                          onClick={() => onEdit(r)}
                          className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
                          aria-label="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(r)}
                          className="p-1.5 hover:bg-destructive/15 rounded text-muted-foreground hover:text-red-400"
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <QuickReplyDialog open={open} onClose={() => setOpen(false)} editing={editing} />
    </>
  );
}
