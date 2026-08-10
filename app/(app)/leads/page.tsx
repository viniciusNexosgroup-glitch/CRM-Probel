import { KanbanSquare } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { KanbanBoard } from "./_components/kanban-board";
import type { LeadWithContact, PipelineStageRow } from "./types";

export const dynamic = "force-dynamic";

type Board = { value: string; label: string; ownerId: string | null };

async function getStages(ownerId: string | null): Promise<PipelineStageRow[]> {
  const supabase = await createClient();
  let q = supabase.from("pipeline_stages").select("*").order("position", { ascending: true });
  q = ownerId === null ? q.is("user_id", null) : q.eq("user_id", ownerId);
  const { data } = await q;
  return data ?? [];
}

async function getLeads(ownerId: string | null): Promise<LeadWithContact[]> {
  const supabase = await createClient();
  let q = supabase
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
  q = ownerId === null ? q.is("assigned_to", null) : q.eq("assigned_to", ownerId);
  const { data } = await q;
  return (data ?? []) as unknown as LeadWithContact[];
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

  const [stages, leads] = await Promise.all([
    getStages(selectedOwnerId),
    getLeads(selectedOwnerId),
  ]);

  return (
    <div className="h-full bg-wa-bg flex flex-col">
      <header className="h-14 bg-wa-header flex items-center justify-between px-4 border-b border-wa-border shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="font-medium text-wa-textPrimary flex items-center gap-2">
            <KanbanSquare className="h-4 w-4 text-primary" /> Funil de Leads
          </h1>
          <span className="text-xs text-wa-textSecondary">
            {leads.length} {leads.length === 1 ? "lead" : "leads"}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-hidden px-3 pt-3">
        <KanbanBoard
          stages={stages}
          leads={leads}
          isAdmin={isAdmin}
          boards={boards}
          selectedValue={selectedValue}
        />
      </div>
    </div>
  );
}
