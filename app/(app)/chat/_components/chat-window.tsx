"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { isSameDay } from "@/lib/format/date";
import { formatPhone } from "@/lib/format/avatar";
import { cn } from "@/lib/utils";
import {
  markAsReadAction,
  toggleFavoriteAction,
  togglePinnedAction,
  toggleArchivedAction,
} from "../actions";
import type {
  ConversationWithContact,
  ContactPanelData,
  MessageRow,
  AssigneeProfile,
} from "../types";
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
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [panelOpen, setPanelOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageRow | null>(null);

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

  // Realtime + polling fallback pra mensagens dessa conversa
  useEffect(() => {
    setMessages(initialMessages);
    const supabase = createClient();
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token && mounted) {
        supabase.realtime.setAuth(session.access_token);
      }
    });

    // Polling de mensagens dessa conversa a cada 3s (mais responsivo que a sidebar)
    async function pollMessages() {
      if (!mounted) return;
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("timestamp", { ascending: true })
        .limit(200);
      if (!mounted || !data) return;
      setMessages((prev) => {
        // Só atualiza se há diferença pra não causar re-render inútil
        if (prev.length === data.length && prev[prev.length - 1]?.id === data[data.length - 1]?.id) {
          // Mesmas mensagens — checa só os status que podem ter mudado
          const changed = data.some((d, i) => prev[i]?.status !== d.status);
          if (!changed) return prev;
        }
        return data as MessageRow[];
      });
    }
    const pollInterval = setInterval(pollMessages, 3000);

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
  }, [conversation.id, initialMessages]);

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
  // Só mostra a linha de telefone embaixo se for diferente do nome (evita duplicação)
  const subtitle = realName ? formattedPhone : "";

  return (
    <div className="flex-1 flex min-w-0 h-full">
      <div className="flex-1 flex flex-col bg-wa-bg min-w-0">
      {/* Header */}
      <header className="h-16 bg-wa-header flex items-center justify-between gap-3 px-4 border-l border-wa-border shrink-0">
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
              <p className="text-xs text-wa-textSecondary">{subtitle}</p>
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
                  <div key={item.id}>
                    {showDateSep && <DateSeparator date={item.ts} />}
                    <MessageBubble msg={m} quotedMessage={quoted} onReply={setReplyingTo} />
                  </div>
                );
              }
              return (
                <div key={item.id}>
                  {showDateSep && <DateSeparator date={item.ts} />}
                  <InternalNoteBubble note={item.data} currentUserId={currentUserId} />
                </div>
              );
            });
          })()
        )}
      </div>

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
