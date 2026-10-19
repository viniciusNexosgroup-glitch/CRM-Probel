"use client";

import { DragEvent, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarMoeda } from "@/lib/format/moeda";
import { LeadCard } from "./lead-card";
import type { LeadWithContact, PipelineStageRow } from "../types";

export function KanbanColumn({
  stage,
  leads,
  total,
  valor,
  carregando,
  onCarregarMais,
  onDropLead,
  onClickLead,
}: {
  stage: PipelineStageRow;
  /** Cartões já carregados -- pode ser só uma parte da coluna. */
  leads: LeadWithContact[];
  /** Quantos leads a coluna tem de verdade (contado no banco). */
  total: number;
  /** Valor real da coluna inteira, não só dos cartões carregados. */
  valor: number;
  carregando: boolean;
  onCarregarMais: () => void;
  onDropLead: (leadId: string, stageId: string) => void;
  onClickLead: (lead: LeadWithContact) => void;
}) {
  const [over, setOver] = useState(false);
  const faltam = Math.max(0, total - leads.length);

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
        "w-[86vw] max-w-[320px] md:w-[300px] snap-start shrink-0 bg-wa-panel rounded-lg flex flex-col border-2 border-transparent transition-colors max-h-full",
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
            <span className="text-xs text-wa-textSecondary font-normal">({total})</span>
          </h3>
          {valor > 0 && (
            <p className="text-[11px] text-emerald-400 mt-0.5">{formatarMoeda(valor)}</p>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto wa-scroll p-2 space-y-2 min-h-32">
        {leads.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-wa-textTertiary py-8">
            Solte cards aqui
          </div>
        ) : (
          <>
            {leads.map((l) => (
              <LeadCard key={l.id} lead={l} onClick={() => onClickLead(l)} />
            ))}
            {faltam > 0 && (
              <button
                onClick={onCarregarMais}
                disabled={carregando}
                className="w-full py-2 rounded-md border border-dashed border-wa-border text-xs text-wa-textSecondary hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {carregando ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
                  </>
                ) : (
                  `Carregar mais (${faltam} restantes)`
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
