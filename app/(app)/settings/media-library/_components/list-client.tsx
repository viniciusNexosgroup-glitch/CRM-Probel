"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import {
  Plus,
  Trash2,
  FileText,
  Video,
  Music,
  Image as ImageIcon,
  Library,
  Pencil,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadDialog } from "./upload-dialog";
import { deleteMediaAction, updateMediaAction } from "../actions";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Media = Database["public"]["Tables"]["media_library"]["Row"];
type Category = Database["public"]["Tables"]["media_categories"]["Row"];
type FileType = "image" | "video" | "audio" | "document";

function FileIcon({ type, className }: { type: Media["file_type"]; className?: string }) {
  if (type === "image") return <ImageIcon className={className} />;
  if (type === "video") return <Video className={className} />;
  if (type === "audio") return <Music className={className} />;
  return <FileText className={className} />;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

const TYPE_OPTIONS: { v: FileType; label: string; emoji: string }[] = [
  { v: "image", label: "Imagem", emoji: "🖼️" },
  { v: "video", label: "Vídeo", emoji: "🎬" },
  { v: "audio", label: "Áudio", emoji: "🎵" },
  { v: "document", label: "Documento", emoji: "📄" },
];

function TypeChangePopover({
  media,
  onChanged,
}: {
  media: Media;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function pick(t: FileType) {
    if (t === media.file_type) {
      setOpen(false);
      return;
    }
    setSaving(true);
    const res = await updateMediaAction(media.id, { file_type: t });
    setSaving(false);
    if (res.ok) {
      toast.success(`Tipo alterado para ${TYPE_OPTIONS.find((o) => o.v === t)?.label}`);
      setOpen(false);
      onChanged();
    } else {
      toast.error("Falha", { description: res.error });
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="p-1 bg-black/60 rounded text-white/80 hover:text-primary"
        aria-label="Mudar tipo"
        title="Mudar tipo"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-wa-panel border border-wa-border rounded-md shadow-lg p-1 z-20 min-w-32">
          {TYPE_OPTIONS.map((o) => (
            <button
              key={o.v}
              onClick={() => pick(o.v)}
              disabled={saving}
              className={cn(
                "w-full px-2 py-1 text-xs text-left rounded hover:bg-wa-hover flex items-center gap-2",
                o.v === media.file_type && "bg-wa-active text-primary"
              )}
            >
              <span>{o.emoji}</span>
              {o.label}
              {o.v === media.file_type && <Check className="h-3 w-3 ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MediaList({
  initial,
  categories,
}: {
  initial: Media[];
  categories: Category[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function onDelete(m: Media) {
    if (!confirm(`Deletar "${m.title}"?`)) return;
    const res = await deleteMediaAction(m.id);
    if (res.ok) {
      toast.success("Removida");
      router.refresh();
    } else {
      toast.error("Falha", { description: res.error });
    }
  }

  // Agrupa por categoria
  const grouped = new Map<string, { category: Category | null; items: Media[] }>();
  for (const c of categories) {
    grouped.set(c.id, { category: c, items: [] });
  }
  grouped.set("none", { category: null, items: [] });

  for (const m of initial) {
    const key = m.category_id ?? "none";
    if (!grouped.has(key)) grouped.set(key, { category: null, items: [] });
    grouped.get(key)!.items.push(m);
  }

  const groups = Array.from(grouped.values()).filter((g) => g.items.length > 0);

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Nova mídia
        </Button>
      </div>

      {initial.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Library className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhuma mídia cadastrada.</p>
          <p className="text-xs mt-1">
            Suba seus vídeos de apresentação, fotos de produto e PDFs aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ category, items }) => (
            <div key={category?.id ?? "none"}>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                {category && (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: category.color ?? "#888" }}
                  />
                )}
                {category?.name ?? "Sem categoria"}
                <span className="text-wa-textTertiary">({items.length})</span>
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {items.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-lg border border-border bg-card overflow-hidden hover:border-primary/40 transition-colors group"
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
                          <FileIcon type={m.file_type} className="h-7 w-7" />
                        </div>
                      )}
                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <TypeChangePopover media={m} onChanged={() => router.refresh()} />
                        <button
                          onClick={() => onDelete(m)}
                          className="p-1 bg-black/60 rounded text-white/80 hover:text-red-400"
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-foreground truncate">
                        {m.title}
                      </p>
                      {m.description && (
                        <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                          {m.description}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                        <FileIcon type={m.file_type} className="h-3 w-3" />
                        <span className="uppercase">{m.file_type}</span>
                        {m.file_size && <span>· {formatSize(m.file_size)}</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <UploadDialog open={open} onClose={() => setOpen(false)} categories={categories} />
    </>
  );
}
