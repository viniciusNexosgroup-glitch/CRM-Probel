"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StickyNote, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format/date";
import { getInitials } from "@/lib/format/avatar";
import { deleteInternalNoteAction } from "../actions";
import type { InternalNoteWithAuthor } from "../types";

export function InternalNoteBubble({
  note,
  currentUserId,
}: {
  note: InternalNoteWithAuthor;
  currentUserId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hovering, setHovering] = useState(false);

  const isOwn = note.author_id === currentUserId;
  const authorName = note.author?.full_name ?? note.author?.email ?? "Sistema";

  function onDelete() {
    if (!confirm("Excluir esta nota interna?")) return;
    startTransition(async () => {
      const res = await deleteInternalNoteAction(note.id);
      if (res.ok) {
        toast.success("Nota removida");
        router.refresh();
      } else {
        toast.error("Falha", { description: res.error });
      }
    });
  }

  return (
    <div
      className="flex justify-center my-2"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="max-w-[80%] w-full md:max-w-[70%] rounded-lg bg-amber-500/15 border-l-4 border-amber-400 px-3 py-2 relative">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 text-[11px] text-amber-300 font-medium">
            <StickyNote className="h-3 w-3" />
            <span className="w-4 h-4 rounded-full bg-amber-500/30 text-[8px] flex items-center justify-center font-bold">
              {getInitials(authorName).slice(0, 2)}
            </span>
            <span>{authorName}</span>
            <span className="text-[10px] text-amber-300/60">· Nota interna</span>
          </div>
          {isOwn && hovering && (
            <button
              onClick={onDelete}
              disabled={pending}
              className="text-amber-400/60 hover:text-red-400 transition-colors"
              aria-label="Excluir nota"
            >
              {pending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
        <p className={cn("text-sm whitespace-pre-wrap break-words text-amber-100")}>{note.content}</p>
        <span className="text-[10px] text-amber-300/60 mt-1 block">
          {formatTime(note.created_at)}
        </span>
      </div>
    </div>
  );
}
