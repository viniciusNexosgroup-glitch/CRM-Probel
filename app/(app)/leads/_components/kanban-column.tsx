"use client";

import { DragEvent, useState } from "react";
import { cn } from "@/lib/utils";
import { LeadCard } from "./lead-card";
import type { LeadWithContact, PipelineStageRow } from "../types";

export function KanbanColumn({
  stage,
  leads,
  onDropLead,
  onClickLead,
}: {
  stage: PipelineStageRow;
  leads: LeadWithContact[];
  onDropLead: (leadId: string, stageId: string) => void;
  onClickLead: (lead: LeadWithContact) => void;
}) {
  const [over, setOver] = useState(false);

  const totalValue = leads.reduce((sum, l) => {
    const v = stage.is_won ? l.closed_value : l.estimated_value;
    return sum + (v ?? 0);
  }, 0);

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!over) setOver(true);
  }
  function handleDragLeave() {
    setOver(false);
  }
  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setOver(false);
    const leadId = e.dataTransfer.getData("text/plain");
    if (leadId) onDropLead(leadId, stage.id);
  }

  return (
    <div
      className={cn(
        "w-[300px] shrink-0 bg-wa-panel rounded-lg flex flex-col border-2 border-transparent transition-colors max-h-full",
        over && "border-primary/60 bg-wa-active"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header
        className="px-3 py-2.5 border-b border-wa-border flex items-center justify-between shrink-0"
        style={{ borderTopColor: stage.color, borderTopWidth: 3, borderTopStyle: "solid" }}
      >
        <div>
          <h3 className="font-medium text-sm text-wa-textPrimary flex items-center gap-2">
            {stage.name}
            <span className="text-xs text-wa-textSecondary font-normal">({leads.length})</span>
          </h3>
          {totalValue > 0 && (
            <p className="text-[11px] text-emerald-400 mt-0.5">
              {totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto wa-scroll p-2 space-y-2 min-h-32">
        {leads.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-wa-textTertiary py-8">
            Solte cards aqui
          </div>
        ) : (
          leads.map((l) => (
            <LeadCard key={l.id} lead={l} onClick={() => onClickLead(l)} />
          ))
        )}
      </div>
    </div>
  );
}
