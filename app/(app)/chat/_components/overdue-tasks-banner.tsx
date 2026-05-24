"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type OverdueTask = {
  id: string;
  title: string;
  due_at: string;
  lead: { conversation_id: string | null } | null;
  contact: { name: string | null; push_name: string | null; phone: string | null } | null;
};

const DISMISS_KEY = "crm-probel:overdue-dismissed-until";

function contactDisplay(c: OverdueTask["contact"]): string {
  if (!c) return "—";
  return c.name?.trim() || c.push_name?.trim() || c.phone || "Sem nome";
}

function overdueLabel(dueAt: string): string {
  const mins = Math.round((Date.now() - new Date(dueAt).getTime()) / 60_000);
  if (mins < 60) return `${mins} min atrás`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.round(h / 24)}d atrás`;
}

export function OverdueTasksBanner({ currentUserId }: { currentUserId?: string }) {
  const [tasks, setTasks] = useState<OverdueTask[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Verifica se foi dispensado nas últimas 4 horas
    try {
      const until = localStorage.getItem(DISMISS_KEY);
      if (until && Number(until) > Date.now()) setDismissed(true);
    } catch {}
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function load() {
      const nowIso = new Date().toISOString();
      let query = supabase
        .from("tasks")
        .select(
          `id, title, due_at,
           lead:leads!tasks_lead_id_fkey(conversation_id),
           contact:contacts!tasks_contact_id_fkey(name, push_name, phone)`
        )
        .eq("completed", false)
        .not("due_at", "is", null)
        .lt("due_at", nowIso)
        .order("due_at", { ascending: true })
        .limit(20);

      // Prioriza tarefas atribuídas ao próprio usuário OU sem atribuição
      if (currentUserId) {
        query = query.or(`assigned_to.eq.${currentUserId},assigned_to.is.null`);
      }

      const { data } = await query;
      if (!mounted) return;
      setTasks((data ?? []) as unknown as OverdueTask[]);
    }

    load();
    const interval = setInterval(load, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [currentUserId]);

  function onDismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + 4 * 60 * 60 * 1000));
    } catch {}
  }

  if (dismissed || tasks.length === 0) return null;

  return (
    <div className="bg-amber-500/15 border-t border-b border-amber-500/30 shrink-0">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-amber-500/20 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs text-amber-300 font-medium">
          <AlertTriangle className="h-3.5 w-3.5" />
          {tasks.length} {tasks.length === 1 ? "tarefa atrasada" : "tarefas atrasadas"}
        </span>
        <span className="flex items-center gap-1">
          <ChevronRight
            className={cn(
              "h-3 w-3 text-amber-300 transition-transform",
              expanded && "rotate-90"
            )}
          />
          <span
            role="button"
            aria-label="Dispensar"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="ml-2 p-0.5 rounded hover:bg-amber-500/30 cursor-pointer"
          >
            <X className="h-3 w-3 text-amber-300/70" />
          </span>
        </span>
      </button>
      {expanded && (
        <ul className="max-h-48 overflow-y-auto wa-scroll px-2 pb-2 space-y-1">
          {tasks.map((t) => {
            const href = t.lead?.conversation_id ? `/chat?c=${t.lead.conversation_id}` : "/leads";
            return (
              <li key={t.id}>
                <Link
                  href={href}
                  className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 transition-colors text-xs"
                >
                  <AlertTriangle className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-amber-100 truncate font-medium">{t.title}</p>
                    <p className="text-[10px] text-amber-300/70 mt-0.5">
                      {contactDisplay(t.contact)} · {overdueLabel(t.due_at)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
