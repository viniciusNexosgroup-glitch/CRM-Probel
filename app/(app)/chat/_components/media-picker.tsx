"use client";

import { useState, useTransition, useMemo } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Library,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  X,
  Loader2,
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { sendMediaFromLibraryAction } from "../actions";
import type { Database } from "@/types/database";

type Media = Database["public"]["Tables"]["media_library"]["Row"];
type Category = Database["public"]["Tables"]["media_categories"]["Row"];

function FileIcon({ type, size = 5 }: { type: Media["file_type"]; size?: number }) {
  const cls = `h-${size} w-${size}`;
  if (type === "image") return <ImageIcon className={cls} />;
  if (type === "video") return <Video className={cls} />;
  if (type === "audio") return <Music className={cls} />;
  return <FileText className={cls} />;
}

export function MediaPicker({
  open,
  onClose,
  conversationId,
  medias,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  medias: Media[];
  categories: Category[];
}) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-5 w-5 text-primary" /> Enviar da biblioteca
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-wa-textSecondary" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar mídia…"
              className="pl-9 h-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveCategory(null)}
              className={cn(
                "text-[11px] px-2.5 py-1 rounded-full border",
                activeCategory === null
                  ? "bg-primary/15 text-primary border-primary/40 font-medium"
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
                  "inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                  activeCategory === c.id
                    ? "bg-primary/15 text-primary border-primary/40 font-medium"
                    : "border-wa-border text-wa-textSecondary hover:bg-wa-hover"
                )}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: c.color ?? "#888" }}
                />
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto wa-scroll">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-wa-textSecondary">
              {medias.length === 0
                ? "Nenhuma mídia cadastrada ainda. Vá em Mídias no menu lateral pra subir a primeira."
                : "Nenhuma mídia corresponde aos filtros."}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map((m) => {
                const sending = sendingId === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => onSend(m)}
                    disabled={!!sendingId}
                    className={cn(
                      "text-left rounded-lg border border-border bg-card overflow-hidden hover:border-primary/60 transition-colors group relative",
                      sending && "ring-2 ring-primary"
                    )}
                  >
                    <div className="aspect-square bg-wa-bg/40 flex items-center justify-center relative">
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
                          <FileIcon type={m.file_type} size={8} />
                        </div>
                      )}
                      {sending && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-foreground truncate">
                        {m.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <FileIcon type={m.file_type} size={3} />
                        <span className="uppercase">{m.file_type}</span>
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="absolute right-2 top-2 p-2 rounded hover:bg-accent"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </DialogContent>
    </Dialog>
  );
}
