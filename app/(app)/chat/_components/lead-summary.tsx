"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TrendingUp, DollarSign, Tag } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { updateLeadFieldsAction } from "../actions";
import type { LeadRow, PipelineStageRow } from "../types";

const SOURCES = [
  { value: "meta_ads", label: "Meta Ads" },
  { value: "google_ads", label: "Google Ads" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "site", label: "Site" },
  { value: "whatsapp", label: "WhatsApp direto" },
  { value: "indicacao", label: "Indicação" },
  { value: "outros", label: "Outros" },
];

export function LeadSummary({
  lead,
  stages,
}: {
  lead: LeadRow;
  stages: PipelineStageRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [value, setValue] = useState<string>(
    lead.estimated_value != null ? String(lead.estimated_value) : ""
  );

  function onStageChange(stageId: string) {
    startTransition(async () => {
      const res = await updateLeadFieldsAction(lead.id, { stage_id: stageId });
      if (!res.ok) toast.error("Falha", { description: res.error });
      else router.refresh();
    });
  }

  function onSourceChange(source: string) {
    startTransition(async () => {
      const res = await updateLeadFieldsAction(lead.id, { source: source || null });
      if (!res.ok) toast.error("Falha", { description: res.error });
    });
  }

  function onValueBlur() {
    const num = value === "" ? null : Number(value);
    if (num !== lead.estimated_value) {
      startTransition(async () => {
        const res = await updateLeadFieldsAction(lead.id, { estimated_value: num });
        if (!res.ok) toast.error("Falha", { description: res.error });
      });
    }
  }

  const currentStage = stages.find((s) => s.id === lead.stage_id);

  return (
    <div className="space-y-3 p-3 rounded-md bg-wa-bg/40 border border-wa-border">
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider text-wa-textTertiary flex items-center gap-1">
          <TrendingUp className="h-3 w-3" /> Estágio
        </Label>
        <Select
          value={lead.stage_id ?? ""}
          onChange={(e) => onStageChange(e.target.value)}
          className="h-9"
        >
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        {currentStage && (
          <div
            className="text-[10px] mt-1 flex items-center gap-1"
            style={{ color: currentStage.color }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: currentStage.color }}
            />
            {currentStage.name}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider text-wa-textTertiary flex items-center gap-1">
          <Tag className="h-3 w-3" /> Origem
        </Label>
        <Select
          value={lead.source ?? ""}
          onChange={(e) => onSourceChange(e.target.value)}
          className="h-9"
        >
          <option value="">—</option>
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider text-wa-textTertiary flex items-center gap-1">
          <DollarSign className="h-3 w-3" /> Valor estimado (R$)
        </Label>
        <Input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={onValueBlur}
          placeholder="0,00"
          className="h-9 text-sm"
        />
      </div>
    </div>
  );
}
