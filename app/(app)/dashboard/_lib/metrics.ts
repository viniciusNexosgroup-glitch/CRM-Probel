import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type StageRow = Database["public"]["Tables"]["pipeline_stages"]["Row"];
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];

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
  };
  funnel: {
    stage: StageRow;
    count: number;
    totalValue: number;
  }[];
  bySource: { source: string; count: number; estimatedValue: number }[];
  topLeads: (LeadRow & { contact: { name: string | null; push_name: string | null; phone: string | null } | null })[];
  recentLeads: (LeadRow & { contact: { name: string | null; push_name: string | null; phone: string | null } | null })[];
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

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  const [stagesRes, leadsRes, conversationsRes, todayLeadsRes, monthLeadsRes] =
    await Promise.all([
      supabase.from("pipeline_stages").select("*").order("position", { ascending: true }),
      supabase
        .from("leads")
        .select(
          "*, contact:contacts!leads_contact_id_fkey(name, push_name, phone)"
        )
        .order("updated_at", { ascending: false }),
      supabase.from("conversations").select("unread_count", { count: "exact" }),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfDay()),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfMonth()),
    ]);

  const stages = stagesRes.data ?? [];
  const leads = (leadsRes.data ?? []) as unknown as DashboardData["topLeads"];

  // KPIs
  const won = leads.filter((l) => l.status === "won");
  const lost = leads.filter((l) => l.status === "lost");
  const wonMonth = won.filter(
    (l) => new Date(l.updated_at) >= new Date(startOfMonth())
  );

  const totalClosed = won.length + lost.length;
  const conversionRate = totalClosed > 0 ? won.length / totalClosed : 0;

  const estimatedValueOpen = leads
    .filter((l) => l.status === "open")
    .reduce((s, l) => s + Number(l.estimated_value ?? 0), 0);

  const closedValueAllTime = won.reduce(
    (s, l) => s + Number(l.closed_value ?? l.estimated_value ?? 0),
    0
  );
  const closedValueThisMonth = wonMonth.reduce(
    (s, l) => s + Number(l.closed_value ?? l.estimated_value ?? 0),
    0
  );

  const conversations = conversationsRes.data ?? [];
  const openConversations = conversations.length;
  const unreadConversations = conversations.filter(
    (c) => (c.unread_count ?? 0) > 0
  ).length;

  // Funnel
  const funnel = stages.map((stage) => {
    const inStage = leads.filter((l) => l.stage_id === stage.id);
    return {
      stage,
      count: inStage.length,
      totalValue: inStage.reduce((s, l) => {
        const v = stage.is_won
          ? Number(l.closed_value ?? l.estimated_value ?? 0)
          : Number(l.estimated_value ?? 0);
        return s + v;
      }, 0),
    };
  });

  // By source
  const sourceMap = new Map<string, { count: number; estimatedValue: number }>();
  for (const l of leads) {
    const src = l.source ?? "sem origem";
    const entry = sourceMap.get(src) ?? { count: 0, estimatedValue: 0 };
    entry.count += 1;
    entry.estimatedValue += Number(l.estimated_value ?? 0);
    sourceMap.set(src, entry);
  }
  const bySource = Array.from(sourceMap.entries())
    .map(([source, v]) => ({ source, ...v }))
    .sort((a, b) => b.count - a.count);

  // Top leads abertos por valor estimado
  const topLeads = leads
    .filter((l) => l.status === "open" && (l.estimated_value ?? 0) > 0)
    .sort((a, b) => Number(b.estimated_value ?? 0) - Number(a.estimated_value ?? 0))
    .slice(0, 5);

  // Últimos 8 leads criados
  const recentLeads = [...leads]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8);

  return {
    kpis: {
      leadsToday: todayLeadsRes.count ?? 0,
      leadsThisMonth: monthLeadsRes.count ?? 0,
      totalLeads: leads.length,
      totalWon: won.length,
      totalLost: lost.length,
      conversionRate,
      estimatedValueOpen,
      closedValueAllTime,
      closedValueThisMonth,
      openConversations,
      unreadConversations,
    },
    funnel,
    bySource,
    topLeads,
    recentLeads,
  };
}

export function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
