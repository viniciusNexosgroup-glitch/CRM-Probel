"use client";

import { useState, useTransition, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KanbanColumn } from "./kanban-column";
import { LeadDetailModal } from "./lead-detail-modal";
import { carregarMaisLeadsAction, updateLeadStageAction } from "../actions";
import { acaoSegura } from "@/lib/ui/acao-segura";
import type { LeadWithContact, PipelineStageRow, TotaisColuna } from "../types";

type Board = { value: string; label: string; ownerId: string | null };

/**
 * Recarga automática do quadro, para trazer leads novos dos webhooks.
 *
 * Era a cada 15 s, sempre -- e cada recarga refazia o quadro inteiro no
 * servidor. Com o quadro da Ticiany aberto, eram 1.000 cartões consultados e
 * serializados quatro vezes por minuto, por aba, pesando na VPS para todos.
 * Agora: a cada minuto, só com a aba visível, e ao voltar para a aba.
 */
const RECARGA_MS = 60_000;

/** Quanto um lead soma no valor da coluna: ganho conta o fechado; o resto, o estimado. */
function contribuicao(lead: LeadWithContact, stage: PipelineStageRow | undefined): number {
  if (!stage) return 0;
  return Number((stage.is_won ? lead.closed_value : lead.estimated_value) ?? 0);
}

export function KanbanBoard({
  stages,
  leads: initialLeads,
  totais: initialTotais,
  donoId,
  isAdmin = false,
  boards = [],
  selectedValue,
}: {
  stages: PipelineStageRow[];
  leads: LeadWithContact[];
  totais: Record<string, TotaisColuna>;
  donoId: string | null;
  isAdmin?: boolean;
  boards?: Board[];
  selectedValue?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [leads, setLeads] = useState(initialLeads);
  const [totais, setTotais] = useState(initialTotais);
  const [selected, setSelected] = useState<LeadWithContact | null>(null);
  const [carregandoColuna, setCarregandoColuna] = useState<string | null>(null);
  // Depois de carregar mais, a recarga automática devolveria só o primeiro
  // lote de cada coluna -- o vendedor perderia o que acabou de abrir.
  const carregouMais = useRef(false);

  useEffect(() => {
    setLeads(initialLeads);
    setTotais(initialTotais);
  }, [initialLeads, initialTotais]);

  useEffect(() => {
    function recarregar() {
      if (document.visibilityState !== "visible" || carregouMais.current) return;
      router.refresh();
    }
    const id = setInterval(recarregar, RECARGA_MS);
    document.addEventListener("visibilitychange", recarregar);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", recarregar);
    };
  }, [router]);

  const stagePorId = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

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

  async function carregarMais(stageId: string) {
    if (carregandoColuna) return;
    setCarregandoColuna(stageId);
    const jaCarregados = byStage.get(stageId)?.length ?? 0;
    const res = await acaoSegura(() => carregarMaisLeadsAction(stageId, donoId, jaCarregados));
    setCarregandoColuna(null);
    if (!res.ok) {
      toast.error("Não consegui carregar mais leads", { description: res.error });
      return;
    }
    carregouMais.current = true;
    setLeads((prev) => {
      const existentes = new Set(prev.map((l) => l.id));
      return [...prev, ...res.leads.filter((l) => !existentes.has(l.id))];
    });
  }

  /** Move um lead entre colunas nos totais (sinal -1 desfaz). */
  function ajustarTotais(lead: LeadWithContact, de: string, para: string, sinal: 1 | -1) {
    setTotais((t) => {
      const novo = { ...t };
      const origem = novo[de] ?? { total: 0, valor: 0 };
      const destino = novo[para] ?? { total: 0, valor: 0 };
      novo[de] = {
        total: origem.total - sinal,
        valor: origem.valor - sinal * contribuicao(lead, stagePorId.get(de)),
      };
      novo[para] = {
        total: destino.total + sinal,
        valor: destino.valor + sinal * contribuicao(lead, stagePorId.get(para)),
      };
      return novo;
    });
  }

  function onDropLead(leadId: string, stageId: string) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || !lead.stage_id || lead.stage_id === stageId) return;
    const origem = lead.stage_id;

    // Otimista: move o cartão e os totais na hora.
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage_id: stageId } : l)));
    ajustarTotais(lead, origem, stageId, 1);

    startTransition(async () => {
      const res = await acaoSegura(() => updateLeadStageAction(leadId, stageId));
      if (!res.ok) {
        toast.error("Falha ao mover lead", { description: res.error });
        setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage_id: origem } : l)));
        ajustarTotais(lead, origem, stageId, -1);
      } else {
        toast.success(`Movido para "${stagePorId.get(stageId)?.name}"`);
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
              total={totais[s.id]?.total ?? 0}
              valor={totais[s.id]?.valor ?? 0}
              carregando={carregandoColuna === s.id}
              onCarregarMais={() => carregarMais(s.id)}
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
