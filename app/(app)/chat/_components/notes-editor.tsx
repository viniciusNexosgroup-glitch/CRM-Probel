"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { updateLeadNotesAction } from "../actions";

/**
 * Textarea com auto-save com debounce de 800ms.
 */
export function NotesEditor({
  leadId,
  initial,
}: {
  leadId: string;
  initial: string | null;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setValue(initial ?? "");
  }, [initial, leadId]);

  function onChange(v: string) {
    setValue(v);
    setState("saving");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      const res = await updateLeadNotesAction(leadId, v);
      if (res.ok) {
        setState("saved");
        if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
        savedTimeoutRef.current = setTimeout(() => setState("idle"), 1500);
      } else {
        setState("error");
        toast.error("Falha ao salvar observações", { description: res.error });
      }
    }, 800);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wider text-wa-textTertiary">
          Observações
        </Label>
        {state === "saving" && (
          <span className="text-[10px] text-wa-textSecondary flex items-center gap-1">
            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Salvando…
          </span>
        )}
        {state === "saved" && (
          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
            <Check className="h-2.5 w-2.5" /> Salvo
          </span>
        )}
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="Adicione observações sobre este lead…"
        className="bg-wa-bg/40 border-wa-border text-sm"
      />
    </div>
  );
}
