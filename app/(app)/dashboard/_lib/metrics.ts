import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { parseLeadSources, sourceLabelMap } from "@/lib/lead-sources";

import { formatarMoeda } from "@/lib/format/moeda";
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type StageRow = Database["public"]["Tables"]["pipeline_stages"]["Row"];

export type DashboardData = {
  kpis: {
    leadsToday: number;
    leadsThisMonth: number;
    totalLeads: number;
    totalWon: number;
    totalLost: number;
    conversionRate: number; // 0–1
    estimatedValueOpen: number;
    closedValueAllTime: number;
    closedValueThisMonth: number;
    openConversations: number;
    unreadConversations: number;
    avgResponseMinutes: number | null;
  };
  funnel: {
    stage: StageRow;
    count: number;
    totalValue: number;
  }[];
  bySource: { source: string; count: number; won: number; conversionRate: number; estimatedValue: number }[];
  sourceLabels: Record<string, string>;
  stalled: {
    count: number;
    items: {
      conversationId: string;
      name: string | null;
      phone: string | null;
      lastText: string | null;
      lastAt: string;
    }[];
  };
  topLeads: (LeadRow & { contact: { name: string | null; push_name: string | null; phone: string | null } | null })[];
  recentLeads: (LeadRow & { contact: { name: string | null; push_name: string | null; phone: string | null } | null })[];
  attendantRanking: {
    profile: { id: string; full_name: string | null; email: string | null };
    conversations: number;
    leadsOpen: number;
    leadsWon: number;
    leadsLost: number;
    closedValue: number;
  }[];
};

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

/** Formato do que `dashboard_resumo` devolve (ver migração 0029). */
type Resumo = {
  kpis: {
    totalLeads: number;
    totalWon: number;
    totalLost: number;
    estimatedValueOpen: number;
    closedValueAllTime: number;
    closedValueThisMonth: number;
    leadsToday: number;
    leadsThisMonth: number;
  };
  conversas: { openConversations: number; unreadConversations: number };
  funil: { stage: StageRow; count: number; totalValue: number }[];
  origens: { source: string; count: number; won: number; estimatedValue: number }[];
  porVendedor: Record<string, { open: number; won: number; lost: number; closedValue: number }>;
  conversasPorVendedor: Record<string, number>;
};

type ContatoResumido = { name: string | null; push_name: string | null; phone: string | null };

