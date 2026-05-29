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
    avgResponseMinutes: number | null;
  };
  funnel: {
    stage: StageRow;
    count: number;
    totalValue: number;
  }[];
  bySource: { source: string; count: number; won: number; conversionRate: number; estimatedValue: number }[];
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

  // By source (com conversão: quantos viraram Ganho)
  const sourceMap = new Map<string, { count: number; won: number; estimatedValue: number }>();
  for (const l of leads) {
    const src = l.source ?? "sem origem";
    const entry = sourceMap.get(src) ?? { count: 0, won: 0, estimatedValue: 0 };
    entry.count += 1;
    if (l.status === "won") entry.won += 1;
    entry.estimatedValue += Number(l.estimated_value ?? 0);
    sourceMap.set(src, entry);
  }
  const bySource = Array.from(sourceMap.entries())
    .map(([source, v]) => ({
      source,
      ...v,
      conversionRate: v.count > 0 ? v.won / v.count : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // #20 Leads parados: conversas onde o cliente foi o último a falar há +24h
  const stalledCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: stalledConvs } = await supabase
    .from("conversations")
    .select(
      "id, last_message_at, last_message_text, contact:contacts!conversations_contact_id_fkey(name, push_name, phone)"
    )
    .eq("last_message_from_me", false)
    .eq("is_archived", false)
    .lt("last_message_at", stalledCutoff)
    .order("last_message_at", { ascending: true })
    .limit(100);

  const stalled = {
    count: stalledConvs?.length ?? 0,
    items: (stalledConvs ?? []).slice(0, 8).map((c) => {
      const ct = c.contact as unknown as {
        name: string | null;
        push_name: string | null;
        phone: string | null;
      } | null;
      return {
        conversationId: c.id as string,
        name: ct?.name ?? ct?.push_name ?? null,
        phone: ct?.phone ?? null,
        lastText: c.last_message_text ?? null,
        lastAt: c.last_message_at as string,
      };
    }),
  };

  // Top leads abertos por valor estimado
  const topLeads = leads
    .filter((l) => l.status === "open" && (l.estimated_value ?? 0) > 0)
    .sort((a, b) => Number(b.estimated_value ?? 0) - Number(a.estimated_value ?? 0))
    .slice(0, 5);

  // Últimos 8 leads criados
  const recentLeads = [...leads]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8);

  // ============================================================
  // Tempo médio de resposta (últimos 30 dias)
  // ============================================================
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: msgs } = await supabase
    .from("messages")
    .select("conversation_id, from_me, timestamp")
    .gte("timestamp", thirtyDaysAgo)
    .order("conversation_id", { ascending: true })
    .order("timestamp", { ascending: true })
    .limit(5000);

  let totalDiffMs = 0;
  let pairs = 0;
  if (msgs && msgs.length > 0) {
    const byConv = new Map<string, typeof msgs>();
    for (const m of msgs) {
      const list = byConv.get(m.conversation_id) ?? [];
      list.push(m);
      byConv.set(m.conversation_id, list);
    }
    for (const list of byConv.values()) {
      let lastReceived: string | null = null;
      for (const m of list) {
        if (!m.from_me) {
          if (lastReceived === null) lastReceived = m.timestamp;
        } else if (lastReceived) {
          totalDiffMs += new Date(m.timestamp).getTime() - new Date(lastReceived).getTime();
          pairs += 1;
          lastReceived = null;
        }
      }
    }
  }
  const avgResponseMinutes = pairs > 0 ? Math.round(totalDiffMs / pairs / 60000) : null;

  // ============================================================
  // Ranking por atendente
  // ============================================================
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email");

  const { data: assignedConvs } = await supabase
    .from("conversations")
    .select("assigned_to")
    .not("assigned_to", "is", null);

  const convsByUser = new Map<string, number>();
  for (const c of assignedConvs ?? []) {
    if (c.assigned_to) {
      convsByUser.set(c.assigned_to, (convsByUser.get(c.assigned_to) ?? 0) + 1);
    }
  }

  const leadsByUser = new Map<string, { open: number; won: number; lost: number; closedValue: number }>();
  for (const l of leads) {
    if (!l.assigned_to) continue;
    const entry = leadsByUser.get(l.assigned_to) ?? { open: 0, won: 0, lost: 0, closedValue: 0 };
    if (l.status === "open") entry.open++;
    if (l.status === "won") {
      entry.won++;
      entry.closedValue += Number(l.closed_value ?? l.estimated_value ?? 0);
    }
    if (l.status === "lost") entry.lost++;
    leadsByUser.set(l.assigned_to, entry);
  }

  const attendantRanking = (profiles ?? [])
    .map((p) => {
      const ls = leadsByUser.get(p.id) ?? { open: 0, won: 0, lost: 0, closedValue: 0 };
      return {
        profile: { id: p.id, full_name: p.full_name, email: p.email },
        conversations: convsByUser.get(p.id) ?? 0,
        leadsOpen: ls.open,
        leadsWon: ls.won,
        leadsLost: ls.lost,
        closedValue: ls.closedValue,
      };
    })
    .filter((r) => r.conversations > 0 || r.leadsOpen > 0 || r.leadsWon > 0 || r.leadsLost > 0)
    .sort((a, b) => b.closedValue - a.closedValue || b.leadsWon - a.leadsWon);

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
      avgResponseMinutes,
    },
    funnel,
    bySource,
    stalled,
    topLeads,
    recentLeads,
    attendantRanking,
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
