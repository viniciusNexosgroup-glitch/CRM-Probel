"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2, X, Trash2, Pencil, MessageCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  salvarEtapaJornadaAction,
  criarEtapaJornadaAction,
  excluirEtapaJornadaAction,
} from "../actions";
import { EVENTOS_META, type CamposDaEtapa } from "../eventos";
import type { Database } from "@/types/database";

type Etapa = Database["public"]["Tables"]["pipeline_stages"]["Row"];
type Board = { value: string; label: string; ownerId: string | null };

const VAZIA: CamposDaEtapa = {
  name: "",
  meta_event_name: null,
  is_sale: false,
  default_value: null,
  is_first_contact: false,
  keyword: null,
};

export function JornadaEditor({
  etapas,
  isAdmin = false,
  boards = [],
  selectedValue,
  targetOwnerId = null,
}: {
  etapas: Etapa[];
  isAdmin?: boolean;
  boards?: Board[];
  selectedValue?: string;
  targetOwnerId?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState<Etapa | null>(null);
  const [criando, setCriando] = useState(false);

  function fechar() {
    setEditando(null);
    setCriando(false);
  }

  function salvar(campos: CamposDaEtapa) {
    startTransition(async () => {
      const res = editando
        ? await salvarEtapaJornadaAction(editando.id, campos)
        : await criarEtapaJornadaAction(campos, targetOwnerId);
      if (res.ok) {
        toast.success(editando ? "Etapa atualizada" : "Etapa criada");
        fechar();
        router.refresh();
      } else {
        toast.error("Não deu para salvar", { description: res.error });
      }
    });
  }

  function excluir(etapa: Etapa) {
    if (!confirm(`Excluir a etapa "${etapa.name}"?`)) return;
    startTransition(async () => {
      const res = await excluirEtapaJornadaAction(etapa.id);
      if (res.ok) {
        toast.success("Etapa excluída");
        router.refresh();
      } else {
        toast.error("Não deu para excluir", { description: res.error });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setCriando(true)} disabled={pending}>
          <Plus className="h-4 w-4 mr-1.5" />
          Adicionar etapa
        </Button>
        {isAdmin && boards.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-wa-textSecondary">Jornada de:</span>
            <select
              value={selectedValue}
              onChange={(e) => router.push(`/jornada?board=${e.target.value}`)}
              className="h-9 text-sm rounded-md bg-wa-panel border border-wa-border px-2 text-wa-textPrimary focus:outline-none focus:border-primary/40"
            >
              {boards.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-wa-border overflow-x-auto bg-wa-panel">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-wa-textTertiary border-b border-wa-border">
              <th className="px-4 py-3 font-medium">Ordem</th>
              <th className="px-4 py-3 font-medium">Etapa</th>
              <th className="px-4 py-3 font-medium">Evento no Meta Ads</th>
              <th className="px-4 py-3 font-medium">Palavra-chave</th>
              <th className="px-4 py-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {etapas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-wa-textSecondary">
                  Nenhuma etapa ainda. Crie a primeira para montar a jornada.
                </td>
              </tr>
            )}
            {etapas.map((e) => (
              <tr key={e.id} className="border-b border-wa-border/50 last:border-0">
                <td className="px-4 py-3 text-wa-textSecondary tabular-nums">{e.position}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: e.color }}
                    />
                    <span className="text-wa-textPrimary font-medium">{e.name}</span>
                    {e.is_first_contact && (
                      <span title="Primeiro contato">
                        <MessageCircle className="h-3.5 w-3.5 text-violet-400" />
                      </span>
                    )}
                    {e.is_sale && (
                      <span title="Representa uma venda">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {e.meta_event_name ? (
                    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-blue-500/15 text-blue-300">
                      {e.meta_event_name}
                    </span>
                  ) : (
                    <span className="text-xs text-wa-textTertiary">— não dispara</span>
                  )}
                </td>
                <td className="px-4 py-3 text-wa-textSecondary text-xs">
                  {e.keyword ? `"${e.keyword}"` : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setEditando(e)}
                      className="p-2 rounded hover:bg-wa-hover text-wa-textSecondary"
                      aria-label={`Editar ${e.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => excluir(e)}
                      className="p-2 rounded hover:bg-wa-hover text-wa-textSecondary hover:text-red-400"
                      aria-label={`Excluir ${e.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(editando || criando) && (
        <FormularioEtapa
          inicial={
            editando
              ? {
                  name: editando.name,
                  meta_event_name: editando.meta_event_name,
                  is_sale: editando.is_sale,
                  default_value: editando.default_value,
                  is_first_contact: editando.is_first_contact,
                  keyword: editando.keyword,
                }
              : VAZIA
          }
          titulo={editando ? "Editar etapa" : "Nova etapa"}
          pending={pending}
          onCancelar={fechar}
          onSalvar={salvar}
        />
      )}
    </div>
  );
}

function FormularioEtapa({
  inicial,
  titulo,
  pending,
  onCancelar,
  onSalvar,
}: {
  inicial: CamposDaEtapa;
  titulo: string;
  pending: boolean;
  onCancelar: () => void;
  onSalvar: (c: CamposDaEtapa) => void;
}) {
  const [c, setC] = useState<CamposDaEtapa>(inicial);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <button className="absolute inset-0 bg-black/60" onClick={onCancelar} aria-label="Fechar" />
      <div className="relative w-full md:max-w-lg max-h-[92dvh] overflow-y-auto wa-scroll bg-wa-panel border border-wa-border rounded-t-2xl md:rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-wa-textPrimary">{titulo}</h2>
          <button
            onClick={onCancelar}
            className="p-2 -mr-2 rounded hover:bg-wa-hover text-wa-textSecondary"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm text-wa-textPrimary">Nome da etapa</span>
          <Input
            value={c.name}
            onChange={(e) => setC({ ...c, name: e.target.value })}
            placeholder="Ex.: Fez orçamento"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm text-wa-textPrimary">Evento disparado no Meta Ads</span>
          <select
            value={c.meta_event_name ?? ""}
            onChange={(e) => setC({ ...c, meta_event_name: e.target.value || null })}
            className="w-full h-10 rounded-md bg-wa-bg border border-wa-border px-3 text-base md:text-sm text-wa-textPrimary focus:outline-none focus:border-primary/40"
          >
            <option value="">Não disparar nada</option>
            {EVENTOS_META.map((ev) => (
              <option key={ev} value={ev}>
                {ev}
              </option>
            ))}
          </select>
          <span className="block text-xs text-wa-textSecondary">
            Ao mover um lead para esta etapa, este evento é enviado ao Meta — mas só para leads
            que vieram de anúncio.
          </span>
        </label>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={c.is_first_contact}
            onChange={(e) => setC({ ...c, is_first_contact: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span className="text-sm">
            <span className="text-wa-textPrimary">Representa o primeiro contato</span>
            <span className="block text-xs text-wa-textSecondary">
              Marca o início da jornada do cliente.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={c.is_sale}
            onChange={(e) => setC({ ...c, is_sale: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span className="text-sm">
            <span className="text-wa-textPrimary">Representa uma venda</span>
            <span className="block text-xs text-wa-textSecondary">
              O valor vai junto no evento, para o Meta otimizar por faturamento.
            </span>
          </span>
        </label>

        {c.is_sale && (
          <label className="block space-y-1.5">
            <span className="text-sm text-wa-textPrimary">Valor padrão da venda (R$)</span>
            <Input
              type="number"
              inputMode="decimal"
              value={c.default_value ?? ""}
              onChange={(e) =>
                setC({
                  ...c,
                  default_value: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              placeholder="Ex.: 1500"
            />
            <span className="block text-xs text-wa-textSecondary">
              Usado quando o lead não tem valor preenchido.
            </span>
          </label>
        )}

        <label className="block space-y-1.5">
          <span className="text-sm text-wa-textPrimary">Palavra-chave (opcional)</span>
          <Input
            value={c.keyword ?? ""}
            onChange={(e) => setC({ ...c, keyword: e.target.value || null })}
            placeholder="Ex.: Segue orçamento"
          />
          <span className="block text-xs text-wa-textSecondary">
            Quando o atendente enviar essa expressão na conversa, o lead vem para esta etapa
            sozinho e o evento dispara junto.
          </span>
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onCancelar} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={() => onSalvar(c)} disabled={pending || !c.name.trim()}>
            {pending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
