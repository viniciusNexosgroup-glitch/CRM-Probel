"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  GripVertical,
  Trophy,
  XCircle,
  Loader2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createStageAction,
  updateStageAction,
  deleteStageAction,
  reorderStagesAction,
} from "../actions";
import type { Database } from "@/types/database";

type Stage = Database["public"]["Tables"]["pipeline_stages"]["Row"];

const COLORS = [
  "#3b82f6", "#06b6d4", "#8b5cf6", "#ec4899",
  "#f59e0b", "#10b981", "#ef4444", "#6b7280",
];

export function StagesEditor({ initial }: { initial: Stage[] }) {
  const router = useRouter();
  const [stages, setStages] = useState(initial);
  const [, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [pendingId, setPendingId] = useState<string | null>(null);

  function setField(id: string, key: keyof Stage, value: unknown) {
    setStages((arr) => arr.map((s) => (s.id === id ? { ...s, [key]: value } : s)));
  }

  function saveStage(s: Stage) {
    setPendingId(s.id);
    startTransition(async () => {
      const res = await updateStageAction(s.id, {
        name: s.name,
        color: s.color,
        is_won: s.is_won,
        is_lost: s.is_lost,
      });
      setPendingId(null);
      if (res.ok) {
        toast.success("Estágio atualizado");
        router.refresh();
      } else {
        toast.error("Falha", { description: res.error });
      }
    });
  }

  function onCreate() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const res = await createStageAction(newName, newColor);
      if (res.ok) {
        toast.success("Estágio criado");
        setNewName("");
        router.refresh();
      } else {
        toast.error("Falha", { description: res.error });
      }
    });
  }

  function onDelete(s: Stage) {
    if (!confirm(`Excluir o estágio "${s.name}"?`)) return;
    setPendingId(s.id);
    startTransition(async () => {
      const res = await deleteStageAction(s.id);
      setPendingId(null);
      if (res.ok) {
        toast.success("Estágio removido");
        router.refresh();
      } else {
        toast.error("Não foi possível remover", { description: res.error });
      }
    });
  }

  function move(id: string, direction: -1 | 1) {
    const idx = stages.findIndex((s) => s.id === id);
    const target = idx + direction;
    if (target < 0 || target >= stages.length) return;
    const next = [...stages];
    [next[idx], next[target]] = [next[target], next[idx]];
    setStages(next);
    startTransition(async () => {
      const res = await reorderStagesAction(next.map((s) => s.id));
      if (res.ok) {
        router.refresh();
      } else {
        toast.error("Falha ao reordenar", { description: res.error });
        setStages(initial);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Lista */}
      <div className="space-y-2">
        {stages.map((s, i) => {
          const busy = pendingId === s.id;
          return (
            <div
              key={s.id}
              className="bg-card border border-border rounded-lg p-3 flex items-center gap-3"
            >
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => move(s.id, -1)}
                  disabled={i === 0 || busy}
                  className="text-wa-textSecondary hover:text-primary disabled:opacity-20"
                  title="Subir"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => move(s.id, 1)}
                  disabled={i === stages.length - 1 || busy}
                  className="text-wa-textSecondary hover:text-primary disabled:opacity-20"
                  title="Descer"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <GripVertical className="h-4 w-4 text-wa-textTertiary shrink-0" />

              <input
                type="color"
                value={s.color}
                onChange={(e) => setField(s.id, "color", e.target.value)}
                onBlur={() => saveStage(stages.find((x) => x.id === s.id)!)}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
              />

              <Input
                value={s.name}
                onChange={(e) => setField(s.id, "name", e.target.value)}
                onBlur={() => saveStage(stages.find((x) => x.id === s.id)!)}
                className="flex-1 h-9"
                placeholder="Nome do estágio"
              />

              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setField(s.id, "is_won", !s.is_won);
                    setField(s.id, "is_lost", false);
                    saveStage({ ...s, is_won: !s.is_won, is_lost: false });
                  }}
                  className={cn(
                    "px-2 py-1 rounded text-xs flex items-center gap-1 border",
                    s.is_won
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                      : "border-wa-border text-wa-textSecondary hover:bg-wa-hover"
                  )}
                  title="Marcar como estágio de vitória"
                >
                  <Trophy className="h-3 w-3" /> Ganho
                </button>
                <button
                  onClick={() => {
                    setField(s.id, "is_lost", !s.is_lost);
                    setField(s.id, "is_won", false);
                    saveStage({ ...s, is_lost: !s.is_lost, is_won: false });
                  }}
                  className={cn(
                    "px-2 py-1 rounded text-xs flex items-center gap-1 border",
                    s.is_lost
                      ? "bg-red-500/20 text-red-400 border-red-500/40"
                      : "border-wa-border text-wa-textSecondary hover:bg-wa-hover"
                  )}
                  title="Marcar como estágio de perda"
                >
                  <XCircle className="h-3 w-3" /> Perdido
                </button>
              </div>

              <button
                onClick={() => onDelete(s)}
                disabled={busy}
                className="p-1.5 rounded hover:bg-red-500/10 text-wa-textSecondary hover:text-red-400"
                title="Excluir"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Adicionar novo */}
      <div className="bg-card/40 border border-dashed border-border rounded-lg p-3 flex items-center gap-3">
        <Plus className="h-4 w-4 text-primary" />
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setNewColor(c)}
              className={cn(
                "w-6 h-6 rounded-full border-2",
                newColor === c ? "border-white" : "border-transparent"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onCreate()}
          placeholder="Nome do novo estágio…"
          className="flex-1 h-9"
        />
        <Button onClick={onCreate} disabled={!newName.trim()}>
          Adicionar
        </Button>
      </div>
    </div>
  );
}
