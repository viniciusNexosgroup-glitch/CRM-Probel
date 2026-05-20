"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Clock, MessageCircle, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  WEEKDAYS,
  type BusinessHoursConfig,
  type AutoReplyConfig,
  isWithinBusinessHours,
} from "@/lib/business-hours";
import { TEMPLATE_VARIABLES } from "@/lib/format/template";
import { saveBusinessHoursAction } from "../actions";

export function BusinessHoursForm({
  initialHours,
  initialReply,
}: {
  initialHours: BusinessHoursConfig;
  initialReply: AutoReplyConfig;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hours, setHours] = useState<BusinessHoursConfig>(initialHours);
  const [reply, setReply] = useState<AutoReplyConfig>(initialReply);

  function toggleDay(d: number) {
    setHours((h) => ({
      ...h,
      days: h.days.includes(d) ? h.days.filter((x) => x !== d) : [...h.days, d].sort(),
    }));
  }

  function onSave() {
    startTransition(async () => {
      const res = await saveBusinessHoursAction(hours, reply);
      if (res.ok) {
        toast.success("Configurações salvas");
        router.refresh();
      } else {
        toast.error("Falha", { description: res.error });
      }
    });
  }

  function insertVar(token: string) {
    setReply((r) => ({ ...r, message: r.message + token }));
  }

  const insideNow = isWithinBusinessHours(hours);

  return (
    <div className="space-y-6">
      {/* Status atual */}
      {hours.enabled && (
        <div
          className={cn(
            "rounded-lg border p-3 text-sm flex items-center gap-2",
            insideNow
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-amber-500/30 bg-amber-500/10 text-amber-400"
          )}
        >
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            <strong>{insideNow ? "Dentro" : "Fora"}</strong> do horário comercial agora
            ({new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })})
          </span>
        </div>
      )}

      {/* Horário comercial */}
      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Horário comercial
          </h2>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={hours.enabled}
              onChange={(e) => setHours({ ...hours, enabled: e.target.checked })}
              className="accent-primary"
            />
            <span className={hours.enabled ? "text-primary" : "text-muted-foreground"}>
              {hours.enabled ? "Ativo" : "Desativado"}
            </span>
          </label>
        </header>

        <div
          className={cn(
            "space-y-3 p-3 rounded-md border border-border bg-card/40",
            !hours.enabled && "opacity-50 pointer-events-none"
          )}
        >
          <div className="space-y-1.5">
            <Label className="text-xs">Dias da semana</Label>
            <div className="flex gap-1.5 flex-wrap">
              {WEEKDAYS.map((d) => {
                const active = hours.days.includes(d.v);
                return (
                  <button
                    key={d.v}
                    type="button"
                    onClick={() => toggleDay(d.v)}
                    className={cn(
                      "w-12 h-9 rounded-md border text-xs font-medium transition-colors",
                      active
                        ? "bg-primary/15 border-primary text-primary"
                        : "border-wa-border text-wa-textSecondary hover:bg-wa-hover"
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bh-start" className="text-xs">Início</Label>
              <Input
                id="bh-start"
                type="time"
                value={hours.start}
                onChange={(e) => setHours({ ...hours, start: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bh-end" className="text-xs">Fim</Label>
              <Input
                id="bh-end"
                type="time"
                value={hours.end}
                onChange={(e) => setHours({ ...hours, end: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bh-tz" className="text-xs">Fuso horário</Label>
            <Input
              id="bh-tz"
              value={hours.timezone}
              onChange={(e) => setHours({ ...hours, timezone: e.target.value })}
              placeholder="America/Sao_Paulo"
            />
          </div>
        </div>
      </section>

      {/* Auto-resposta */}
      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            Auto-resposta fora do horário
          </h2>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={reply.enabled}
              onChange={(e) => setReply({ ...reply, enabled: e.target.checked })}
              className="accent-primary"
              disabled={!hours.enabled}
            />
            <span className={reply.enabled ? "text-primary" : "text-muted-foreground"}>
              {reply.enabled ? "Ativa" : "Desativada"}
            </span>
          </label>
        </header>

        {!hours.enabled && (
          <p className="text-[11px] text-amber-400 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Ative o horário comercial primeiro pra usar auto-resposta.
          </p>
        )}

        <div
          className={cn(
            "space-y-3 p-3 rounded-md border border-border bg-card/40",
            (!reply.enabled || !hours.enabled) && "opacity-50 pointer-events-none"
          )}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="ar-msg" className="text-xs">Mensagem automática</Label>
              <div className="flex gap-1">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.token}
                    type="button"
                    onClick={() => insertVar(v.token)}
                    title={v.description}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary hover:bg-primary/25"
                  >
                    {v.token}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              id="ar-msg"
              rows={4}
              value={reply.message}
              onChange={(e) => setReply({ ...reply, message: e.target.value })}
              placeholder="Olá {primeiro_nome}, recebemos sua mensagem…"
            />
            <p className="text-[10px] text-muted-foreground">
              Enviada uma vez por conversa a cada 12 horas (evita spam). Apenas pra primeiras mensagens fora do horário.
            </p>
          </div>
        </div>
      </section>

      <div className="flex justify-end pt-2">
        <Button onClick={onSave} disabled={pending}>
          {pending ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}
