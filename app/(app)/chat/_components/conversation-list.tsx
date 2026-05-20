"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, MessageSquare, ChevronDown, Tag as TagIcon, X, Pin, Star, Archive } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Avatar } from "./avatar";
import { formatRelativeTime } from "@/lib/format/date";
import { formatPhone } from "@/lib/format/avatar";
import type { ConversationWithContact, TagRow } from "../types";

function displayName(c: ConversationWithContact["contact"]): string {
  const name = c.name?.trim();
  if (name) return name;
  const pushName = c.push_name?.trim();
  if (pushName) return pushName;
  if (c.phone) return formatPhone(c.phone);
  return "Sem nome";
}

function getConversationTags(c: ConversationWithContact): TagRow[] {
  const lead = c.contact.leads;
  if (!lead) return [];
  return lead.lead_tags?.map((lt) => lt.tag) ?? [];
}

type QuickFilter = "all" | "unread" | "favorites" | "groups" | "archived";

const QUICK_FILTERS: { value: QuickFilter; label: string }[] = [
  { value: "all", label: "Tudo" },
  { value: "unread", label: "Não lidas" },
  { value: "favorites", label: "Favoritas" },
  { value: "groups", label: "Grupos" },
  { value: "archived", label: "Arquivadas" },
];

export function ConversationList({
  initial,
  selectedId,
  allTags,
}: {
  initial: ConversationWithContact[];
  selectedId?: string;
  allTags: TagRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState(initial);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QuickFilter>("all");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Realtime + polling (mantém comportamento atual)
  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    const pollInterval = setInterval(() => {
      if (mounted) startTransition(() => router.refresh());
    }, 5000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token && mounted) {
        supabase.realtime.setAuth(session.access_token);
      }
    });

    const channel = supabase
      .channel("crm-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => mounted && startTransition(() => router.refresh())
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => mounted && startTransition(() => router.refresh())
      )
      .subscribe();

    return () => {
      mounted = false;
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [router]);

  useEffect(() => {
    setConversations(initial);
  }, [initial]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (!tagDropdownOpen) return;
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-tag-dropdown]")) setTagDropdownOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [tagDropdownOpen]);

  const filtered = useMemo(() => {
    const list = conversations.filter((c) => {
      // Arquivadas: aparecem só com filtro 'archived'
      if (filter === "archived") {
        if (!c.is_archived) return false;
      } else {
        if (c.is_archived) return false;
      }

      if (filter === "unread" && c.unread_count <= 0) return false;
      if (filter === "favorites" && !c.contact.is_favorite) return false;
      if (filter === "groups" && !c.contact.is_group) return false;

      if (selectedTagId) {
        const tags = getConversationTags(c);
        if (!tags.some((t) => t.id === selectedTagId)) return false;
      }

      if (query.trim()) {
        const q = query.toLowerCase();
        const name = displayName(c.contact).toLowerCase();
        const preview = (c.last_message_text ?? "").toLowerCase();
        if (!name.includes(q) && !preview.includes(q)) return false;
      }

      return true;
    });

    // Sort: fixadas no topo, depois last_message_at desc
    return list.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return tb - ta;
    });
  }, [conversations, query, filter, selectedTagId]);

  function hrefForConversation(id: string) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("c", id);
    return `${pathname}?${sp.toString()}`;
  }

  const selectedTag = selectedTagId ? allTags.find((t) => t.id === selectedTagId) : null;

  return (
    <aside className="w-full md:w-[400px] shrink-0 bg-wa-panel border-r border-wa-border flex flex-col">
      <header className="h-16 bg-wa-header flex items-center px-4 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h1 className="font-semibold text-wa-textPrimary">Conversas</h1>
        </div>
      </header>

      {/* Busca */}
      <div className="px-3 py-2 bg-wa-bg shrink-0 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-wa-textSecondary" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar conversa"
            className="pl-9 h-9 bg-wa-panel border-0 text-sm"
          />
        </div>

        {/* Filtros rápidos */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                filter === f.value
                  ? "bg-primary/15 text-primary border-primary/40 font-medium"
                  : "border-wa-border text-wa-textSecondary hover:bg-wa-hover hover:text-wa-textPrimary"
              )}
            >
              {f.label}
            </button>
          ))}

          {/* Dropdown de etiquetas */}
          <div data-tag-dropdown className="relative">
            <button
              onClick={() => setTagDropdownOpen((o) => !o)}
              className={cn(
                "inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                selectedTag
                  ? "border-transparent font-medium"
                  : "border-wa-border text-wa-textSecondary hover:bg-wa-hover hover:text-wa-textPrimary"
              )}
              style={
                selectedTag
                  ? { backgroundColor: `${selectedTag.color}25`, color: selectedTag.color }
                  : undefined
              }
            >
              <TagIcon className="h-2.5 w-2.5" />
              {selectedTag?.name ?? "Etiquetas"}
              {selectedTag ? (
                <X
                  className="h-3 w-3 ml-0.5 hover:opacity-70"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTagId(null);
                    setTagDropdownOpen(false);
                  }}
                />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            {tagDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 min-w-48 max-h-64 overflow-y-auto wa-scroll bg-wa-panel border border-wa-border rounded-lg shadow-lg z-50 py-1">
                {allTags.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-wa-textTertiary">
                    Nenhuma etiqueta cadastrada
                  </p>
                ) : (
                  allTags.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTagId(t.id === selectedTagId ? null : t.id);
                        setTagDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-wa-hover text-left",
                        t.id === selectedTagId && "bg-wa-active"
                      )}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: t.color }}
                      />
                      <span className="text-wa-textPrimary">{t.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto wa-scroll">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-wa-textSecondary text-sm">
            {conversations.length === 0
              ? "Nenhuma conversa ainda. Aguardando primeira mensagem do WhatsApp…"
              : "Nenhuma conversa corresponde aos filtros."}
          </div>
        ) : (
          <ul>
            {filtered.map((c) => {
              const tags = getConversationTags(c);
              return (
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
                        <span className="font-medium text-wa-textPrimary truncate flex items-center gap-1 min-w-0">
                          {c.contact.is_favorite && (
                            <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />
                          )}
                          {c.is_pinned && (
                            <Pin className="h-3 w-3 text-primary fill-primary shrink-0" />
                          )}
                          {c.is_archived && (
                            <Archive className="h-3 w-3 text-wa-textTertiary shrink-0" />
                          )}
                          <span className="truncate">{displayName(c.contact)}</span>
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
                          {c.last_message_from_me && (
                            <span className="text-wa-textTertiary">Você: </span>
                          )}
                          {c.last_message_text ?? "—"}
                        </span>
                        {c.unread_count > 0 && (
                          <span className="bg-wa-unread text-black text-[11px] font-bold rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center">
                            {c.unread_count > 99 ? "99+" : c.unread_count}
                          </span>
                        )}
                      </div>
                      {tags.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {tags.slice(0, 3).map((t) => (
                            <span
                              key={t.id}
                              className="inline-flex items-center text-[10px] px-1.5 py-0 rounded-full"
                              style={{
                                backgroundColor: `${t.color}25`,
                                color: t.color,
                              }}
                            >
                              {t.name}
                            </span>
                          ))}
                          {tags.length > 3 && (
                            <span className="text-[10px] text-wa-textTertiary">
                              +{tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
