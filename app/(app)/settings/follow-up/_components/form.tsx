"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, MessageCircle, Clock, Plus, Trash2, PauseCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WEEKDAYS } from "@/lib/business-hours";
import { montarMensagem, type FollowUpConfig } from "@/lib/follow-up/regras";
import { acaoSegura } from "@/lib/ui/acao-segura";
import { salvarFollowUpAction } from "../actions";

const ORDINAL = ["1ª", "2ª", "3ª"];

export function FollowUpForm({ inicial }: { inicial: FollowUpConfig }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cfg, setCfg] = useState<FollowUpConfig>(inicial);

  function mudarEtapa(i: number, mudanca: Partial<FollowUpConfig["etapas"][number]>) {
    setCfg((c) => ({
      ...c,
      etapas: c.etapas.map((e, j) => (j === i ? { ...e, ...mudanca } : e)),
    }));
  }

  function mudarTexto(i: number, k: number, texto: string) {
    mudarEtapa(i, { mensagens: cfg.etapas[i].mensagens.map((m, j) => (j === k ? texto : m)) });
  }

  function alternarDia(d: number) {
    setCfg((c) => ({
      ...c,
      dias: c.dias.includes(d) ? c.dias.filter((x) => x !== d) : [...c.dias, d].sort(),
    }));
  }

  function salvar() {
    startTransition(async () => {
      const res = await acaoSegura(() => salvarFollowUpAction(cfg));
      if (res.ok) {
        toast.success("Follow-up salvo");
        router.refresh();
      } else {
        toast.error("Falha", { description: res.error });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Trava geral */}
      <label
        className={cn(
          "rounded-lg border p-3 text-sm flex items-start gap-3 cursor-pointer",
          cfg.pausado
            ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
            : "border-border bg-card/40 text-wa-textSecondary"
        )}
      >
        <input
          type="checkbox"
          checked={cfg.pausado}
          onChange={(e) => setCfg({ ...cfg, pausado: e.target.checked })}
          className="accent-primary mt-0.5"
        />
        <span>
          <strong className="flex items-center gap-1">
            <PauseCircle className="h-4 w-4" /> Pausar todos os follow-ups da loja
          </strong>
          <span className="text-xs block mt-0.5">
            Nada sai enquanto estiver marcado; os que estão em andamento esperam e seguem quando
            desmarcar. Use se o WhatsApp avisar de bloqueio ou restrição.
          </span>
        </span>
      </label>

      {/* Mensagens */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          Mensagens
        </h2>
        <p className="text-xs text-muted-foreground">
          Cada mensagem tem várias versões, e o CRM sorteia uma a cada envio — textos idênticos em
          série são o que mais denuncia disparo automático. Escreva{" "}
          <code className="text-primary">{"{cliente}"}</code> onde vai o primeiro nome do cliente,
          que aparece em negrito. Se o contato não tiver nome, a frase sai sem ele.
        </p>

        {cfg.etapas.map((etapa, i) => (
          <div key={i} className="space-y-2 p-3 rounded-md border border-border bg-card/40">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-wa-textPrimary">{ORDINAL[i]} mensagem</span>
              <span className="text-muted-foreground">sai</span>
              <Input
                type="number"
                min={1}
                value={etapa.horas}
                onChange={(e) => mudarEtapa(i, { horas: Number(e.target.value) })}
                className="w-20 h-8 text-xs"
                aria-label={`Horas até a ${ORDINAL[i]} mensagem`}
              />
              <span className="text-muted-foreground">
                horas depois {i === 0 ? "de ativar" : "da anterior"}
              </span>
            </div>

            {etapa.mensagens.map((texto, k) => (
              <div key={k} className="space-y-1">
                <div className="flex items-start gap-2">
                  <Textarea
                    rows={2}
                    value={texto}
                    onChange={(e) => mudarTexto(i, k, e.target.value)}
                    className="text-sm min-h-[60px]"
                    aria-label={`${ORDINAL[i]} mensagem, versão ${k + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      mudarEtapa(i, { mensagens: etapa.mensagens.filter((_, j) => j !== k) })
                    }
                    disabled={etapa.mensagens.length === 1}
                    className="p-2 rounded text-wa-textSecondary hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:pointer-events-none"
                    aria-label="Remover esta versão"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground pl-1">
                  Exemplo: {montarMensagem(texto, "Maria").replace(/\*/g, "")}
                </p>
              </div>
            ))}
            <button
              type="button"
              onClick={() => mudarEtapa(i, { mensagens: [...etapa.mensagens, ""] })}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Adicionar versão
            </button>
          </div>
        ))}
      </section>

      {/* Ritmo */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Quando e quanto enviar
        </h2>
        <div className="space-y-3 p-3 rounded-md border border-border bg-card/40">
          <div className="space-y-1.5">
            <Label className="text-xs">Dias de envio</Label>
            <div className="flex gap-1.5 flex-wrap">
              {WEEKDAYS.map((d) => {
                const ativo = cfg.dias.includes(d.v);
                return (
                  <button
                    key={d.v}
                    type="button"
                    onClick={() => alternarDia(d.v)}
                    className={cn(
                      "w-12 h-9 rounded-md border text-xs font-medium transition-colors",
                      ativo
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
              <Label htmlFor="fu-inicio" className="text-xs">Das</Label>
              <Input
                id="fu-inicio"
                type="time"
                value={cfg.inicio}
                onChange={(e) => setCfg({ ...cfg, inicio: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fu-fim" className="text-xs">Até</Label>
              <Input
                id="fu-fim"
                type="time"
                value={cfg.fim}
                onChange={(e) => setCfg({ ...cfg, fim: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fu-teto" className="text-xs">Máximo de mensagens de follow-up por dia</Label>
            <Input
              id="fu-teto"
              type="number"
              min={1}
              value={cfg.limiteDiario}
              onChange={(e) => setCfg({ ...cfg, limiteDiario: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Intervalo entre uma mensagem e a próxima (minutos, sorteado)</Label>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              entre
              <Input
                type="number"
                min={1}
                value={cfg.intervaloMinMin}
                onChange={(e) => setCfg({ ...cfg, intervaloMinMin: Number(e.target.value) })}
                className="w-20"
                aria-label="Intervalo mínimo em minutos"
              />
              e
              <Input
                type="number"
                min={1}
                value={cfg.intervaloMaxMin}
                onChange={(e) => setCfg({ ...cfg, intervaloMaxMin: Number(e.target.value) })}
                className="w-20"
                aria-label="Intervalo máximo em minutos"
              />
              minutos
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Fora desses dias e horários nada sai: a mensagem espera o próximo horário. Mesmo com
            muitos follow-ups vencendo juntos, a loja manda uma por vez, sempre com o intervalo acima.
          </p>
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}
