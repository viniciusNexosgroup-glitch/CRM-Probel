"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTagAction, updateTagAction, deleteTagAction } from "../actions";

type TagItem = { id: string; name: string; color: string; count: number };

const PALETTE = [
  "#ef4444", "#f59e0b", "#eab308", "#22c55e", "#10b981",
  "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#64748b",
];

export function TagsManager({ initial }: { initial: TagItem[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[6]);

  function onCreate() {
    if (!newName.trim()) return;
    setBusyId("new");
    startTransition(async () => {
      const res = await createTagAction(newName, newColor);
      setBusyId(null);
      if (res.ok) {
        setNewName("");
        toast.success("Etiqueta criada");
        router.refresh();
      } else {
        toast.error("Falha", { description: res.error });
      }
    });
  }

  function onSave(t: TagItem, name: string, color: string) {
    if (name === t.name && color === t.color) return;
    setBusyId(t.id);
    startTransition(async () => {
      const res = await updateTagAction(t.id, name, color);
      setBusyId(null);
      if (res.ok) {
        toast.success("Etiqueta atualizada");
        router.refresh();
      } else {
        toast.error("Falha", { description: res.error });
      }
    });
  }

  function onDelete(t: TagItem) {
    if (!confirm(`Excluir a etiqueta "${t.name}"? Ela some de ${t.count} lead(s).`)) return;
    setBusyId(t.id);
    startTransition(async () => {
      const res = await deleteTagAction(t.id);
      setBusyId(null);
      if (res.ok) {
        toast.success("Etiqueta excluída");
        router.refresh();
      } else {
        toast.error("Falha", { description: res.error });
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Criar */}
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="text-xs font-medium text-wa-textSecondary uppercase tracking-wide mb-2">
          Nova etiqueta
        </p>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-9 w-9 rounded cursor-pointer bg-transparent border border-border shrink-0"
            title="Cor"
          />
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onCreate()}
            placeholder="Nome da etiqueta…"
            className="h-9"
          />
          <Button onClick={onCreate} disabled={busyId === "new" || !newName.trim()}>
            {busyId === "new" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setNewColor(c)}
              className="w-5 h-5 rounded-full border border-white/10"
              style={{ backgroundColor: c, outline: newColor === c ? "2px solid white" : "none" }}
              aria-label={`Cor ${c}`}
            />
          ))}
        </div>
      </div>

      {/* Lista */}
      {initial.length === 0 ? (
        <p className="text-sm text-wa-textTertiary py-6 text-center">Nenhuma etiqueta ainda.</p>
      ) : (
        <ul className="rounded-lg border border-border overflow-hidden divide-y divide-border bg-card">
          {initial.map((t) => (
            <TagRow key={t.id} tag={t} busy={busyId === t.id} onSave={onSave} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TagRow({
  tag,
  busy,
  onSave,
  onDelete,
}: {
  tag: TagItem;
  busy: boolean;
  onSave: (t: TagItem, name: string, color: string) => void;
  onDelete: (t: TagItem) => void;
}) {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const dirty = name !== tag.name || color !== tag.color;

  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        className="h-7 w-7 rounded cursor-pointer bg-transparent border border-border shrink-0"
        title="Cor"
      />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8 text-sm flex-1"
      />
      <span className="text-[11px] text-wa-textTertiary shrink-0 w-16 text-right">
        {tag.count} lead{tag.count === 1 ? "" : "s"}
      </span>
      <button
        onClick={() => onSave(tag, name, color)}
        disabled={busy || !dirty}
        title="Salvar"
        className="p-1.5 rounded text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-30"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </button>
      <button
        onClick={() => onDelete(tag)}
        disabled={busy}
        title="Excluir"
        className="p-1.5 rounded text-wa-textSecondary hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
