"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, MoreVertical, Smile, Paperclip, SendHorizonal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "./avatar";
import { MessageBubble } from "./message-bubble";
import { DateSeparator } from "./date-separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isSameDay } from "@/lib/format/date";
import { formatPhone } from "@/lib/format/avatar";
import { markAsReadAction } from "../actions";
import type { ConversationWithContact, MessageRow } from "../types";

export function ChatWindow({
  conversation,
  initialMessages,
}: {
  conversation: ConversationWithContact;
  initialMessages: MessageRow[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mark as read ao abrir
  useEffect(() => {
    if (conversation.unread_count > 0) {
      markAsReadAction(conversation.id).then(() => router.refresh());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  // Realtime: nova mensagem nesta conversa
  useEffect(() => {
    setMessages(initialMessages);
    const supabase = createClient();
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
      .subscribe();
    return () => {
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

  const contactName =
    conversation.contact.name?.trim() ||
    conversation.contact.push_name?.trim() ||
    (conversation.contact.phone ? formatPhone(conversation.contact.phone) : "Sem nome");

  return (
    <div className="flex-1 flex flex-col bg-wa-bg min-w-0">
      {/* Header */}
      <header className="h-16 bg-wa-header flex items-center justify-between px-4 border-l border-wa-border shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar
            src={conversation.contact.profile_pic_url}
            name={contactName}
            seed={conversation.contact.whatsapp_id}
            size={40}
          />
          <div className="min-w-0">
            <p className="font-medium text-wa-textPrimary truncate">{contactName}</p>
            <p className="text-xs text-wa-textSecondary">{formatPhone(conversation.contact.phone)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-wa-textSecondary">
          <button className="p-2 hover:bg-wa-hover rounded-full" aria-label="Ligar">
            <Phone className="h-4 w-4" />
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
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-wa-textSecondary text-sm">
            Nenhuma mensagem ainda nesta conversa.
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const showDateSep =
              !prev || !isSameDay(new Date(m.timestamp), new Date(prev.timestamp));
            return (
              <div key={m.id}>
                {showDateSep && <DateSeparator date={m.timestamp} />}
                <MessageBubble msg={m} />
              </div>
            );
          })
        )}
      </div>

      {/* Compose (desabilitado até Etapa 10) */}
      <footer className="bg-wa-header px-3 py-2 border-l border-wa-border shrink-0">
        <div className="flex items-center gap-2">
          <button
            className="p-2 text-wa-textSecondary cursor-not-allowed opacity-50"
            disabled
            aria-label="Emoji"
          >
            <Smile className="h-5 w-5" />
          </button>
          <button
            className="p-2 text-wa-textSecondary cursor-not-allowed opacity-50"
            disabled
            aria-label="Anexar"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <Input
            disabled
            placeholder="Envio de mensagens disponível na próxima etapa…"
            className="bg-wa-panel border-0 text-sm h-10"
          />
          <Button disabled size="icon" variant="ghost" aria-label="Enviar">
            <SendHorizonal className="h-5 w-5" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
