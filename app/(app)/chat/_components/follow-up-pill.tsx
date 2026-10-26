"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Loader2, Repeat } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { acaoSegura } from "@/lib/ui/acao-segura";
import { formatarDiaHora } from "@/lib/format/date";
import {
  descreverDias,
  descreverHoras,
  montarMensagem,
  normalizarFollowUp,
  primeiroNome,
  type FollowUpConfig,
} from "@/lib/follow-up/regras";
import { ativarFollowUpAction, cancelarFollowUpAction } from "../follow-up-actions";

type FollowUp = {
  id: string;
  status: "ativo" | "concluido" | "respondeu" | "cancelado" | "falhou";
  etapa: number;
  proximo_em: string | null;
  encerrado_em: string | null;
};

const DESFECHO: Record<Exclude<FollowUp["status"], "ativo">, string> = {
  respondeu: "parou porque o cliente respondeu",
  concluido: "terminou, com todas as mensagens enviadas",
  cancelado: "foi cancelado",
  falhou: "parou porque o WhatsApp recusou o envio",
};

/** Mostra *texto* em negrito, como o WhatsApp vai mostrar ao cliente. */
function ComNegrito({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\*[^*\n]+\*)/g).map((parte, i) =>
        /^\*[^*\n]+\*$/.test(parte) ? <strong key={i}>{parte.slice(1, -1)}</strong> : parte
      )}
    </>
  );
}

/**
 * Botão de follow-up da conversa: liga, mostra o andamento e cancela.
 *
 * O envio em si é da rotina do servidor (lib/follow-up/fila.ts); aqui só se
 * liga e desliga, e se explica ao vendedor o que vai acontecer.
 */
export function FollowUpPill({
  conversationId,
  nomeContato,
  pushName,
}: {
  conversationId: string;
  nomeContato?: string | null;
  pushName?: string | null;
}) {
  const [fu, setFu] = useState<FollowUp | null>(null);
  const [cfg, setCfg] = useState<FollowUpConfig | null>(null);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const [{ data: ultimo }, { data: conf }] = await Promise.all([
      supabase
        .from("follow_ups")
        .select("id, status, etapa, proximo_em, encerrado_em")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("settings").select("value").eq("key", "follow_up").maybeSingle(),
    ]);
    setFu((ultimo as FollowUp | null) ?? null);
    setCfg(normalizarFollowUp(conf?.value));
  }, [conversationId]);

  useEffect(() => {
    setFu(null);
    carregar();
  }, [carregar]);

  function abrir() {
    setAberto(true);
    carregar(); // o andamento pode ter mudado desde que a conversa abriu
  }

  async function alternar() {
    if (fu?.status === "ativo") {
      setSalvando(true);
      const res = await acaoSegura(() => cancelarFollowUpAction(conversationId));
      setSalvando(false);
      if (!res.ok) return toast.error("Não consegui cancelar", { description: res.error });
      toast.success("Follow-up cancelado");
    } else {
      setSalvando(true);
      const res = await acaoSegura(() => ativarFollowUpAction(conversationId));
      setSalvando(false);
      if (!res.ok) return toast.error("Não consegui ativar", { description: res.error });
      toast.success("Follow-up ativado", {
        description: "Se o cliente responder, ele para sozinho.",
      });
    }
    setAberto(false);
    carregar();
  }

  const ativo = fu?.status === "ativo";
  const total = cfg?.etapas.length ?? 3;
  const nome = primeiroNome(nomeContato, pushName);

  return (
    <>
      <button
        onClick={abrir}
        title={ativo ? "Follow-up em andamento" : "Ativar follow-up automático"}
        className={cn(
          "inline-flex items-center gap-1 text-xs md:text-[11px] px-3 py-1.5 md:px-2.5 md:py-1 rounded-full border transition-colors",
          ativo
            ? "bg-sky-500/20 text-sky-300 border-sky-500/40 font-medium"
            : "border-wa-border text-wa-textSecondary hover:bg-sky-500/10 hover:text-sky-300"
        )}
      >
        <Repeat className="h-3 w-3" />
        {ativo ? `Follow-up ${fu.etapa}/${total}` : "Follow-up"}
      </button>

      <Dialog open={aberto} onOpenChange={(o) => !salvando && setAberto(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-sky-400" /> Follow-up automático
            </DialogTitle>
          </DialogHeader>

          {!cfg ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-wa-textSecondary" />
            </div>
          ) : ativo ? (
            <div className="space-y-2 text-sm text-wa-textSecondary">
              <p>
                <strong className="text-wa-textPrimary">Em andamento:</strong> {fu.etapa} de {total}{" "}
                {fu.etapa === 1 ? "mensagem enviada" : "mensagens enviadas"}.
              </p>
              {fu.proximo_em && (
                <p>
                  Próxima prevista para <strong className="text-wa-textPrimary">{formatarDiaHora(fu.proximo_em)}</strong>.
                  Se cair fora do horário de envio, sai no próximo horário.
                </p>
              )}
              <p>Se o cliente responder, o follow-up para sozinho.</p>
            </div>
          ) : (
            <div className="space-y-3 text-sm text-wa-textSecondary">
              {fu && fu.status !== "ativo" && fu.encerrado_em && (
                <p className="text-xs">
                  O último follow-up {DESFECHO[fu.status]} em {formatarDiaHora(fu.encerrado_em)}.
                </p>
              )}
              <ul className="space-y-1.5 list-disc pl-4">
                <li>
                  Até {total} mensagens para reativar o cliente: a 1ª em{" "}
                  {descreverHoras(cfg.etapas[0].horas)}, a 2ª {descreverHoras(cfg.etapas[1].horas)}{" "}
                  depois da 1ª e a 3ª {descreverHoras(cfg.etapas[2].horas)} depois da 2ª.
                </li>
                <li>
                  Só sai de {descreverDias(cfg.dias)}, das {cfg.inicio} às {cfg.fim}, uma mensagem
                  por vez, com intervalo entre os envios da loja.
                </li>
                <li>Se o cliente responder, para sozinho. Você pode cancelar quando quiser.</li>
              </ul>
              <div>
                <p className="text-xs mb-1">Exemplo da 1ª mensagem:</p>
                <p className="rounded-lg bg-wa-bubbleOut text-wa-textPrimary px-3 py-2 whitespace-pre-wrap">
                  <ComNegrito texto={montarMensagem(cfg.etapas[0].mensagens[0], nome)} />
                </p>
              </div>
              {cfg.pausado && (
                <p className="text-xs text-amber-400 flex items-start gap-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" />
                  O follow-up está pausado nas configurações da loja.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAberto(false)} disabled={salvando}>
              Fechar
            </Button>
            {cfg && (
              <Button
                onClick={alternar}
                disabled={salvando || (!ativo && cfg.pausado)}
                variant={ativo ? "destructive" : "default"}
              >
                {salvando && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {ativo ? "Cancelar follow-up" : "Ativar follow-up"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
