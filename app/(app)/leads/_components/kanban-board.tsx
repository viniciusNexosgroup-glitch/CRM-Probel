"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KanbanColumn } from "./kanban-column";
import { LeadDetailModal } from "./lead-detail-modal";
import { updateLeadStageAction } from "../actions";
import type { LeadWithContact, PipelineStageRow } from "../types";

type Board = { value: string; label: string; ownerId: string | null };

export function KanbanBoard({
  stages,
  leads: initialLeads,
  isAdmin = false,
  boards = [],
  selectedValue,
}: {
  stages: PipelineStageRow[];
  leads: LeadWithContact[];
  isAdmin?: boolean;
  boards?: Board[];
  selectedValue?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [leads, setLeads] = useState(initialLeads);
  const [selected, setSelected] = useState<LeadWithContact | null>(null);

  useEffect(() => setLeads(initialLeads), [initialLeads]);

  // Polling pra refletir leads novos criados pelos webhooks
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(id);
  }, [router]);

  const byStage = useMemo(() => {
    const map = new Map<string, LeadWithContact[]>();
    for (const s of stages) map.set(s.id, []);
    for (const l of leads) {
      if (!l.stage_id) continue;
      const arr = map.get(l.stage_id);
      if (arr) arr.push(l);
    }
    return map;
  }, [leads, stages]);

  function onDropLead(leadId: string, stageId: string) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage_id === stageId) return;

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage_id: stageId } : l))
    );

    startTransition(async () => {
      const res = await updateLeadStageAction(leadId, stageId);
      if (!res.ok) {
        toast.error("Falha ao mover lead", { description: res.error });
        // Reverte
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, stage_id: lead.stage_id } : l))
        );
      } else {
        const stage = stages.find((s) => s.id === stageId);
        toast.success(`Movido para "${stage?.name}"`);
      }
    });
  }

  return (
    <div className="h-full flex flex-col">
      {isAdmin && boards.length > 0 && (
        <div className="flex items-center gap-2 pb-2 shrink-0">
          <span className="text-xs text-wa-textSecondary">Funil de:</span>
          <select
            value={selectedValue}
            onChange={(e) => router.push(`/leads?board=${e.target.value}`)}
            className="h-8 text-xs rounded-md bg-wa-panel border border-wa-border px-2 text-wa-textPrimary focus:outline-none focus:border-primary/40"
          >
            {boards.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex gap-3 overflow-x-auto wa-scroll pb-3 flex-1 min-h-0 snap-x snap-mandatory md:snap-none">
        {stages.length === 0 ? (
          <div className="text-sm text-wa-textSecondary p-4">
            Nenhuma coluna neste funil ainda.
          </div>
        ) : (
          stages.map((s) => (
            <KanbanColumn
              key={s.id}
              stage={s}
              leads={byStage.get(s.id) ?? []}
              onDropLead={onDropLead}
              onClickLead={setSelected}
            />
          ))
        )}
      </div>
      <LeadDetailModal
        lead={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
