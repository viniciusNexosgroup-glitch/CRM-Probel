"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, Loader2, MessageSquare, StickyNote, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar } from "./avatar";
import { formatRelativeTime } from "@/lib/format/date";
import { formatPhone } from "@/lib/format/avatar";
import { cn } from "@/lib/utils";
import { searchMessagesAction, type SearchHit } from "../actions";

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  const before = text.slice(Math.max(0, idx - 30), idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length, idx + query.length + 80);
  return (
    <>
      {idx > 30 && "…"}
      {before}
      <mark className="bg-amber-500/40 text-amber-100 rounded px-0.5">{match}</mark>
      {after}
      {idx + query.length + 80 < text.length && "…"}
    </>
  );
}

function displayName(c: SearchHit["contact"]): string {
  if (!c) return "Sem contato";
  return c.name?.trim() || c.push_name?.trim() || (c.phone ? formatPhone(c.phone) : "Sem nome");
}

export function GlobalSearchDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const res = await searchMessagesAction(query);
      setLoading(false);
      if (res.ok) setResults(res.data);
    }, 300);
  }, [query]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Pesquisar nas conversas
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-wa-textSecondary" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite uma palavra ou frase…"
            className="pl-9 h-10"
            autoFocus
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
          )}
        </div>

        <div className="flex-1 overflow-y-auto wa-scroll min-h-0">
          {query.trim().length < 2 ? (
            <p className="text-xs text-wa-textSecondary text-center py-8">
              Digite ao menos 2 letras pra buscar em mensagens e notas internas.
            </p>
          ) : !loading && results.length === 0 ? (
            <p className="text-xs text-wa-textSecondary text-center py-8">
              Nada encontrado pra &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <ul className="space-y-1">
              {results.map((hit) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <Link
                    href={`/chat?c=${hit.conversationId}&m=${
                      hit.kind === "message" ? `msg-${hit.id}` : `note-${hit.id}`
                    }`}
                    onClick={onClose}
                    className="flex items-start gap-3 px-3 py-2 rounded-md hover:bg-wa-hover transition-colors"
                  >
                    <Avatar
                      src={hit.contact?.profile_pic_url}
                      name={displayName(hit.contact)}
                      seed={hit.contact?.whatsapp_id ?? hit.conversationId}
                      size={32}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-wa-textPrimary truncate">
                          {displayName(hit.contact)}
                        </p>
                        <span className="text-[10px] text-wa-textSecondary shrink-0">
                          {formatRelativeTime(hit.timestamp)}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "text-xs truncate flex items-center gap-1",
                          hit.kind === "note" ? "text-amber-400" : "text-wa-textSecondary"
                        )}
                      >
                        {hit.kind === "note" ? (
                          <StickyNote className="h-3 w-3 shrink-0" />
                        ) : hit.fromMe ? (
                          <span className="text-wa-textTertiary text-[10px]">Você:</span>
                        ) : (
                          <MessageSquare className="h-3 w-3 shrink-0" />
                        )}
                        <span className="truncate">{highlight(hit.content, query)}</span>
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={onClose}
          className="absolute right-3 top-3 p-1 rounded-md hover:bg-accent"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </DialogContent>
    </Dialog>
  );
}
