"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { updateLeadAction, type LeadFormPayload } from "../actions";
import { LEAD_SOURCES, type LeadWithContact } from "../types";
import { formatPhone } from "@/lib/format/avatar";

export function LeadDetailModal({
  lead,
  open,
  onClose,
}: {
  lead: LeadWithContact | null;
  open: boolean;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<LeadFormPayload>({});

  useEffect(() => {
    if (!lead) return;
    setForm({
      name: lead.name,
      source: lead.source,
      campaign_name: lead.campaign_name,
      ad_name: lead.ad_name,
      interest: lead.interest,
      estimated_value: lead.estimated_value,
      closed_value: lead.closed_value,
      lost_reason: lead.lost_reason,
      next_action: lead.next_action,
      next_action_at: lead.next_action_at,
      notes: lead.notes,
    });
  }, [lead]);

  if (!lead) return null;

  const isWon = lead.status === "won";
  const isLost = lead.status === "lost";

  function onSave() {
    if (!lead) return;
    startTransition(async () => {
      const res = await updateLeadAction(lead.id, form);
      if (res.ok) {
        toast.success("Lead atualizado");
        onClose();
      } else {
        toast.error("Falha ao salvar", { description: res.error });
      }
    });
  }

  function set<K extends keyof LeadFormPayload>(key: K, value: LeadFormPayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead.name ?? lead.contact?.name ?? "Lead"}</DialogTitle>
          <DialogDescription>
            {lead.contact?.phone ? formatPhone(lead.contact.phone) : "—"}
            {lead.conversation_id && (
              <Link
                href={`/chat?c=${lead.conversation_id}`}
                className="ml-3 inline-flex items-center gap-1 text-primary text-xs hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> abrir conversa
              </Link>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="ld-name">Nome do lead</Label>
            <Input
              id="ld-name"
              value={form.name ?? ""}
              onChange={(e) => set("name", e.target.value || null)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ld-source">Origem</Label>
            <Select
              id="ld-source"
              value={form.source ?? ""}
              onChange={(e) => set("source", e.target.value || null)}
            >
              <option value="">—</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ld-interest">Interesse</Label>
            <Input
              id="ld-interest"
              placeholder="Ex: Colchão de casal"
              value={form.interest ?? ""}
              onChange={(e) => set("interest", e.target.value || null)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ld-campaign">Campanha</Label>
            <Input
              id="ld-campaign"
              value={form.campaign_name ?? ""}
              onChange={(e) => set("campaign_name", e.target.value || null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ld-ad">Anúncio</Label>
            <Input
              id="ld-ad"
              value={form.ad_name ?? ""}
              onChange={(e) => set("ad_name", e.target.value || null)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ld-estimated">Valor estimado (R$)</Label>
            <Input
              id="ld-estimated"
              type="number"
              step="0.01"
              value={form.estimated_value ?? ""}
              onChange={(e) =>
                set("estimated_value", e.target.value === "" ? null : Number(e.target.value))
              }
            />
          </div>
          {isWon && (
            <div className="space-y-1.5">
              <Label htmlFor="ld-closed">Valor fechado (R$)</Label>
              <Input
                id="ld-closed"
                type="number"
                step="0.01"
                value={form.closed_value ?? ""}
                onChange={(e) =>
                  set("closed_value", e.target.value === "" ? null : Number(e.target.value))
                }
              />
            </div>
          )}
          {isLost && (
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="ld-lost">Motivo de perda</Label>
              <Input
                id="ld-lost"
                value={form.lost_reason ?? ""}
                onChange={(e) => set("lost_reason", e.target.value || null)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ld-next">Próxima ação</Label>
            <Input
              id="ld-next"
              placeholder="Ex: Enviar proposta"
              value={form.next_action ?? ""}
              onChange={(e) => set("next_action", e.target.value || null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ld-next-at">Quando</Label>
            <Input
              id="ld-next-at"
              type="datetime-local"
              value={form.next_action_at ? form.next_action_at.slice(0, 16) : ""}
              onChange={(e) =>
                set(
                  "next_action_at",
                  e.target.value ? new Date(e.target.value).toISOString() : null
                )
              }
            />
          </div>

          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="ld-notes">Observações</Label>
            <Textarea
              id="ld-notes"
              rows={4}
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value || null)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={pending}>
            {pending && <Loader2 className="animate-spin h-4 w-4" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
