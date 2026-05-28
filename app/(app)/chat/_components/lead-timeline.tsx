"use client";

import {
  Plus,
  ArrowRight,
  Trophy,
  XCircle,
  RotateCcw,
  DollarSign,
  UserCheck,
  Circle,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import type { LeadActivityRow } from "../types";

function iconFor(type: LeadActivityRow["type"]) {
  switch (type) {
    case "created":
      return <Plus className="h-3 w-3" />;
    case "stage_changed":
      return <ArrowRight className="h-3 w-3" />;
    case "won":
      return <Trophy className="h-3 w-3" />;
    case "lost":
      return <XCircle className="h-3 w-3" />;
    case "reopened":
      return <RotateCcw className="h-3 w-3" />;
    case "value_changed":
      return <DollarSign className="h-3 w-3" />;
    case "assigned":
      return <UserCheck className="h-3 w-3" />;
    default:
      return <Circle className="h-3 w-3" />;
  }
}

function colorFor(type: LeadActivityRow["type"]): string {
  switch (type) {
    case "won":
      return "text-emerald-400 bg-emerald-500/15";
    case "lost":
      return "text-red-400 bg-red-500/15";
    case "assigned":
      return "text-blue-400 bg-blue-500/15";
    default:
      return "text-wa-textSecondary bg-wa-active";
  }
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LeadTimeline({ activity }: { activity: LeadActivityRow[] }) {
  if (activity.length === 0) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-wa-textTertiary">
          Histórico
        </Label>
        <p className="text-xs text-wa-textTertiary py-1">
          Sem atividades ainda. Mudanças de estágio aparecem aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-wa-textTertiary">
        Histórico ({activity.length})
      </Label>
      <ul className="space-y-2 relative">
        {activity.map((a, i) => (
          <li key={a.id} className="flex gap-2.5 relative">
            {/* Linha conectora */}
            {i < activity.length - 1 && (
              <span className="absolute left-[11px] top-6 bottom-[-8px] w-px bg-wa-border" />
            )}
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${colorFor(a.type)}`}
            >
              {iconFor(a.type)}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-xs text-wa-textPrimary">{a.description}</p>
              <p className="text-[10px] text-wa-textTertiary mt-0.5">
                {formatWhen(a.created_at)}
                {a.user?.full_name && ` · ${a.user.full_name}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
