"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "./avatar";

type Viewer = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

/**
 * #17 Mostra avatares de OUTROS atendentes vendo a mesma conversa agora.
 * Heartbeat: marca presença a cada 8s; lista quem viu nos últimos 15s.
 * Usa polling (o realtime do projeto não é confiável).
 */
export function ViewingIndicator({
  conversationId,
  currentUserId,
}: {
  conversationId: string;
  currentUserId: string;
}) {
  const [viewers, setViewers] = useState<Viewer[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function beat() {
      await supabase
        .from("conversation_viewers")
        .upsert(
          { conversation_id: conversationId, user_id: currentUserId, last_seen_at: new Date().toISOString() },
          { onConflict: "conversation_id,user_id" }
        );
    }

    async function load() {
      const cutoff = new Date(Date.now() - 15000).toISOString();
      const { data } = await supabase
        .from("conversation_viewers")
        .select(
          "user_id, last_seen_at, profile:profiles!conversation_viewers_user_id_fkey(full_name, email, avatar_url)"
        )
        .eq("conversation_id", conversationId)
        .neq("user_id", currentUserId)
        .gt("last_seen_at", cutoff);
      if (!mounted) return;
      const list: Viewer[] = (data ?? []).map((r) => {
        const p = r.profile as unknown as {
          full_name: string | null;
          email: string | null;
          avatar_url: string | null;
        } | null;
        return {
          user_id: r.user_id as string,
          full_name: p?.full_name ?? null,
          email: p?.email ?? null,
          avatar_url: p?.avatar_url ?? null,
        };
      });
      setViewers(list);
    }

    beat();
    load();
    const iv = setInterval(() => {
      if (!mounted) return;
      beat();
      load();
    }, 8000);

    return () => {
      mounted = false;
      clearInterval(iv);
      // sai da conversa → remove presença
      supabase
        .from("conversation_viewers")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("user_id", currentUserId)
        .then(() => {});
    };
  }, [conversationId, currentUserId]);

  if (viewers.length === 0) return null;

  return (
    <div className="flex items-center -space-x-2 mr-1" title="Vendo esta conversa agora">
      {viewers.slice(0, 4).map((v) => {
        const name = v.full_name ?? v.email ?? "Atendente";
        return (
          <div
            key={v.user_id}
            className="ring-2 ring-wa-header rounded-full"
            title={`${name} está vendo`}
          >
            <Avatar src={v.avatar_url} name={name} seed={v.user_id} size={24} />
          </div>
        );
      })}
    </div>
  );
}
