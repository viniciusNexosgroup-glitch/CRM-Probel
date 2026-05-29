"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_LEAD_SOURCES, slugifySource, type LeadSource } from "@/lib/lead-sources";
import { saveLeadSourcesAction } from "../actions";

export function SourcesManager({ initial }: { initial: LeadSource[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<LeadSource[]>(initial);
  const [pending, startTransition] = useTransition();

  function setLabel(i: number, label: string) {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        // se o value estava vazio ou era um slug do label antigo, regenera
        const wasAuto = !r.value || r.value === slugifySource(r.label);
        return { label, value: wasAuto ? slugifySource(label) : r.value };
      })
    );
  }

  function addRow() {
    setRows((prev) => [...prev, { value: "", label: "" }]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function onSave() {
    startTransition(async () => {
      const res = await saveLeadSourcesAction(rows);
      if (res.ok) {
        toast.success("Origens salvas");
        router.refresh();
      } else {
        toast.error("Falha", { description: res.error });
      }
    });
  }

  function restoreDefaults() {
    if (!confirm("Restaurar as origens padrão? Suas customizações serão substituídas.")) return;
    setRows(DEFAULT_LEAD_SOURCES);
  }

  return (
    <div className="space-y-3">
      <ul className="rounded-lg border border-border overflow-hidden divide-y divide-border bg-card">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-2 px-3 py-2">
            <Input
              value={r.label}
              onChange={(e) => setLabel(i, e.target.value)}
              placeholder="Nome visível (ex: Feira)"
              className="h-8 text-sm flex-1"
            />
            <code className="text-[11px] text-wa-textTertiary w-32 truncate" title={r.value}>
              {r.value || "—"}
            </code>
            <button
              onClick={() => removeRow(i)}
              title="Remover"
              className="p-1.5 rounded text-wa-textSecondary hover:text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="px-3 py-4 text-sm text-wa-textTertiary text-center">Nenhuma origem.</li>
        )}
      </ul>

      <div className="flex items-center justify-between">
        <button
          onClick={addRow}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <Plus className="h-4 w-4" /> Adicionar origem
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={restoreDefaults}
            className="inline-flex items-center gap-1.5 text-xs text-wa-textSecondary hover:text-wa-textPrimary"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
          </button>
          <Button onClick={onSave} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
