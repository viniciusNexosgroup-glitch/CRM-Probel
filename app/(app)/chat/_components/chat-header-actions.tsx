"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Plus, X, Tag as TagIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addTagToLeadAction,
  removeTagFromLeadAction,
  createTagAction,
  updateLeadFieldsAction,
} from "../actions";
import type { ContactPanelData } from "../types";

const NEW_TAG_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

function StagePill({
  panelData,
}: {
  panelData: ContactPanelData;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const lead = panelData.lead;
  const currentStage = panelData.allStages.find((s) => s.id === lead?.stage_id);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!lead) {
    return (
      <span className="text-[11px] text-wa-textTertiary">Contato sem lead (grupo)</span>
    );
  }

  function pick(stageId: string) {
    if (!lead || stageId === lead.stage_id) {
      setOpen(false);
      return;
    }
    setOpen(false);
    startTransition(async () => {
      const res = await updateLeadFieldsAction(lead.id, { stage_id: stageId });
      if (res.ok) {
        const stage = panelData.allStages.find((s) => s.id === stageId);
        toast.success(`Movido para "${stage?.name}"`);
        router.refresh();
      } else {
        toast.error("Falha ao mover", { description: res.error });
      }
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-wa-border bg-wa-bg/40 text-[11px] hover:border-primary/40 transition-colors"
      >
        {currentStage && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: currentStage.color }}
          />
        )}
        <span className="text-wa-textPrimary font-medium">
          {currentStage?.name ?? "Sem estágio"}
        </span>
        <ChevronDown className="h-3 w-3 text-wa-textSecondary" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-48 bg-wa-panel border border-wa-border rounded-lg shadow-lg z-50 py-1">
          {panelData.allStages.map((s) => (
            <button
              key={s.id}
              onClick={() => pick(s.id)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-wa-hover text-left",
                s.id === lead.stage_id && "bg-wa-active"
              )}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-wa-textPrimary">{s.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TagPills({
  panelData,
}: {
  panelData: ContactPanelData;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const lead = panelData.lead;
  const currentTags = lead?.lead_tags.map((lt) => lt.tag) ?? [];
  const currentIds = new Set(currentTags.map((t) => t.id));
  const availableTags = panelData.allTags.filter((t) => !currentIds.has(t.id));

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!lead) return null;

  function addTag(tagId: string) {
    if (!lead) return;
    startTransition(async () => {
      const res = await addTagToLeadAction(lead.id, tagId);
      if (!res.ok) toast.error("Falha", { description: res.error });
      else router.refresh();
    });
  }

  function removeTag(tagId: string) {
    if (!lead) return;
    startTransition(async () => {
      const res = await removeTagFromLeadAction(lead.id, tagId);
      if (!res.ok) toast.error("Falha", { description: res.error });
      else router.refresh();
    });
  }

  async function createAndAdd() {
    if (!lead) return;
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    const color = NEW_TAG_COLORS[Math.floor(Math.random() * NEW_TAG_COLORS.length)];
    const res = await createTagAction(name, color);
    if (!res.ok) {
      toast.error("Falha", { description: res.error });
      setCreating(false);
      return;
    }
    const addRes = await addTagToLeadAction(lead.id, res.data!.id);
    if (!addRes.ok) toast.error("Falha", { description: addRes.error });
    setCreating(false);
    setNewName("");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative flex items-center gap-1.5 flex-wrap">
      {currentTags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-wa-border"
          style={{ backgroundColor: `${tag.color}25`, color: tag.color }}
        >
          <TagIcon className="h-2.5 w-2.5" />
          {tag.name}
          <button
            onClick={() => removeTag(tag.id)}
            className="hover:bg-black/20 rounded-full p-0.5"
            aria-label="Remover"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-dashed border-wa-border text-wa-textSecondary hover:text-wa-textPrimary hover:border-primary/50"
      >
        <Plus className="h-2.5 w-2.5" />
        Etiqueta
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-64 bg-wa-panel border border-wa-border rounded-lg shadow-lg z-50 p-2 space-y-2">
          {availableTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {availableTags.map((t) => (
                <button
                  key={t.id}
                  onClick={() => addTag(t.id)}
                  className="text-[11px] px-2 py-0.5 rounded-full border border-wa-border hover:opacity-80"
                  style={{ backgroundColor: `${t.color}25`, color: t.color }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createAndAdd()}
              placeholder="Nova etiqueta…"
              className="flex-1 h-7 px-2 text-xs rounded-md bg-wa-bg border border-wa-border focus:outline-none focus:border-primary/40"
            />
            <button
              onClick={createAndAdd}
              disabled={creating || !newName.trim()}
              className="h-7 px-2 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1"
            >
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Criar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ChatHeaderActions({ panelData }: { panelData: ContactPanelData | null }) {
  if (!panelData) return null;
  return (
    <div className="bg-wa-header border-l border-t border-wa-border px-4 py-1.5 flex items-center gap-2 flex-wrap shrink-0">
      <StagePill panelData={panelData} />
      <span className="text-wa-textTertiary text-xs">·</span>
      <TagPills panelData={panelData} />
    </div>
  );
}
