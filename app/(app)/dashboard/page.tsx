import Link from "next/link";
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  DollarSign,
  Trophy,
  Inbox,
  MessageSquare,
  CalendarDays,
  Target,
  ExternalLink,
  Clock,
  Award,
} from "lucide-react";
import { getDashboardData, formatBRL, SOURCE_LABELS } from "./_lib/metrics";
import { KpiCard } from "./_components/kpi-card";

export const dynamic = "force-dynamic";

function displayLeadName(
  lead: { name: string | null; contact: { name: string | null; push_name: string | null; phone: string | null } | null }
): string {
  return (
    lead.name?.trim() ||
    lead.contact?.name?.trim() ||
    lead.contact?.push_name?.trim() ||
    lead.contact?.phone ||
    "Sem nome"
  );
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const { kpis, funnel, bySource, topLeads, recentLeads, attendantRanking } = data;

  const avgRespLabel = (() => {
    if (kpis.avgResponseMinutes == null) return "—";
    const m = kpis.avgResponseMinutes;
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  })();

  const maxFunnelCount = Math.max(1, ...funnel.map((f) => f.count));
  const maxSourceCount = Math.max(1, ...bySource.map((s) => s.count));

  return (
    <div className="h-full bg-wa-bg flex flex-col overflow-hidden">
      <header className="h-14 bg-wa-header flex items-center px-4 border-b border-wa-border shrink-0">
        <h1 className="font-medium text-wa-textPrimary flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4 text-primary" />
          Dashboard
        </h1>
        <span className="ml-3 text-xs text-wa-textSecondary">
          Visão geral · atualizado agora
        </span>
      </header>

      <div className="flex-1 overflow-y-auto wa-scroll">
        <div className="container max-w-7xl py-6 space-y-6">
          {/* KPIs */}
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard
              icon={<CalendarDays className="h-4 w-4" />}
              label="Leads hoje"
              value={kpis.leadsToday}
            />
            <KpiCard
              icon={<Users className="h-4 w-4" />}
              label="Leads no mês"
              value={kpis.leadsThisMonth}
              helper={`Total: ${kpis.totalLeads}`}
            />
            <KpiCard
              icon={<Target className="h-4 w-4" />}
              label="Taxa conversão"
              value={`${(kpis.conversionRate * 100).toFixed(0)}%`}
              helper={`${kpis.totalWon} ganhos / ${kpis.totalLost} perdidos`}
              accent={kpis.conversionRate >= 0.5 ? "success" : "warning"}
            />
            <KpiCard
              icon={<DollarSign className="h-4 w-4" />}
              label="Fechado no mês"
              value={formatBRL(kpis.closedValueThisMonth)}
              helper={`Total: ${formatBRL(kpis.closedValueAllTime)}`}
              accent="success"
            />
            <KpiCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Em aberto"
              value={formatBRL(kpis.estimatedValueOpen)}
              helper="Valor estimado em pipeline"
            />
            <KpiCard
              icon={<Clock className="h-4 w-4" />}
              label="Tempo médio resposta"
              value={avgRespLabel}
              helper="Últimos 30 dias"
              accent={
                kpis.avgResponseMinutes != null && kpis.avgResponseMinutes <= 10
                  ? "success"
                  : kpis.avgResponseMinutes != null && kpis.avgResponseMinutes <= 60
                    ? "warning"
                    : "default"
              }
            />
            <KpiCard
              icon={<Inbox className="h-4 w-4" />}
              label="Não lidas"
              value={kpis.unreadConversations}
              helper={`${kpis.openConversations} conversas ativas`}
              accent={kpis.unreadConversations > 0 ? "warning" : "default"}
            />
          </section>

          {/* Funil visual */}
          <section className="bg-wa-panel border border-wa-border rounded-lg p-4">
            <h2 className="text-sm font-medium text-wa-textPrimary mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Funil de vendas
            </h2>
            <div className="space-y-2">
              {funnel.map((f) => (
                <Link
                  key={f.stage.id}
                  href={`/leads`}
                  className="block hover:bg-wa-hover rounded-md p-2 -m-2 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs text-wa-textSecondary mb-1">
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: f.stage.color }}
                      />
                      <span className="text-wa-textPrimary font-medium">
                        {f.stage.name}
                      </span>
                      <span>· {f.count} leads</span>
                    </span>
                    {f.totalValue > 0 && (
                      <span className="text-emerald-400 font-medium tabular-nums">
                        {formatBRL(f.totalValue)}
                      </span>
                    )}
                  </div>
                  <div className="w-full h-2 bg-wa-bg/60 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(f.count / maxFunnelCount) * 100}%`,
                        backgroundColor: f.stage.color,
                      }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Origens */}
            <div className="bg-wa-panel border border-wa-border rounded-lg p-4">
              <h2 className="text-sm font-medium text-wa-textPrimary mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Origens dos leads
              </h2>
              {bySource.length === 0 ? (
                <p className="text-xs text-wa-textTertiary">Sem dados ainda.</p>
              ) : (
                <ul className="space-y-2">
                  {bySource.map((s) => (
                    <li key={s.source} className="text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="text-wa-textPrimary">
                          {SOURCE_LABELS[s.source] ?? s.source}
                        </span>
                        <span className="text-wa-textSecondary tabular-nums">
                          {s.count} · {formatBRL(s.estimatedValue)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-wa-bg/60 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/70 rounded-full"
                          style={{ width: `${(s.count / maxSourceCount) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Top leads em aberto por valor */}
            <div className="bg-wa-panel border border-wa-border rounded-lg p-4">
              <h2 className="text-sm font-medium text-wa-textPrimary mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                Top oportunidades em aberto
              </h2>
              {topLeads.length === 0 ? (
                <p className="text-xs text-wa-textTertiary">
                  Nenhum lead com valor estimado ainda. Defina valores no Kanban.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {topLeads.map((l) => (
                    <li
                      key={l.id}
                      className="flex items-center justify-between gap-3 p-2 rounded hover:bg-wa-hover"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-wa-textPrimary truncate">
                          {displayLeadName(l)}
                        </p>
                        <p className="text-[11px] text-wa-textSecondary">
                          {l.source ? SOURCE_LABELS[l.source] ?? l.source : "—"}
                        </p>
                      </div>
                      <span className="text-sm text-emerald-400 font-medium tabular-nums">
                        {formatBRL(Number(l.estimated_value ?? 0))}
                      </span>
                      {l.conversation_id && (
                        <Link
                          href={`/chat?c=${l.conversation_id}`}
                          className="text-wa-textSecondary hover:text-primary"
                          aria-label="Abrir conversa"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Ranking de atendentes */}
          <section className="bg-wa-panel border border-wa-border rounded-lg p-4">
            <h2 className="text-sm font-medium text-wa-textPrimary mb-3 flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-400" />
              Ranking de atendentes
            </h2>
            {attendantRanking.length === 0 ? (
              <p className="text-xs text-wa-textTertiary">
                Nenhuma conversa atribuída a atendente ainda. Vá em uma conversa → pill &ldquo;Sem atendente&rdquo; → atribua.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-wa-textSecondary">
                    <tr className="border-b border-wa-border">
                      <th className="text-left py-2 px-1 font-medium">#</th>
                      <th className="text-left py-2 px-1 font-medium">Atendente</th>
                      <th className="text-right py-2 px-1 font-medium">Conversas</th>
                      <th className="text-right py-2 px-1 font-medium">Abertos</th>
                      <th className="text-right py-2 px-1 font-medium">Ganhos</th>
                      <th className="text-right py-2 px-1 font-medium">Perdidos</th>
                      <th className="text-right py-2 px-1 font-medium">Fechado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendantRanking.map((r, i) => (
                      <tr key={r.profile.id} className="border-b border-wa-border/40 last:border-b-0">
                        <td className="py-2 px-1 text-wa-textTertiary">{i + 1}</td>
                        <td className="py-2 px-1 text-wa-textPrimary">
                          {r.profile.full_name ?? r.profile.email}
                        </td>
                        <td className="py-2 px-1 text-right tabular-nums">{r.conversations}</td>
                        <td className="py-2 px-1 text-right tabular-nums text-blue-400">
                          {r.leadsOpen}
                        </td>
                        <td className="py-2 px-1 text-right tabular-nums text-emerald-400">
                          {r.leadsWon}
                        </td>
                        <td className="py-2 px-1 text-right tabular-nums text-red-400">
                          {r.leadsLost}
                        </td>
                        <td className="py-2 px-1 text-right tabular-nums text-emerald-400 font-medium">
                          {formatBRL(r.closedValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Leads recentes */}
          <section className="bg-wa-panel border border-wa-border rounded-lg p-4">
            <h2 className="text-sm font-medium text-wa-textPrimary mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Últimos leads
            </h2>
            {recentLeads.length === 0 ? (
              <p className="text-xs text-wa-textTertiary">Sem leads ainda.</p>
            ) : (
              <ul className="divide-y divide-wa-border">
                {recentLeads.map((l) => {
                  const created = new Date(l.created_at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <li
                      key={l.id}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-wa-textPrimary truncate">
                          {displayLeadName(l)}
                        </p>
                        <p className="text-[11px] text-wa-textSecondary">
                          {created} · {l.source ? SOURCE_LABELS[l.source] ?? l.source : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            l.status === "won"
                              ? "bg-emerald-600/20 text-emerald-400"
                              : l.status === "lost"
                                ? "bg-red-600/20 text-red-400"
                                : "bg-blue-600/20 text-blue-400"
                          }`}
                        >
                          {l.status === "won" ? "Ganho" : l.status === "lost" ? "Perdido" : "Aberto"}
                        </span>
                        {l.conversation_id && (
                          <Link
                            href={`/chat?c=${l.conversation_id}`}
                            className="text-wa-textSecondary hover:text-primary"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
