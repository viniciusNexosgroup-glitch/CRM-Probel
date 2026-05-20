"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X, Tag as TagIcon, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  addTagToLeadAction,
  removeTagFromLeadAction,
  createTagAction,
} from "../actions";
import type { TagRow } from "../types";

const NEW_TAG_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

export function TagsEditor({
  leadId,
  currentTags,
  allTags,
}: {
  leadId: string;
  currentTags: TagRow[];
  allTags: TagRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const currentIds = new Set(currentTags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !currentIds.has(t.id));

  function addTag(tagId: string) {
    startTransition(async () => {
      const res = await addTagToLeadAction(leadId, tagId);
      if (!res.ok) toast.error("Falha", { description: res.error });
    });
  }

  function removeTag(tagId: string) {
    startTransition(async () => {
      const res = await removeTagFromLeadAction(leadId, tagId);
      if (!res.ok) toast.error("Falha", { description: res.error });
    });
  }

  async function createAndAdd() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    const color = NEW_TAG_COLORS[Math.floor(Math.random() * NEW_TAG_COLORS.length)];
    const res = await createTagAction(name, color);
    if (!res.ok) {
      toast.error("Falha ao criar tag", { description: res.error });
      setCreating(false);
      return;
    }
    const addRes = await addTagToLeadAction(leadId, res.data!.id);
    if (!addRes.ok) toast.error("Falha", { description: addRes.error });
    setCreating(false);
    setNewName("");
    router.refresh();
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-wa-textTertiary">
        Etiquetas
      </Label>
      <div className="flex flex-wrap gap-1.5">
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
          onClick={() => setPickerOpen((o) => !o)}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-dashed border-wa-border text-wa-textSecondary hover:text-wa-textPrimary hover:border-primary/50"
        >
          <Plus className="h-2.5 w-2.5" />
          Adicionar
        </button>
      </div>

      {pickerOpen && (
        <div className="mt-2 p-2 bg-wa-bg/40 rounded-md border border-wa-border space-y-2">
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
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nova etiqueta…"
              className="h-7 text-xs bg-wa-bg"
              onKeyDown={(e) => e.key === "Enter" && createAndAdd()}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={createAndAdd}
              disabled={creating || !newName.trim()}
              className="h-7 text-xs px-2"
            >
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Criar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
