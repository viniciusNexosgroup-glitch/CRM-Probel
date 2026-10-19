import { KanbanSquare } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { KanbanBoard } from "./_components/kanban-board";
import {
  LOTE_KANBAN,
  ORDEM_KANBAN,
  SELECT_LEAD_CARTAO,
  type LeadWithContact,
  type PipelineStageRow,
  type TotaisColuna,
} from "./types";

export const dynamic = "force-dynamic";

type Board = { value: string; label: string; ownerId: string | null };

async function getStages(ownerId: string | null): Promise<PipelineStageRow[]> {
  const supabase = await createClient();
  let q = supabase.from("pipeline_stages").select("*").order("position", { ascending: true });
  q = ownerId === null ? q.is("user_id", null) : q.eq("user_id", ownerId);
  const { data } = await q;
  return data ?? [];
}

/** Total real e valor de cada coluna do quadro, contados no banco. */
async function getTotais(ownerId: string | null): Promise<Record<string, TotaisColuna>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("kanban_colunas", { p_dono: ownerId });
  if (error) {
    console.error("[leads] totais por coluna:", error.message);
    return {};
  }
  const totais: Record<string, TotaisColuna> = {};
  for (const linha of (data ?? []) as { stage_id: string; total: number; valor: number }[]) {
    totais[linha.stage_id] = { total: Number(linha.total), valor: Number(linha.valor) };
  }
  return totais;
}

/**
 * Primeiro lote de cartões de cada coluna.
 *
 * Uma consulta por coluna, todas ao mesmo tempo. Só pergunta pelas colunas que
 * têm leads: as vazias já se sabem vazias pelos totais.
 */
async function getPrimeirosLotes(
  stages: PipelineStageRow[],
  totais: Record<string, TotaisColuna>,
  ownerId: string | null
): Promise<LeadWithContact[]> {
  const supabase = await createClient();
  const comLeads = stages.filter((s) => (totais[s.id]?.total ?? 0) > 0);
  const lotes = await Promise.all(
    comLeads.map((s) => {
      let q = supabase
        .from("leads")
        .select(SELECT_LEAD_CARTAO)
        .eq("stage_id", s.id);
      for (const o of ORDEM_KANBAN) q = q.order(o.coluna, { ascending: o.ascending });
      q = q.limit(LOTE_KANBAN);
      q = ownerId === null ? q.is("assigned_to", null) : q.eq("assigned_to", ownerId);
      return q;
    })
  );
  return lotes.flatMap((r) => (r.data ?? []) as unknown as LeadWithContact[]);
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const isAdmin = profile.role === "admin";

  let boards: Board[];
  if (isAdmin) {
    const { data: users } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name", { ascending: true });
    boards = [
      ...(users ?? []).map((u) => ({
        value: u.id,
        label: (u.full_name ?? u.email ?? "Usuário") + (u.id === profile.id ? " (você)" : ""),
        ownerId: u.id as string | null,
      })),
      { value: "none", label: "Sem vendedor", ownerId: null },
    ];
  } else {
    boards = [{ value: profile.id, label: "Meu funil", ownerId: profile.id }];
  }

  const sp = await searchParams;
  const selectedValue =
    boards.find((b) => b.value === sp.board)?.value ??
    boards.find((b) => b.ownerId === profile.id)?.value ??
    boards[0].value;
  const selectedOwnerId = boards.find((b) => b.value === selectedValue)!.ownerId;

  const [stages, totais] = await Promise.all([
    getStages(selectedOwnerId),
    getTotais(selectedOwnerId),
  ]);
  const leads = await getPrimeirosLotes(stages, totais, selectedOwnerId);
  // O total do cabeçalho é o real, não o número de cartões carregados.
  const totalDoQuadro = stages.reduce((soma, s) => soma + (totais[s.id]?.total ?? 0), 0);

  return (
    <div className="h-full bg-wa-bg flex flex-col">
      <header className="h-14 bg-wa-header flex items-center justify-between px-4 border-b border-wa-border shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="font-medium text-wa-textPrimary flex items-center gap-2">
            <KanbanSquare className="h-4 w-4 text-primary" /> Funil de Leads
          </h1>
          <span className="text-xs text-wa-textSecondary">
            {totalDoQuadro} {totalDoQuadro === 1 ? "lead" : "leads"}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-hidden px-3 pt-3">
        <KanbanBoard
          stages={stages}
          leads={leads}
          totais={totais}
          donoId={selectedOwnerId}
          isAdmin={isAdmin}
          boards={boards}
          selectedValue={selectedValue}
        />
      </div>
    </div>
  );
}
