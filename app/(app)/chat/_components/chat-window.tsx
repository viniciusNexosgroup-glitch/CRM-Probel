"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Phone,
  MoreVertical,
  PanelRightOpen,
  PanelRightClose,
  Star,
  Pin,
  Archive,
  ArchiveRestore,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "./avatar";
import { MessageBubble } from "./message-bubble";
import { DateSeparator } from "./date-separator";
import { ComposeBar } from "./compose-bar";
import { ContactPanel } from "./contact-panel";
import { ChatHeaderActions } from "./chat-header-actions";
import { ScheduledMessagesBar } from "./scheduled-messages-bar";
import { isSameDay } from "@/lib/format/date";
import { formatPhone } from "@/lib/format/avatar";
import { formatPresence } from "@/lib/format/presence";
import { cn } from "@/lib/utils";
import {
  markAsReadAction,
  toggleFavoriteAction,
  togglePinnedAction,
  toggleArchivedAction,
  loadOlderMessagesAction,
} from "../actions";

const MESSAGES_PAGE = 100;
import { MESSAGE_COLUMNS } from "../types";
import type {
  ConversationWithContact,
  ContactPanelData,
  MessageRow,
  AssigneeProfile,
  InternalNoteWithAuthor,
} from "../types";
import { InternalNoteBubble } from "./internal-note-bubble";
import { ViewingIndicator } from "./viewing-indicator";
import type { Database } from "@/types/database";

type QuickReplyRow = Database["public"]["Tables"]["quick_replies"]["Row"];
type MediaRow = Database["public"]["Tables"]["media_library"]["Row"];
type CategoryRow = Database["public"]["Tables"]["media_categories"]["Row"];

function FavoritePinArchive({
  conversation,
}: {
  conversation: ConversationWithContact;
}) {
  const router = useRouter();
  const [pendingFav, startFav] = useTransition();
  const [pendingPin, startPin] = useTransition();
  const [pendingArc, startArc] = useTransition();

  const isFavorite = conversation.contact.is_favorite;
  const isPinned = conversation.is_pinned;
  const isArchived = conversation.is_archived;

  function onFavorite() {
    startFav(async () => {
      const res = await toggleFavoriteAction(conversation.contact.id, !isFavorite);
      if (res.ok) {
        toast.success(!isFavorite ? "Adicionado aos favoritos" : "Removido dos favoritos");
        router.refresh();
      } else {
        toast.error("Falha", { description: res.error });
      }
    });
  }
  function onPin() {
    startPin(async () => {
      const res = await togglePinnedAction(conversation.id, !isPinned);
      if (res.ok) {
        toast.success(!isPinned ? "Conversa fixada" : "Conversa desafixada");
        router.refresh();
      } else {
        toast.error("Falha", { description: res.error });
      }
    });
  }
  function onArchive() {
    startArc(async () => {
      const res = await toggleArchivedAction(conversation.id, !isArchived);
      if (res.ok) {
        toast.success(!isArchived ? "Conversa arquivada" : "Conversa desarquivada");
        router.refresh();
      } else {
        toast.error("Falha", { description: res.error });
      }
    });
  }

  return (
    <>
      <button
        onClick={onFavorite}
        disabled={pendingFav}
        className={cn(
          "p-2 hover:bg-wa-hover rounded-full transition-colors",
          isFavorite && "text-amber-400"
        )}
        title={isFavorite ? "Remover dos favoritos" : "Marcar como favorita"}
        aria-label="Favoritar"
      >
        {pendingFav ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
        )}
      </button>
      <button
        onClick={onPin}
        disabled={pendingPin}
        className={cn(
          "p-2 hover:bg-wa-hover rounded-full transition-colors",
          isPinned && "text-primary"
        )}
        title={isPinned ? "Desafixar" : "Fixar no topo"}
        aria-label="Fixar"
      >
        {pendingPin ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Pin className={cn("h-4 w-4", isPinned && "fill-current")} />
        )}
      </button>
      <button
        onClick={onArchive}
        disabled={pendingArc}
        className={cn(
          "p-2 hover:bg-wa-hover rounded-full transition-colors",
          isArchived && "text-wa-textPrimary"
        )}
        title={isArchived ? "Desarquivar" : "Arquivar"}
        aria-label="Arquivar"
      >
        {pendingArc ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isArchived ? (
          <ArchiveRestore className="h-4 w-4" />
        ) : (
          <Archive className="h-4 w-4" />
        )}
      </button>
    </>
  );
}

