"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Loader2, Forward, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "./avatar";
import { cn } from "@/lib/utils";
import { formatPhone } from "@/lib/format/avatar";
import { formatRelativeTime } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/client";
import { forwardMessageAction } from "../actions";
import type { MessageRow } from "../types";

type Target = {
  id: string;
  last_message_at: string | null;
  contact: {
    id: string;
    name: string | null;
    push_name: string | null;
    phone: string | null;
    profile_pic_url: string | null;
    whatsapp_id: string;
  } | null;
};

function displayName(c: Target["contact"]): string {
  if (!c) return "Sem contato";
  return c.name?.trim() || c.push_name?.trim() || (c.phone ? formatPhone(c.phone) : "Sem nome");
}

export function ForwardDialog({
  message,
  open,
  onClose,
}: {
  message: MessageRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [conversations, setConversations] = useState<Target[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setQuery("");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("conversations")
      .select(
        `id, last_message_at, contact:contacts!conversations_contact_id_fkey (id, name, push_name, phone, profile_pic_url, whatsapp_id)`
      )
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200)
      .then(({ data }) => {
        setLoading(false);
        setConversations((data ?? []) as unknown as Target[]);
      });
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.toLowerCase();
    return conversations.filter((c) => {
      const name = displayName(c.contact).toLowerCase();
      return name.includes(q);
    });
  }, [conversations, query]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSubmit() {
    if (!message || selected.size === 0) return;
    setSending(true);
    startTransition(async () => {
      const res = await forwardMessageAction(message.id, Array.from(selected));
      setSending(false);
      if (res.ok) {
        if (res.data.failed > 0) {
          toast.warning(
            `Encaminhado para ${res.data.sent} · ${res.data.failed} falhou`
          );
        } else {
          toast.success(`Encaminhado para ${res.data.sent} ${res.data.sent === 1 ? "conversa" : "conversas"}`);
        }
        setSelected(new Set());
        onClose();
        router.refresh();
      } else {
        toast.error("Falha", { description: res.error });
      }
    });
  }

  if (!message) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !sending && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Forward className="h-5 w-5 text-primary" /> Encaminhar mensagem
          </DialogTitle>
        </DialogHeader>

        <div className="px-3 py-2 rounded-md bg-wa-bg/40 border border-wa-border text-xs text-wa-textSecondary">
          <p className="font-medium text-wa-textPrimary mb-0.5">Pré-visualização:</p>
          <p className="truncate">
            {message.content ??
              message.media_caption ??
              (message.message_type === "image"
                ? "📷 Imagem"
                : message.message_type === "video"
                  ? "🎥 Vídeo"
                  : message.message_type === "audio"
                    ? "🎵 Áudio"
                    : "📄 Documento")}
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-wa-textSecondary" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar conversa…"
            className="pl-9 h-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto wa-scroll min-h-0 border border-wa-border rounded-md">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-wa-textSecondary text-xs">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Carregando conversas…
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-wa-textSecondary text-center py-8">
              Nenhuma conversa encontrada.
            </p>
          ) : (
            <ul>
              {filtered.map((c) => {
                const isSelected = selected.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 hover:bg-wa-hover border-b border-wa-border/40 text-left transition-colors",
                        isSelected && "bg-primary/10"
                      )}
                    >
                      <div
                        className={cn(
                          "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-wa-border"
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <Avatar
                        src={c.contact?.profile_pic_url}
                        name={displayName(c.contact)}
                        seed={c.contact?.whatsapp_id ?? c.id}
                        size={32}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-wa-textPrimary truncate">
                          {displayName(c.contact)}
                        </p>
                        {c.last_message_at && (
                          <p className="text-[10px] text-wa-textSecondary">
                            {formatRelativeTime(c.last_message_at)}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={sending || selected.size === 0}>
            {sending ? (
              <Loader2 className="animate-spin h-4 w-4" />
            ) : (
              <Forward className="h-4 w-4" />
            )}
            Encaminhar para {selected.size}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
