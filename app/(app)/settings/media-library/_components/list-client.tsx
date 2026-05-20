"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { Plus, Trash2, FileText, Video, Music, Image as ImageIcon, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadDialog } from "./upload-dialog";
import { deleteMediaAction } from "../actions";
import type { Database } from "@/types/database";

type Media = Database["public"]["Tables"]["media_library"]["Row"];
type Category = Database["public"]["Tables"]["media_categories"]["Row"];

function FileIcon({ type }: { type: Media["file_type"] }) {
  if (type === "image") return <ImageIcon className="h-5 w-5" />;
  if (type === "video") return <Video className="h-5 w-5" />;
  if (type === "audio") return <Music className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
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
                          <FileIcon type={m.file_type} />
                        </div>
                      )}
                      <button
                        onClick={() => onDelete(m)}
                        className="absolute top-1 right-1 p-1 bg-black/60 rounded text-white/80 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
                        <FileIcon type={m.file_type} />
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
