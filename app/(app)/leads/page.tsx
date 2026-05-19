import Link from "next/link";
import { ArrowLeft, KanbanSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KanbanBoard } from "./_components/kanban-board";
import type { LeadWithContact, PipelineStageRow } from "./types";

export const dynamic = "force-dynamic";

async function getStages(): Promise<PipelineStageRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pipeline_stages")
    .select("*")
    .order("position", { ascending: true });
  return data ?? [];
}

async function getLeads(): Promise<LeadWithContact[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select(
      `
      *,
      contact:contacts!leads_contact_id_fkey (
        id, name, push_name, phone, profile_pic_url, whatsapp_id
      )
    `
    )
    .order("updated_at", { ascending: false });
  return (data ?? []) as unknown as LeadWithContact[];
}

export default async function LeadsPage() {
  const [stages, leads] = await Promise.all([getStages(), getLeads()]);

  return (
    <div className="h-screen bg-wa-bg flex flex-col">
      <header className="h-14 bg-wa-header flex items-center justify-between px-4 border-b border-wa-border shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="inline-flex items-center gap-1 text-sm text-wa-textSecondary hover:text-wa-textPrimary"
          >
            <ArrowLeft className="h-4 w-4" /> Conversas
          </Link>
          <span className="text-wa-textTertiary">/</span>
          <h1 className="font-medium text-wa-textPrimary flex items-center gap-2">
            <KanbanSquare className="h-4 w-4 text-primary" /> Funil de Leads
          </h1>
          <span className="text-xs text-wa-textSecondary">
            {leads.length} {leads.length === 1 ? "lead" : "leads"}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-hidden px-3 pt-3">
        <KanbanBoard stages={stages} leads={leads} />
      </div>
    </div>
  );
}
