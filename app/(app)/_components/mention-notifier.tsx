"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { showNotification, playNotificationSound } from "@/lib/notifications";

const POLL_MS = 30_000;
const STORAGE_SEEN = "crm-probel:mentions-seen";

type MentionNote = {
  id: string;
  content: string;
  conversation_id: string;
  created_at: string;
  author: { full_name: string | null; email: string | null } | null;
};

export function MentionNotifier({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const seenRef = useRef<Set<string>>(loadSeen());

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function check() {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("internal_notes")
        .select(
          `id, content, conversation_id, created_at,
           author:profiles!internal_notes_author_id_fkey(full_name, email)`
        )
        .contains("mentioned_user_ids", [currentUserId])
        .gt("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20);

      if (cancelled || !data) return;

      for (const n of data as unknown as MentionNote[]) {
        if (seenRef.current.has(n.id)) continue;
        if (n.author?.full_name === undefined && n.author?.email === undefined) {
          // ignora se for de si mesmo (mention própria)
        }
        const authorName = n.author?.full_name ?? n.author?.email ?? "Equipe";
        showNotification(`@${authorName} te mencionou`, {
          body: n.content.slice(0, 140),
          tag: `mention-${n.id}`,
          onClick: () => router.push(`/chat?c=${n.conversation_id}`),
        });
        playNotificationSound();
        seenRef.current.add(n.id);
      }
      saveSeen(seenRef.current);
    }

    check();
    const interval = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentUserId, router]);

  return null;
}

function loadSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_SEEN) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveSeen(set: Set<string>) {
  if (typeof window === "undefined") return;
  const arr = Array.from(set).slice(-200);
  localStorage.setItem(STORAGE_SEEN, JSON.stringify(arr));
}