/**
 * Dados do Dashboard.
 *
 * Antes, trazia todos os leads da loja (com o contato de cada um) e somava aqui.
 * Era lento -- na Probel, 979 KB e 385 ms numa única consulta -- e estava
 * ERRADO: o PostgREST devolve no máximo 1.000 linhas, e a Probel tem mais de
 * 2.800 leads e conversas. Total, conversão, valores, funil, origens e ranking
 * saíam calculados sobre uma parte da loja, sem aviso.
 *
 * Agora o banco soma tudo (`dashboard_resumo`) e devolve só os resultados, e
 * as listas curtas (top 5, últimos 8, parados) vêm já cortadas. Tudo sai numa
 * leva só: nenhuma consulta depende de outra.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const paradosDesde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const comContato = "*, contact:contacts!leads_contact_id_fkey(name, push_name, phone)";

  const [
    resumoRes,
    paradosTotalRes,
    paradosRes,
    { data: srcSetting },
    { data: profiles },
    { data: tempoRespostaSalvo },
    topLeadsRes,
    recentLeadsRes,
  ] = await Promise.all([
    supabase.rpc("dashboard_resumo", {
      p_inicio_dia: startOfDay(),
      p_inicio_mes: startOfMonth(),
    }),
    // Conversas em que o cliente foi o último a falar há mais de 24h. O total é
    // contado à parte: antes vinha do tamanho de uma lista limitada a 100, então
    // nunca passava de 100 mesmo quando havia mais.
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("last_message_from_me", false)
      .eq("is_archived", false)
      .lt("last_message_at", paradosDesde),
    supabase
      .from("conversations")
      .select(
        "id, last_message_at, last_message_text, contact:contacts!conversations_contact_id_fkey(name, push_name, phone)"
      )
      .eq("last_message_from_me", false)
      .eq("is_archived", false)
      .lt("last_message_at", paradosDesde)
      .order("last_message_at", { ascending: true })
      .limit(8),
    supabase.from("settings").select("value").eq("key", "lead_sources").maybeSingle(),
    supabase.from("profiles").select("id, full_name, email"),
    // Calculado pela rotina diária. A regra de acesso já limita à loja do
    // usuário, então não precisa descobrir a loja antes de buscar.
    supabase.from("settings").select("value").eq("key", "tempo_resposta_cache").maybeSingle(),
    supabase
      .from("leads")
      .select(comContato)
      .eq("status", "open")
      .gt("estimated_value", 0)
      .order("estimated_value", { ascending: false })
      .limit(5),
    supabase.from("leads").select(comContato).order("created_at", { ascending: false }).limit(8),
  ]);

  if (resumoRes.error) throw new Error(`Dashboard: ${resumoRes.error.message}`);
  const r = resumoRes.data as unknown as Resumo;
  const n = (v: unknown) => Number(v ?? 0);

  const totalWon = n(r.kpis.totalWon);
  const totalLost = n(r.kpis.totalLost);
  const totalClosed = totalWon + totalLost;

  const funnel = (r.funil ?? []).map((f) => ({
    stage: f.stage,
    count: n(f.count),
    totalValue: n(f.totalValue),
  }));

  const bySource = (r.origens ?? []).map((o) => ({
    source: o.source,
    count: n(o.count),
    won: n(o.won),
    estimatedValue: n(o.estimatedValue),
    conversionRate: n(o.count) > 0 ? n(o.won) / n(o.count) : 0,
  }));

  const sourceLabels = sourceLabelMap(parseLeadSources(srcSetting?.value));

  const stalled = {
    count: paradosTotalRes.count ?? 0,
    items: (paradosRes.data ?? []).map((c) => {
      const ct = c.contact as unknown as ContatoResumido | null;
      return {
        conversationId: c.id as string,
        name: ct?.name ?? ct?.push_name ?? null,
        phone: ct?.phone ?? null,
        lastText: c.last_message_text ?? null,
        lastAt: c.last_message_at as string,
      };
    }),
  };

  // Vem pronto do lote acima: a rotina diária calcula e guarda.
  const avgResponseMinutes =
    (tempoRespostaSalvo?.value as { minutos?: number | null } | null)?.minutos ?? null;

  const porVendedor = r.porVendedor ?? {};
  const conversasPorVendedor = r.conversasPorVendedor ?? {};
  const attendantRanking = (profiles ?? [])
    .map((p) => {
      const ls = porVendedor[p.id] ?? { open: 0, won: 0, lost: 0, closedValue: 0 };
      return {
        profile: { id: p.id, full_name: p.full_name, email: p.email },
        conversations: n(conversasPorVendedor[p.id]),
        leadsOpen: n(ls.open),
        leadsWon: n(ls.won),
        leadsLost: n(ls.lost),
        closedValue: n(ls.closedValue),
      };
    })
    .filter((x) => x.conversations > 0 || x.leadsOpen > 0 || x.leadsWon > 0 || x.leadsLost > 0)
    .sort((a, b) => b.closedValue - a.closedValue || b.leadsWon - a.leadsWon);

  return {
    kpis: {
      leadsToday: n(r.kpis.leadsToday),
      leadsThisMonth: n(r.kpis.leadsThisMonth),
      totalLeads: n(r.kpis.totalLeads),
      totalWon,
      totalLost,
      conversionRate: totalClosed > 0 ? totalWon / totalClosed : 0,
      estimatedValueOpen: n(r.kpis.estimatedValueOpen),
      closedValueAllTime: n(r.kpis.closedValueAllTime),
      closedValueThisMonth: n(r.kpis.closedValueThisMonth),
      openConversations: n(r.conversas.openConversations),
      unreadConversations: n(r.conversas.unreadConversations),
      avgResponseMinutes,
    },
    funnel,
    bySource,
    sourceLabels,
    stalled,
    topLeads: (topLeadsRes.data ?? []) as unknown as DashboardData["topLeads"],
    recentLeads: (recentLeadsRes.data ?? []) as unknown as DashboardData["recentLeads"],
    attendantRanking,
  };
}

export function formatBRL(v: number): string {
  return formatarMoeda(v);
}

export const SOURCE_LABELS: Record<string, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  instagram: "Instagram",
  facebook: "Facebook",
  site: "Site",
  whatsapp: "WhatsApp direto",
  indicacao: "Indicação",
  outros: "Outros",
  "sem origem": "Sem origem",
};
