import { redirect } from "next/navigation";
import { ScrollText, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { formatRelativeTime } from "@/lib/format/date";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  team_invite: "Convidou atendente",
  team_remove: "Removeu atendente",
  team_role_change: "Mudou permissão",
  conversation_assign: "Atribuiu conversa",
  lead_stage_change: "Mudou estágio do lead",
  lead_won: "Marcou lead como ganho",
  lead_lost: "Marcou lead como perdido",
};

export default async function AuditPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  if (profile.role !== "admin") {
    return (
      <div className="h-full bg-wa-bg flex flex-col items-center justify-center text-center px-6">
        <ShieldAlert className="h-10 w-10 text-wa-textSecondary mb-3" />
        <p className="text-wa-textPrimary font-medium">Acesso restrito</p>
        <p className="text-sm text-wa-textSecondary mt-1">
          Só administradores podem ver o registro de atividades.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("audit_log")
    .select("id, action, summary, created_at, actor:profiles!audit_log_actor_id_fkey(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="h-full bg-wa-bg flex flex-col overflow-hidden">
      <header className="h-14 bg-wa-header flex items-center px-4 border-b border-wa-border shrink-0">
        <h1 className="font-medium text-wa-textPrimary flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-primary" />
          Registro de atividades
        </h1>
      </header>
      <div className="flex-1 overflow-y-auto wa-scroll">
        <div className="container max-w-3xl py-6">
          <p className="text-sm text-muted-foreground mb-4">
            Quem fez o quê: atribuições, mudanças de estágio e gestão da equipe. Últimas 200 ações.
          </p>
          {!logs || logs.length === 0 ? (
            <p className="text-sm text-wa-textSecondary py-8 text-center">
              Nenhuma ação registrada ainda.
            </p>
          ) : (
            <ul className="rounded-lg border border-border overflow-hidden divide-y divide-border bg-card">
              {logs.map((l) => {
                const actor = l.actor as unknown as { full_name: string | null; email: string | null } | null;
                return (
                  <li key={l.id} className="px-4 py-3 flex items-start gap-3">
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary/15 text-primary shrink-0 mt-0.5">
                      {ACTION_LABEL[l.action] ?? l.action}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">{l.summary ?? "—"}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {actor?.full_name ?? actor?.email ?? "Sistema"} · {formatRelativeTime(l.created_at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