export function ChatWindow({
  conversation,
  initialMessages,
  internalNotes = [],
  panelData,
  quickReplies = [],
  medias = [],
  mediaCategories = [],
  allProfiles = [],
  currentUserId,
}: {
  conversation: ConversationWithContact;
  initialMessages: MessageRow[];
  internalNotes?: InternalNoteWithAuthor[];
  allProfiles?: AssigneeProfile[];
  currentUserId?: string;
  panelData: ContactPanelData | null;
  quickReplies?: QuickReplyRow[];
  medias?: MediaRow[];
  mediaCategories?: CategoryRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetMessage = searchParams.get("m"); // id DOM da msg pra rolar (vindo da busca)
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [panelOpen, setPanelOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageRow | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(initialMessages.length >= MESSAGES_PAGE);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Fecha painel + reply ao trocar de conversa
  useEffect(() => {
    setPanelOpen(false);
    setReplyingTo(null);
  }, [conversation.id]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mark as read ao abrir
  useEffect(() => {
    if (conversation.unread_count > 0) {
      markAsReadAction(conversation.id).then(() => router.refresh());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  // Reseta a lista só ao TROCAR de conversa (não a cada refresh — senão perde
  // o histórico carregado via "carregar mais"). Updates chegam por poll/realtime.
  useEffect(() => {
    setMessages(initialMessages);
    setHasMore(initialMessages.length >= MESSAGES_PAGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  async function loadOlder() {
    if (loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const res = await loadOlderMessagesAction(conversation.id, messages[0].timestamp);
    setLoadingOlder(false);
    if (!res.ok) {
      toast.error("Falha ao carregar histórico", { description: res.error });
      return;
    }
    if (res.data.length < 50) setHasMore(false);
    if (res.data.length === 0) return;
    setMessages((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]));
      for (const m of res.data) if (!map.has(m.id)) map.set(m.id, m);
      return Array.from(map.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    });
    // preserva a posição de leitura (conteúdo entrou acima)
    requestAnimationFrame(() => {
      const el2 = scrollRef.current;
      if (el2) el2.scrollTop = el2.scrollHeight - prevHeight;
    });
  }

  // Realtime + polling fallback pra mensagens dessa conversa
  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token && mounted) {
        supabase.realtime.setAuth(session.access_token);
      }
    });

    // Polling de mensagens (fallback do realtime). Sem raw_payload = ~90% mais leve.
    async function pollMessages() {
      if (!mounted) return;
      // Busca as últimas N e MESCLA (não substitui) — preserva o histórico
      // carregado via "carregar mais" e aplica novas msgs + mudanças de status.
      const { data } = await supabase
        .from("messages")
        .select(MESSAGE_COLUMNS)
        .eq("conversation_id", conversation.id)
        .order("timestamp", { ascending: false })
        .limit(MESSAGES_PAGE);
      if (!mounted || !data) return;
      const incoming = (data as unknown as MessageRow[]).slice().reverse();
      setMessages((prev) => {
        const map = new Map(prev.map((m) => [m.id, m]));
        let changed = false;
        for (const m of incoming) {
          const ex = map.get(m.id);
          if (
            !ex ||
            ex.status !== m.status ||
            ex.is_deleted !== m.is_deleted ||
            ex.edited_at !== m.edited_at ||
            ex.media_url !== m.media_url
          ) {
            map.set(m.id, m);
            changed = true;
          }
        }
        if (!changed) return prev;
        return Array.from(map.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      });
    }
    const pollInterval = setInterval(pollMessages, 6000);

    const channel = supabase
      .channel(`crm-messages-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const m = payload.new as MessageRow;
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const m = payload.new as MessageRow;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        }
      )
      .subscribe((status) => {
        console.log(`[realtime/chat:${conversation.id}] status:`, status);
      });

    return () => {
      mounted = false;
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [conversation.id]);

  // Ao abrir/trocar de conversa: ancora no final imediatamente (como o WhatsApp).
  // Reancora após uns instantes porque imagens/vídeos carregam depois e mudam a altura.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (targetMessage) return; // se veio da busca, o efeito abaixo cuida do scroll
    const toBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    toBottom();
    const raf = requestAnimationFrame(toBottom);
    const t1 = setTimeout(toBottom, 150);
    const t2 = setTimeout(toBottom, 500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [conversation.id, targetMessage]);

  // Vindo da busca (?m=): rola até a mensagem e destaca por uns segundos.
  useEffect(() => {
    if (!targetMessage) return;
    let tries = 0;
    const tryScroll = () => {
      const node = document.getElementById(targetMessage);
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightId(targetMessage);
        setTimeout(() => setHighlightId(null), 2800);
        return true;
      }
      return false;
    };
    // tenta algumas vezes (mensagens podem ainda estar carregando)
    if (tryScroll()) return;
    const iv = setInterval(() => {
      tries++;
      if (tryScroll() || tries > 10) clearInterval(iv);
    }, 200);
    return () => clearInterval(iv);
  }, [targetMessage, conversation.id, messages.length]);

  // Auto-scroll para o final quando entram mensagens novas
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Só faz scroll automático se já estava perto do final (não atrapalha leitura de histórico)
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const realName =
    conversation.contact.name?.trim() || conversation.contact.push_name?.trim();
  const formattedPhone = conversation.contact.phone ? formatPhone(conversation.contact.phone) : "";
  const contactName = realName || formattedPhone || "Sem nome";
  // Subtitle: prioriza "digitando…" / "online" se ativo, senão telefone (se diferente do nome)
  const presence = formatPresence(
    conversation.contact.presence_status,
    conversation.contact.presence_updated_at
  );
  const subtitle = presence ?? (realName ? formattedPhone : "");
  const isPresenceLive = !!presence;

  return (
    <div className="flex-1 flex min-w-0 h-full">
      <div className="flex-1 flex flex-col bg-wa-bg min-w-0">
      {/* Header */}
      <header className="h-16 bg-wa-header flex items-center justify-between gap-2 px-4 border-l border-wa-border shrink-0">
        {/* Botão voltar — só mobile */}
        <Link
          href="/chat"
          className="md:hidden p-2 -ml-2 rounded-full hover:bg-wa-hover text-wa-textSecondary shrink-0"
          aria-label="Voltar para conversas"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <button
          onClick={() => setPanelOpen(true)}
          className="flex items-center gap-3 min-w-0 hover:bg-wa-hover/50 rounded-md px-2 py-1 -ml-2 transition-colors shrink-0"
        >
          <Avatar
            src={conversation.contact.profile_pic_url}
            name={contactName}
            seed={conversation.contact.whatsapp_id}
            size={40}
          />
          <div className="min-w-0 text-left">
            <p className="font-medium text-wa-textPrimary truncate">{contactName}</p>
            {subtitle && (
              <p
                className={cn(
                  "text-xs truncate",
                  isPresenceLive ? "text-primary font-medium" : "text-wa-textSecondary"
                )}
              >
                {subtitle}
              </p>
            )}
          </div>
        </button>
        <div className="flex-1 min-w-0 flex justify-start">
          <ChatHeaderActions
            panelData={panelData}
            conversation={conversation}
            allProfiles={allProfiles}
            currentUserId={currentUserId}
          />
        </div>
        <div className="flex items-center gap-1 text-wa-textSecondary shrink-0">
          {currentUserId && (
            <ViewingIndicator conversationId={conversation.id} currentUserId={currentUserId} />
          )}
          <FavoritePinArchive conversation={conversation} />
          <button
            onClick={() => setPanelOpen((o) => !o)}
            className="p-2 hover:bg-wa-hover rounded-full"
            aria-label={panelOpen ? "Fechar painel" : "Abrir painel"}
            title={panelOpen ? "Fechar painel" : "Abrir painel"}
          >
            {panelOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </button>
          <button className="p-2 hover:bg-wa-hover rounded-full" aria-label="Mais opções">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Mensagens */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto wa-scroll px-4 md:px-12 py-4 space-y-1"
      >
        {hasMore && messages.length > 0 && (
          <div className="flex justify-center pb-2">
            <button
              onClick={loadOlder}
              disabled={loadingOlder}
              className="text-xs px-3 py-1 rounded-full bg-wa-panel border border-wa-border text-wa-textSecondary hover:bg-wa-hover disabled:opacity-50"
            >
              {loadingOlder ? "Carregando…" : "Carregar mensagens antigas"}
            </button>
          </div>
        )}
        {messages.length === 0 && internalNotes.length === 0 ? (
          <div className="h-full flex items-center justify-center text-wa-textSecondary text-sm">
            Nenhuma mensagem ainda nesta conversa.
          </div>
        ) : (
          (() => {
            // Merge messages + internal notes ordenados por timestamp
            const map = new Map(messages.map((m) => [m.id, m]));
            type Item =
              | { kind: "msg"; ts: string; id: string; data: MessageRow }
              | { kind: "note"; ts: string; id: string; data: InternalNoteWithAuthor };
            const items: Item[] = [
              ...messages.map((m) => ({ kind: "msg" as const, ts: m.timestamp, id: m.id, data: m })),
              ...internalNotes.map((n) => ({
                kind: "note" as const,
                ts: n.created_at,
                id: `note-${n.id}`,
                data: n,
              })),
            ].sort((a, b) => a.ts.localeCompare(b.ts));

            return items.map((item, i) => {
              const prev = items[i - 1];
              const showDateSep =
                !prev || !isSameDay(new Date(item.ts), new Date(prev.ts));
              if (item.kind === "msg") {
                const m = item.data;
                const quoted = m.reply_to_id ? map.get(m.reply_to_id) ?? null : null;
                return (
                  <div key={item.id} id={`msg-${m.id}`}>
                    {showDateSep && <DateSeparator date={item.ts} />}
                    <div
                      className={cn(
                        "rounded-lg transition-colors",
                        highlightId === `msg-${m.id}` && "bg-amber-400/15 ring-2 ring-amber-400/50"
                      )}
                    >
                      <MessageBubble msg={m} quotedMessage={quoted} onReply={setReplyingTo} />
                    </div>
                  </div>
                );
              }
              return (
                <div key={item.id} id={item.id}>
                  {showDateSep && <DateSeparator date={item.ts} />}
                  <div
                    className={cn(
                      "rounded-lg transition-colors",
                      highlightId === item.id && "bg-amber-400/15 ring-2 ring-amber-400/50"
                    )}
                  >
                    <InternalNoteBubble note={item.data} currentUserId={currentUserId} />
                  </div>
                </div>
              );
            });
          })()
        )}
      </div>

      <ScheduledMessagesBar conversationId={conversation.id} />
      <ComposeBar
        conversationId={conversation.id}
        quickReplies={quickReplies}
        medias={medias}
        mediaCategories={mediaCategories}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        templateCtx={{
          contactName: conversation.contact.name,
          pushName: conversation.contact.push_name,
          phone: conversation.contact.phone,
        }}
      />
      </div>
      {panelOpen && panelData && (
        <ContactPanel data={panelData} onClose={() => setPanelOpen(false)} />
      )}
    </div>
  );
}
