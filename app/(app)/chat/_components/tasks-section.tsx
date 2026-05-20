"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Calendar, Clock, CheckCircle2, Circle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createTaskAction, toggleTaskAction, deleteTaskAction } from "../actions";
import type { TaskRow } from "../types";

function formatDue(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  const now = new Date();
  const diff = dt.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < -1) return `${Math.abs(days)} dias atrás`;
  if (days === -1) return "Ontem";
  if (days === 0) {
    return dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  if (days === 1) return "Amanhã";
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function isOverdue(d: string | null, completed: boolean): boolean {
  if (!d || completed) return false;
  return new Date(d).getTime() < Date.now();
}

export function TasksSection({
  leadId,
  contactId,
  tasks,
}: {
  leadId: string | null;
  contactId: string;
  tasks: TaskRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [pending, setPending] = useState(false);

  async function onCreate() {
    if (!title.trim()) return;
    setPending(true);
    const res = await createTaskAction(
      leadId,
      contactId,
      title,
      dueAt ? new Date(dueAt).toISOString() : null
    );
    setPending(false);
    if (!res.ok) {
      toast.error("Falha ao criar tarefa", { description: res.error });
      return;
    }
    setTitle("");
    setDueAt("");
    setShowAdd(false);
    router.refresh();
  }

  function onToggle(t: TaskRow) {
    startTransition(async () => {
      const res = await toggleTaskAction(t.id, !t.completed);
      if (!res.ok) toast.error("Falha", { description: res.error });
    });
  }

  function onDelete(taskId: string) {
    startTransition(async () => {
      const res = await deleteTaskAction(taskId);
      if (!res.ok) toast.error("Falha", { description: res.error });
    });
  }

  const sorted = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at);
    if (a.due_at) return -1;
    if (b.due_at) return 1;
    return 0;
  });

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wider text-wa-textTertiary">
          Tarefas {tasks.length > 0 && `(${tasks.length})`}
        </Label>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Nova
        </button>
      </div>

      {showAdd && (
        <div className="p-2 bg-wa-bg/40 rounded-md border border-wa-border space-y-1.5">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="O que precisa ser feito?"
            className="h-8 text-sm bg-wa-bg"
            onKeyDown={(e) => e.key === "Enter" && onCreate()}
            autoFocus
          />
          <div className="flex gap-1.5">
            <Input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="h-8 text-xs bg-wa-bg flex-1"
            />
            <Button
              size="sm"
              onClick={onCreate}
              disabled={pending || !title.trim()}
              className="h-8"
            >
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Criar"}
            </Button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-xs text-wa-textTertiary py-2">Nenhuma tarefa cadastrada.</p>
      ) : (
        <ul className="space-y-1">
          {sorted.map((t) => {
            const overdue = isOverdue(t.due_at, t.completed);
            return (
              <li
                key={t.id}
                className="flex items-start gap-2 p-2 rounded-md hover:bg-wa-hover group"
              >
                <button onClick={() => onToggle(t)} className="mt-0.5 shrink-0">
                  {t.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-wa-textSecondary" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm",
                      t.completed ? "line-through text-wa-textTertiary" : "text-wa-textPrimary"
                    )}
                  >
                    {t.title}
                  </p>
                  {t.due_at && (
                    <p
                      className={cn(
                        "text-[10px] flex items-center gap-1 mt-0.5",
                        overdue ? "text-red-400" : "text-wa-textSecondary"
                      )}
                    >
                      {overdue ? (
                        <Clock className="h-2.5 w-2.5" />
                      ) : (
                        <Calendar className="h-2.5 w-2.5" />
                      )}
                      {formatDue(t.due_at)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onDelete(t.id)}
                  className="opacity-0 group-hover:opacity-100 text-wa-textSecondary hover:text-red-400 transition-opacity"
                  aria-label="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
