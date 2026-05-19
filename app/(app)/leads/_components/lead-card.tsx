"use client";

import { DragEvent, useState } from "react";
import { Phone, ExternalLink, DollarSign } from "lucide-react";
import { Avatar } from "@/app/(app)/chat/_components/avatar";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/format/date";
import { formatPhone } from "@/lib/format/avatar";
import { cn } from "@/lib/utils";
import type { LeadWithContact } from "../types";

function displayName(lead: LeadWithContact): string {
  return (
    lead.name?.trim() ||
    lead.contact?.name?.trim() ||
    lead.contact?.push_name?.trim() ||
    (lead.contact?.phone ? formatPhone(lead.contact.phone) : "") ||
    (lead.phone ? formatPhone(lead.phone) : "Sem nome")
  );
}

function formatCurrency(value: number | null): string | null {
  if (value == null) return null;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function LeadCard({
  lead,
  onClick,
}: {
  lead: LeadWithContact;
  onClick: () => void;
}) {
  const [dragging, setDragging] = useState(false);

  function handleDragStart(e: DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData("text/plain", lead.id);
    e.dataTransfer.effectAllowed = "move";
    setDragging(true);
  }
  function handleDragEnd() {
    setDragging(false);
  }

  const value = formatCurrency(
    lead.status === "won" ? lead.closed_value : lead.estimated_value
  );

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onClick}
      className={cn(
        "bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/40 transition-colors select-none",
        dragging && "opacity-40"
      )}
    >
      <div className="flex items-start gap-2.5">
        <Avatar
          src={lead.contact?.profile_pic_url}
          name={displayName(lead)}
          seed={lead.contact?.whatsapp_id ?? lead.id}
          size={36}
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm text-foreground truncate">{displayName(lead)}</p>
          {lead.contact?.phone && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Phone className="h-2.5 w-2.5" />
              {formatPhone(lead.contact.phone)}
            </p>
          )}
        </div>
      </div>

      {(value || lead.source || lead.last_contact_at) && (
        <div className="mt-2.5 space-y-1.5">
          {value && (
            <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
              <DollarSign className="h-3 w-3" />
              {value}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            {lead.source && (
              <Badge variant="secondary" className="text-[10px] py-0 h-4">
                {lead.source}
              </Badge>
            )}
            {lead.last_contact_at && (
              <span className="text-[10px] text-muted-foreground">
                {formatRelativeTime(lead.last_contact_at)}
              </span>
            )}
          </div>
        </div>
      )}

      {lead.conversation_id && (
        <a
          href={`/chat?c=${lead.conversation_id}`}
          onClick={(e) => e.stopPropagation()}
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" /> Abrir conversa
        </a>
      )}
    </div>
  );
}
