import {
  Bot,
  Plus,
  PlayCircle,
  Workflow,
  AlertTriangle,
  BarChart3,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { salesbotDb } from "@/lib/salesbot/db";
import type { SalesbotFlow, SalesbotStats } from "@/lib/salesbot/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createSalesbotFlowAction } from "./actions";
import { FlowRow } from "./_components/flow-row";

export const dynamic = "force-dynamic";

type PageData = {
  flows: SalesbotFlow[];
  stats: SalesbotStats;
  migrationMissing: boolean;
};

async function getPageData(): Promise<PageData> {
  const supabase = await createClient();
  const db = salesbotDb(supabase);

  const [flowsRes, execRes] = await Promise.all([
    db
      .from("salesbot_flows")
      .select("*")
      .neq("status", "archived")
      .order("updated_at", { ascending: false }),
    db.from("salesbot_executions").select("id, status, variables"),
  ]);

  if (flowsRes.error?.code === "42P01" || execRes.error?.code === "42P01") {
    return {
      flows: [],
      stats: {
        totalExecutions: 0,
        completedExecutions: 0,
        failedExecutions: 0,
        humanHandoffs: 0,
      },
      migrationMissing: true,
    };
  }

  const executions = execRes.data ?? [];
  return {
    flows: (flowsRes.data ?? []) as SalesbotFlow[],
    stats: {
      totalExecutions: executions.length,
      completedExecutions: executions.filter((e: { status: string }) => e.status === "completed").length,
      failedExecutions: executions.filter((e: { status: string }) => e.status === "failed").length,
      humanHandoffs: executions.filter((e: { variables?: { handoff?: unknown } }) => Boolean(e.variables?.handoff)).length,
    },
    migrationMissing: false,
  };
}

export default async function SalesbotPage() {
  const { flows, stats, migrationMissing } = await getPageData();

  return (
    <div className="h-full bg-wa-bg flex flex-col overflow-hidden">
      <header className="h-14 bg-wa-header flex items-center justify-between px-4 border-b border-wa-border shrink-0">
        <h1 className="font-medium text-wa-textPrimary flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          SalesBot
        </h1>
        <span className="text-xs text-wa-textSecondary">Automações comerciais</span>
      </header>

      <div className="flex-1 overflow-y-auto wa-scroll">
        <div className="container max-w-7xl py-6 space-y-6">
          {migrationMissing && (
            <section className="border border-amber-500/30 bg-amber-500/10 rounded-lg p-4 text-sm text-amber-200 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Migration do SalesBot ainda não foi aplicada.</p>
                <p className="text-amber-200/80">
                  Rode <span className="font-mono">npm.cmd run migrate</span> para criar as tabelas
                  <span className="font-mono"> salesbot_*</span> antes de salvar fluxos.
                </p>
              </div>
            </section>
          )}

          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-wa-panel border border-wa-border rounded-lg p-4">
              <div className="flex items-center justify-between text-wa-textSecondary">
                <span className="text-xs">Execuções</span>
                <BarChart3 className="h-4 w-4" />
              </div>
              <p className="text-2xl font-semibold text-wa-textPrimary mt-2">{stats.totalExecutions}</p>
            </div>
            <div className="bg-wa-panel border border-wa-border rounded-lg p-4">
              <div className="flex items-center justify-between text-wa-textSecondary">
                <span className="text-xs">Concluídas</span>
                <PlayCircle className="h-4 w-4" />
              </div>
              <p className="text-2xl font-semibold text-emerald-400 mt-2">{stats.completedExecutions}</p>
            </div>
            <div className="bg-wa-panel border border-wa-border rounded-lg p-4">
              <div className="flex items-center justify-between text-wa-textSecondary">
                <span className="text-xs">Transferências</span>
                <Users className="h-4 w-4" />
              </div>
              <p className="text-2xl font-semibold text-sky-400 mt-2">{stats.humanHandoffs}</p>
            </div>
            <div className="bg-wa-panel border border-wa-border rounded-lg p-4">
              <div className="flex items-center justify-between text-wa-textSecondary">
                <span className="text-xs">Erros</span>
                <AlertTriangle className="h-4 w-4" />
              </div>
              <p className="text-2xl font-semibold text-red-400 mt-2">{stats.failedExecutions}</p>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
            <form action={createSalesbotFlowAction} className="bg-wa-panel border border-wa-border rounded-lg p-4 space-y-3">
              <div>
                <h2 className="text-sm font-medium text-wa-textPrimary flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" />
                  Novo fluxo
                </h2>
                <p className="text-xs text-wa-textSecondary mt-1">
                  Comece com um rascunho e monte os blocos no editor.
                </p>
              </div>
              <Input name="name" placeholder="Ex: Qualificação WhatsApp" disabled={migrationMissing} />
              <Input name="description" placeholder="Descrição curta" disabled={migrationMissing} />
              <Select name="channel" defaultValue="whatsapp" disabled={migrationMissing}>
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram Direct</option>
                <option value="facebook">Facebook Messenger</option>
                <option value="webchat">Webchat</option>
                <option value="multi">Multi-canal</option>
              </Select>
              <Button type="submit" className="w-full" disabled={migrationMissing}>
                <Plus className="h-4 w-4" />
                Criar fluxo
              </Button>
            </form>

            <div className="bg-wa-panel border border-wa-border rounded-lg overflow-hidden">
              <div className="h-11 px-4 border-b border-wa-border flex items-center justify-between">
                <h2 className="text-sm font-medium text-wa-textPrimary flex items-center gap-2">
                  <Workflow className="h-4 w-4 text-primary" />
                  Fluxos
                </h2>
                <span className="text-xs text-wa-textSecondary">{flows.length} cadastrados</span>
              </div>
              <div className="divide-y divide-wa-border">
                {flows.length === 0 ? (
                  <div className="p-8 text-center text-sm text-wa-textSecondary">
                    Nenhum fluxo criado ainda.
                  </div>
                ) : (
                  flows.map((flow) => <FlowRow key={flow.id} flow={flow} />)
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
