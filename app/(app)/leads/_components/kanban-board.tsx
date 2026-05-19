"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KanbanColumn } from "./kanban-column";
import { LeadDetailModal } from "./lead-detail-modal";
import { updateLeadStageAction } from "../actions";
import type { LeadWithContact, PipelineStageRow } from "../types";

export function KanbanBoard({
  stages,
  leads: initialLeads,
}: {
  stages: PipelineStageRow[];
  leads: LeadWithContact[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [leads, setLeads] = useState(initialLeads);
  const [selected, setSelected] = useState<LeadWithContact | null>(null);

  useEffect(() => setLeads(initialLeads), [initialLeads]);

  // Polling pra refletir leads novos criados pelos webhooks
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 8000);
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
    <>
      <div className="flex gap-3 overflow-x-auto wa-scroll pb-3 h-full">
        {stages.map((s) => (
          <KanbanColumn
            key={s.id}
            stage={s}
            leads={byStage.get(s.id) ?? []}
            onDropLead={onDropLead}
            onClickLead={setSelected}
          />
        ))}
      </div>
      <LeadDetailModal
        lead={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
