"use client";

import { useEffect, useMemo, useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Search, Loader2, Library, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { MediaThumb } from "@/components/media-thumb";
import { sendMediaFromLibraryAction, sendUploadedMediaAction } from "../actions";
import type { Database } from "@/types/database";

const MAX_UPLOAD_MB = 50;

function fileTypeFromMime(mime: string): "image" | "video" | "audio" | "document" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

type Media = Database["public"]["Tables"]["media_library"]["Row"];
type Category = Database["public"]["Tables"]["media_categories"]["Row"];

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
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onUploadAndSend(file: File) {
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      toast.error(`Arquivo muito grande (máx ${MAX_UPLOAD_MB}MB)`);
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `adhoc/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safe}`;

    const { error: upErr } = await supabase.storage
      .from("contact-media")
      .upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (upErr) {
      toast.error("Falha no upload", { description: upErr.message });
      setUploading(false);
      return;
    }

    const { data: pub } = supabase.storage.from("contact-media").getPublicUrl(path);

    const res = await sendUploadedMediaAction(conversationId, {
      fileUrl: pub.publicUrl,
      fileType: fileTypeFromMime(file.type),
      mimetype: file.type || "application/octet-stream",
      fileName: file.name,
    });

    setUploading(false);
    if (!res.ok) {
      toast.error("Falha ao enviar", { description: res.error });
      return;
    }
    toast.success("Enviado!");
    onClose();
  }

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

        {/* Enviar do computador (sem cadastrar) */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,video/*,audio/*,application/pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUploadAndSend(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-md border border-dashed border-primary/40 text-xs text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando…
            </>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5" /> Enviar arquivo do computador
            </>
          )}
        </button>

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
                    <MediaThumb
                      fileType={m.file_type}
                      fileUrl={m.file_url}
                      alt={m.title}
                      iconSize="h-7 w-7"
                    />
                    {sending && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    )}
                    {/* Badge do tipo */}
                    {m.file_type !== "image" && (
                      <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1 py-0.5 rounded uppercase font-medium z-10">
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
