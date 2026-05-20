"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickReplyDialog } from "./quick-reply-dialog";
import { deleteQuickReplyAction } from "../actions";
import type { Database } from "@/types/database";

type QuickReplyRow = Database["public"]["Tables"]["quick_replies"]["Row"];

export function QuickReplyList({ initial }: { initial: QuickReplyRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QuickReplyRow | null>(null);

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
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
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
