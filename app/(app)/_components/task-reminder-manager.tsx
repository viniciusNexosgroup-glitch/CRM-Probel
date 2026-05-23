"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { showNotification, playNotificationSound } from "@/lib/notifications";

const STORAGE_KEY = "crm-probel:task-notified";
const POLL_INTERVAL_MS = 60_000;
const WINDOW_BEFORE_MS = 5 * 60 * 1000; // notifica até 5 min antes

type TaskRow = {
  id: string;
  title: string;
  due_at: string | null;
  assigned_to: string | null;
  lead_id: string | null;
  contact_id: string | null;
  lead: { conversation_id: string | null } | null;
  contact: { name: string | null; push_name: string | null; phone: string | null } | null;
};

function loadNotified(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveNotified(set: Set<string>) {
  if (typeof window === "undefined") return;
  // Mantém apenas IDs recentes (limita a 200 pra não crescer indefinido)
  const arr = Array.from(set).slice(-200);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function contactDisplay(c: TaskRow["contact"]): string {
  if (!c) return "Sem contato";
  return c.name?.trim() || c.push_name?.trim() || c.phone || "Sem nome";
}

export function TaskReminderManager() {
  const router = useRouter();
  const notifiedRef = useRef<Set<string>>(loadNotified());

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function check() {
      const now = Date.now();
      const from = new Date(now - 24 * 60 * 60 * 1000).toISOString(); // até 24h atrás (overdue)
      const to = new Date(now + 60 * 60 * 1000).toISOString(); // até 1h à frente

      const { data } = await supabase
        .from("tasks")
        .select(
          `id, title, due_at, assigned_to, lead_id, contact_id,
           lead:leads!tasks_lead_id_fkey(conversation_id),
           contact:contacts!tasks_contact_id_fkey(name, push_name, phone)`
        )
        .eq("completed", false)
        .not("due_at", "is", null)
        .gte("due_at", from)
        .lte("due_at", to)
        .order("due_at", { ascending: true });

      if (cancelled || !data) return;

      const tasks = data as unknown as TaskRow[];

      for (const t of tasks) {
        if (!t.due_at) continue;
        if (notifiedRef.current.has(t.id)) continue;

        const dueMs = new Date(t.due_at).getTime();
        const diff = dueMs - now;
        const isOverdue = diff < 0;
        const isImminent = diff > 0 && diff <= WINDOW_BEFORE_MS;

        if (!isOverdue && !isImminent) continue;

        const contactName = contactDisplay(t.contact);
        const title = isOverdue ? "⏰ Tarefa atrasada" : "⏰ Lembrete de tarefa";
        const minutes = Math.round(Math.abs(diff) / 60000);
        const subtitle = isOverdue
          ? `Atrasada há ${minutes} min`
          : `Em ${minutes} min`;
        const convId = t.lead?.conversation_id;

        showNotification(title, {
          body: `${t.title}\n${contactName} · ${subtitle}`,
          tag: `task-${t.id}`,
          onClick: () => {
            if (convId) router.push(`/chat?c=${convId}`);
            else router.push("/leads");
          },
        });
        playNotificationSound();

        notifiedRef.current.add(t.id);
      }
      saveNotified(notifiedRef.current);
    }

    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [router]);

  return null;
}
