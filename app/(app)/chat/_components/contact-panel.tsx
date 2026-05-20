"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Phone, X, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "./avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatPhone } from "@/lib/format/avatar";
import { NotesEditor } from "./notes-editor";
import { TagsEditor } from "./tags-editor";
import { TasksSection } from "./tasks-section";
import { LeadSummary } from "./lead-summary";
import { updateContactNameAction } from "../actions";
import type { ContactPanelData } from "../types";

export function ContactPanel({
  data,
  onClose,
}: {
  data: ContactPanelData;
  onClose: () => void;
}) {
  const router = useRouter();
  const { contact, lead, tasks, allTags, allStages } = data;

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(
    contact.name?.trim() || contact.push_name?.trim() || ""
  );

  useEffect(() => {
    setName(contact.name?.trim() || contact.push_name?.trim() || "");
  }, [contact.id, contact.name, contact.push_name]);

  async function saveName() {
    const res = await updateContactNameAction(contact.id, name);
    if (!res.ok) {
      toast.error("Falha ao salvar nome", { description: res.error });
      return;
    }
    setEditingName(false);
    router.refresh();
  }

  const leadTags = lead?.lead_tags.map((lt) => lt.tag) ?? [];
  const displayName =
    name || (contact.phone ? formatPhone(contact.phone) : "Sem nome");

  return (
    <aside className="w-[340px] shrink-0 bg-wa-panel border-l border-wa-border flex flex-col h-full">
      <header className="h-16 bg-wa-header flex items-center justify-between px-4 shrink-0">
        <span className="text-sm font-medium text-wa-textPrimary">Dados do contato</span>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-wa-hover rounded-full text-wa-textSecondary"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto wa-scroll">
        {/* Avatar + nome */}
        <div className="flex flex-col items-center py-6 px-4 border-b border-wa-border">
          <Avatar
            src={contact.profile_pic_url}
            name={displayName}
            seed={contact.whatsapp_id}
            size={120}
          />
          {editingName ? (
            <div className="mt-3 w-full max-w-xs flex gap-1.5">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                className="h-8 text-sm text-center"
                autoFocus
              />
              <Button size="sm" onClick={saveName} className="h-8 px-2">
                <Check className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <h2 className="mt-3 text-lg font-semibold text-wa-textPrimary text-center flex items-center gap-2">
              {displayName}
              <button
                onClick={() => setEditingName(true)}
                className="text-wa-textSecondary hover:text-wa-textPrimary"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </h2>
          )}
          {contact.phone && (
            <p className="text-sm text-wa-textSecondary flex items-center gap-1.5 mt-1">
              <Phone className="h-3 w-3" />
              {formatPhone(contact.phone)}
            </p>
          )}
          {contact.status_message && (
            <p className="text-xs text-wa-textTertiary italic mt-2 text-center px-4">
              &ldquo;{contact.status_message}&rdquo;
            </p>
          )}
        </div>

        <div className="p-4 space-y-5">
          {lead ? (
            <>
              <LeadSummary lead={lead} stages={allStages} />
              <TagsEditor leadId={lead.id} currentTags={leadTags} allTags={allTags} />
              <NotesEditor leadId={lead.id} initial={lead.notes} />
            </>
          ) : (
            <p className="text-xs text-wa-textSecondary text-center py-3">
              Este contato ainda não tem lead. (Grupos não geram leads.)
            </p>
          )}
          <TasksSection
            leadId={lead?.id ?? null}
            contactId={contact.id}
            tasks={tasks}
          />
        </div>
      </div>
    </aside>
  );
}
