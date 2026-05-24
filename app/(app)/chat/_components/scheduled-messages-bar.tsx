"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calendar, X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cancelScheduledMessageAction } from "../actions";

type ScheduledRow = {
  id: string;
  content: string;
  scheduled_for: string;
  status: string;
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  if (diff < 60_000) return "agora";
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `em ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `em ${hours}h`;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ScheduledMessagesBar({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<ScheduledRow[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function load() {
      const { data } = await supabase
        .from("scheduled_messages")
        .select("id, content, scheduled_for, status")
        .eq("conversation_id", conversationId)
        .eq("status", "pending")
        .order("scheduled_for", { ascending: true });
      if (!mounted) return;
      setItems((data ?? []) as ScheduledRow[]);
    }

    load();
    const interval = setInterval(load, 10_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [conversationId]);

  function onCancel(id: string) {
    startTransition(async () => {
      const res = await cancelScheduledMessageAction(id);
      if (res.ok) {
        toast.success("Agendamento cancelado");
        setItems((arr) => arr.filter((x) => x.id !== id));
        router.refresh();
      } else {
        toast.error("Falha", { description: res.error });
      }
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="bg-amber-500/10 border-t border-amber-500/30">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-4 py-1.5 flex items-center justify-between text-xs text-amber-300 hover:bg-amber-500/15 transition-colors"
      >
        <span className="flex items-center gap-2 font-medium">
          <Calendar className="h-3.5 w-3.5" />
          {items.length} mensagem{items.length === 1 ? "" : "s"} agendada{items.length === 1 ? "" : "s"}
        </span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {expanded && (
        <ul className="px-4 py-2 space-y-1.5 max-h-40 overflow-y-auto wa-scroll">
          {items.map((m) => (
            <li
              key={m.id}
              className="flex items-start gap-2 text-xs bg-amber-500/15 rounded-md px-2 py-1.5"
            >
              <Calendar className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-amber-100 truncate">{m.content}</p>
                <p className="text-[10px] text-amber-300/70 mt-0.5">
                  {formatWhen(m.scheduled_for)} ·{" "}
                  {new Date(m.scheduled_for).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <button
                onClick={() => onCancel(m.id)}
                className="text-amber-400/70 hover:text-red-400 shrink-0"
                title="Cancelar agendamento"
                aria-label="Cancelar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
