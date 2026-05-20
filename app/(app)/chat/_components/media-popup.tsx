"use client";

import { useEffect, useMemo, useState, useTransition, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Search, Image as ImageIcon, Video, Music, FileText, Loader2, Library } from "lucide-react";
import { cn } from "@/lib/utils";
import { sendMediaFromLibraryAction } from "../actions";
import type { Database } from "@/types/database";

type Media = Database["public"]["Tables"]["media_library"]["Row"];
type Category = Database["public"]["Tables"]["media_categories"]["Row"];

function FileIcon({ type, className }: { type: Media["file_type"]; className?: string }) {
  if (type === "image") return <ImageIcon className={className} />;
  if (type === "video") return <Video className={className} />;
  if (type === "audio") return <Music className={className} />;
  return <FileText className={className} />;
}

/**
 * Popup inline acima do compose com thumbnails da biblioteca de mídias.
 * Click numa mídia envia direto.
 */
export function MediaPopup({
  conversationId,
  medias,
  categories,
  onClose,
}: {
  conversationId: string;
  medias: Media[];
  categories: Category[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  // Click fora fecha
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        // Não fecha se clicou no botão que abre o popup
        if (target.closest("[data-media-trigger]")) return;
        onClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const filtered = useMemo(() => {
    return medias.filter((m) => {
      if (activeCategory && m.category_id !== activeCategory) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (
          !m.title.toLowerCase().includes(q) &&
          !(m.description?.toLowerCase().includes(q) ?? false)
        )
          return false;
      }
      return true;
    });
  }, [medias, activeCategory, query]);

  function onSend(m: Media) {
    if (sendingId) return;
    setSendingId(m.id);
    startTransition(async () => {
      const res = await sendMediaFromLibraryAction(conversationId, m.id);
      setSendingId(null);
      if (!res.ok) {
        toast.error("Falha ao enviar", { description: res.error });
        return;
      }
      toast.success("Enviado!");
      onClose();
    });
  }

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-2 mx-3 bg-wa-panel border border-wa-border rounded-lg shadow-lg max-h-[400px] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-wa-border space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-wa-textTertiary inline-flex items-center gap-1">
            <Library className="h-3 w-3" />
            Biblioteca de mídias
          </span>
          <span className="text-[10px] text-wa-textTertiary">
            Click envia · Esc fecha
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-wa-textSecondary" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar mídia…"
              className="w-full pl-8 h-7 text-xs rounded-md bg-wa-bg border border-wa-border focus:outline-none focus:border-primary/40"
            />
          </div>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-full border",
              activeCategory === null
                ? "bg-primary/15 text-primary border-primary/40"
                : "border-wa-border text-wa-textSecondary hover:bg-wa-hover"
            )}
          >
            Todas
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id === activeCategory ? null : c.id)}
              className={cn(
                "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                activeCategory === c.id
                  ? "bg-primary/15 text-primary border-primary/40 font-medium"
                  : "border-wa-border text-wa-textSecondary hover:bg-wa-hover"
              )}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: c.color ?? "#888" }}
              />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de thumbnails */}
      <div className="flex-1 overflow-y-auto wa-scroll p-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-xs text-wa-textSecondary">
            {medias.length === 0
              ? "Sem mídias. Acesse Mídias no menu pra cadastrar."
              : "Nenhuma corresponde aos filtros."}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {filtered.map((m) => {
              const sending = sendingId === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => onSend(m)}
                  disabled={!!sendingId}
                  title={m.title}
                  className={cn(
                    "text-left rounded-md border border-wa-border bg-wa-bg/40 overflow-hidden hover:border-primary/60 transition-colors group relative",
                    sending && "ring-2 ring-primary"
                  )}
                >
                  <div className="aspect-square flex items-center justify-center relative">
                    {m.file_type === "image" ? (
                      <Image
                        src={m.file_url}
                        alt={m.title}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className="text-wa-textTertiary">
                        <FileIcon type={m.file_type} className="h-7 w-7" />
                      </div>
                    )}
                    {sending && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    )}
                    {/* Badge do tipo */}
                    {m.file_type !== "image" && (
                      <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1 py-0.5 rounded uppercase font-medium">
                        {m.file_type}
                      </span>
                    )}
                  </div>
                  <div className="px-1.5 py-1">
                    <p className="text-[10px] text-wa-textPrimary truncate">{m.title}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
