"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Plus, X, Tag as TagIcon, Loader2, UserCircle2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addTagToLeadAction,
  removeTagFromLeadAction,
  createTagAction,
  updateLeadFieldsAction,
  assignConversationAction,
} from "../actions";
import { getInitials } from "@/lib/format/avatar";
import type {
  ContactPanelData,
  ConversationWithContact,
  AssigneeProfile,
} from "../types";

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

function AssigneePill({
  conversation,
  allProfiles,
  currentUserId,
}: {
  conversation: ConversationWithContact;
  allProfiles: AssigneeProfile[];
  currentUserId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function pick(userId: string | null) {
    setOpen(false);
    startTransition(async () => {
      const res = await assignConversationAction(conversation.id, userId);
      if (res.ok) {
        const target = userId
          ? allProfiles.find((p) => p.id === userId)
          : null;
        toast.success(
          userId
            ? `Atribuído a ${target?.full_name ?? target?.email ?? "usuário"}`
            : "Atribuição removida"
        );
        router.refresh();
      } else {
        toast.error("Falha", { description: res.error });
      }
    });
  }

  const current = conversation.assigned_user;
  const label = current
    ? current.full_name ?? current.email ?? "Atendente"
    : "Sem atendente";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-wa-border bg-wa-bg/40 text-[11px] hover:border-primary/40 transition-colors"
      >
        {current ? (
          <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center shrink-0">
            {getInitials(current.full_name ?? current.email ?? "?").slice(0, 2)}
          </span>
        ) : (
          <UserCircle2 className="h-3.5 w-3.5 text-wa-textSecondary" />
        )}
        <span className="text-wa-textPrimary font-medium truncate max-w-[120px]">{label}</span>
        <ChevronDown className="h-3 w-3 text-wa-textSecondary" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-56 bg-wa-panel border border-wa-border rounded-lg shadow-lg z-50 py-1">
          <button
            onClick={() => pick(currentUserId ?? null)}
            disabled={!currentUserId}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-wa-hover text-left text-primary disabled:opacity-40"
          >
            <User className="h-3.5 w-3.5" />
            Atribuir a mim
          </button>
          <div className="border-t border-wa-border my-1" />
          {allProfiles.map((p) => (
            <button
              key={p.id}
              onClick={() => pick(p.id)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-wa-hover text-left",
                p.id === current?.id && "bg-wa-active"
              )}
            >
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center shrink-0">
                {getInitials(p.full_name ?? p.email ?? "?").slice(0, 2)}
              </span>
              <span className="text-wa-textPrimary truncate">
                {p.full_name ?? p.email}
              </span>
            </button>
          ))}
          {current && (
            <>
              <div className="border-t border-wa-border my-1" />
              <button
                onClick={() => pick(null)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-wa-hover text-left text-red-400"
              >
                <X className="h-3.5 w-3.5" />
                Remover atribuição
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ChatHeaderActions({
  panelData,
  conversation,
  allProfiles = [],
  currentUserId,
}: {
  panelData: ContactPanelData | null;
  conversation?: ConversationWithContact;
  allProfiles?: AssigneeProfile[];
  currentUserId?: string;
}) {
  if (!panelData) return null;
  return (
    <div className="flex items-center gap-2 min-w-0 flex-wrap">
      <StagePill panelData={panelData} />
      {conversation && (
        <AssigneePill
          conversation={conversation}
          allProfiles={allProfiles}
          currentUserId={currentUserId}
        />
      )}
      <TagPills panelData={panelData} />
    </div>
  );
}
