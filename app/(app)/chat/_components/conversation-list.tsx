"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Avatar } from "./avatar";
import { formatRelativeTime } from "@/lib/format/date";
import { formatPhone } from "@/lib/format/avatar";
import type { ConversationWithContact } from "../types";

function displayName(c: ConversationWithContact["contact"]): string {
  const name = c.name?.trim();
  if (name) return name;
  const pushName = c.push_name?.trim();
  if (pushName) return pushName;
  if (c.phone) return formatPhone(c.phone);
  return "Sem nome";
}

export function ConversationList({
  initial,
  selectedId,
}: {
  initial: ConversationWithContact[];
  selectedId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState(initial);
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  // Realtime: escuta INSERT/UPDATE em conversations → atualiza preview e ordem
  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    // Garante que o realtime tenha o token JWT do usuário logado
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token && mounted) {
        supabase.realtime.setAuth(session.access_token);
      }
    });

    const channel = supabase
      .channel("crm-conversations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        (payload) => {
          console.log("[realtime/conversations]", payload.eventType, payload.new ?? payload.old);
          startTransition(() => router.refresh());
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          // Mensagem nova em qualquer conversa → reordena a lista
          console.log("[realtime/messages]", "INSERT", payload.new);
          startTransition(() => router.refresh());
        }
      )
      .subscribe((status, err) => {
        console.log("[realtime/conversations] subscribe status:", status);
        if (err) console.error("[realtime/conversations] error:", err);
      });

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [router]);

  // Atualiza state local quando o server enviar nova lista
  useEffect(() => {
    setConversations(initial);
  }, [initial]);

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.toLowerCase();
    return conversations.filter((c) => {
      const name = displayName(c.contact).toLowerCase();
      const preview = (c.last_message_text ?? "").toLowerCase();
      return name.includes(q) || preview.includes(q);
    });
  }, [conversations, query]);

  function hrefForConversation(id: string) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("c", id);
    return `${pathname}?${sp.toString()}`;
  }

  return (
    <aside className="w-full md:w-[400px] shrink-0 bg-wa-panel border-r border-wa-border flex flex-col">
      <header className="h-16 bg-wa-header flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h1 className="font-semibold text-wa-textPrimary">CRM Probel</h1>
        </div>
        <Link
          href="/settings/whatsapp"
          className="text-xs text-wa-textSecondary hover:text-wa-textPrimary"
        >
          Configurar
        </Link>
      </header>

      <div className="px-3 py-2 bg-wa-bg shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-wa-textSecondary" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar conversa"
            className="pl-9 h-9 bg-wa-panel border-0 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto wa-scroll">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-wa-textSecondary text-sm">
            {conversations.length === 0
              ? "Nenhuma conversa ainda. Aguardando primeira mensagem do WhatsApp…"
              : "Nenhuma conversa corresponde à busca."}
          </div>
        ) : (
          <ul>
            {filtered.map((c) => (
              <li key={c.id}>
                <Link
                  href={hrefForConversation(c.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 border-b border-wa-border/40 hover:bg-wa-hover transition-colors",
                    selectedId === c.id && "bg-wa-active"
                  )}
                >
                  <Avatar
                    src={c.contact.profile_pic_url}
                    name={displayName(c.contact)}
                    seed={c.contact.whatsapp_id}
                    size={48}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-wa-textPrimary truncate">
                        {displayName(c.contact)}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] whitespace-nowrap",
                          c.unread_count > 0 ? "text-wa-accent" : "text-wa-textSecondary"
                        )}
                      >
                        {formatRelativeTime(c.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-xs text-wa-textSecondary truncate">
                        {c.last_message_from_me && <span className="text-wa-textTertiary">Você: </span>}
                        {c.last_message_text ?? "—"}
                      </span>
                      {c.unread_count > 0 && (
                        <span className="bg-wa-unread text-black text-[11px] font-bold rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center">
                          {c.unread_count > 99 ? "99+" : c.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
