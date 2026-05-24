"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calendar, Loader2, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { scheduleMessageAction } from "../actions";

function toLocalInputValue(d: Date): string {
  // YYYY-MM-DDTHH:MM em local TZ
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const QUICK_OPTIONS = [
  { label: "Em 1h", minutes: 60 },
  { label: "Em 3h", minutes: 180 },
  { label: "Amanhã 9h", custom: () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  } },
  { label: "Amanhã 14h", custom: () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(14, 0, 0, 0);
    return d;
  } },
];

export function ScheduleDialog({
  conversationId,
  open,
  onClose,
  initialText = "",
}: {
  conversationId: string;
  open: boolean;
  onClose: () => void;
  initialText?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(initialText);
  const [when, setWhen] = useState<string>(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return toLocalInputValue(d);
  });

  function setQuick(opt: typeof QUICK_OPTIONS[number]) {
    const d = "custom" in opt && opt.custom
      ? opt.custom()
      : new Date(Date.now() + (opt.minutes ?? 0) * 60 * 1000);
    setWhen(toLocalInputValue(d));
  }

  function onSubmit() {
    if (!text.trim()) {
      toast.error("Mensagem vazia");
      return;
    }
    const dt = new Date(when);
    if (isNaN(dt.getTime())) {
      toast.error("Data inválida");
      return;
    }
    if (dt.getTime() < Date.now() - 60_000) {
      toast.error("Data tem que ser no futuro");
      return;
    }
    startTransition(async () => {
      const res = await scheduleMessageAction(conversationId, text, dt.toISOString());
      if (res.ok) {
        toast.success("Mensagem agendada", {
          description: `Será enviada em ${dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`,
        });
        setText("");
        onClose();
        router.refresh();
      } else {
        toast.error("Falha", { description: res.error });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" /> Agendar mensagem
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sched-text">Mensagem</Label>
            <Textarea
              id="sched-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="O que enviar quando der a hora?"
              disabled={pending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sched-when">Quando</Label>
            <Input
              id="sched-when"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              disabled={pending}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUICK_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setQuick(opt)}
                  disabled={pending}
                  className="text-[11px] px-2 py-0.5 rounded-full border border-wa-border text-wa-textSecondary hover:bg-wa-hover hover:text-wa-textPrimary"
                >
                  <Clock className="h-2.5 w-2.5 inline mr-1" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={pending || !text.trim()}>
            {pending ? <Loader2 className="animate-spin h-4 w-4" /> : <Calendar className="h-4 w-4" />}
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
