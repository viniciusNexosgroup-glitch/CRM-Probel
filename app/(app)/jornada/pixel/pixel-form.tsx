"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ExternalLink, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { salvarPixelAction } from "../actions";

export function PixelForm({
  inicial,
  podeEditar,
  jaConfigurado,
}: {
  inicial: { dataset_id: string; access_token: string; event_name: string; test_event_code: string };
  podeEditar: boolean;
  jaConfigurado: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [c, setC] = useState(inicial);

  function salvar() {
    startTransition(async () => {
      const res = await salvarPixelAction(c);
      if (res.ok) {
        toast.success("Configuração salva");
        router.refresh();
      } else {
        toast.error("Não deu para salvar", { description: res.error });
      }
    });
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {jaConfigurado && (
        <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-200">
            Conectado. As etapas da jornada com evento configurado já enviam conversões.
          </p>
        </div>
      )}

      <div className="rounded-lg border border-wa-border bg-wa-panel p-5 space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm text-wa-textPrimary">Conjunto de dados (pixel)</span>
          <Input
            value={c.dataset_id}
            onChange={(e) => setC({ ...c, dataset_id: e.target.value })}
            placeholder="Ex.: 916932600874619"
            disabled={!podeEditar}
          />
          <span className="block text-xs text-wa-textSecondary">
            No Gerenciador de Eventos do Meta, é a &quot;Identificação do conjunto de dados&quot;.
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm text-wa-textPrimary">Token de acesso</span>
          <Input
            type="password"
            value={c.access_token}
            onChange={(e) => setC({ ...c, access_token: e.target.value })}
            placeholder={inicial.access_token ? "•••••• (já salvo — cole um novo para trocar)" : "EAAG..."}
            disabled={!podeEditar}
          />
          <span className="block text-xs text-wa-textSecondary">
            Gerado no Meta em API de Conversões → Gerar token de acesso. Fica guardado só no
            servidor.
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm text-wa-textPrimary">Código de teste (opcional)</span>
          <Input
            value={c.test_event_code}
            onChange={(e) => setC({ ...c, test_event_code: e.target.value })}
            placeholder="TEST12345"
            disabled={!podeEditar}
          />
          <span className="block text-xs text-wa-textSecondary">
            Só para conferir os envios na aba &quot;Eventos de teste&quot; do Meta. Apague depois
            de validar, senão os eventos não contam para a campanha.
          </span>
        </label>

        {podeEditar ? (
          <div className="flex justify-end">
            <Button onClick={salvar} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Salvar
            </Button>
          </div>
        ) : (
          <p className="text-xs text-wa-textSecondary">
            Só o administrador da loja pode alterar esta configuração.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-wa-border bg-wa-panel/60 p-5 space-y-2.5">
        <h2 className="flex items-center gap-2 text-sm font-medium text-wa-textPrimary">
          <Info className="h-4 w-4 text-wa-textSecondary" />
          Sobre vincular a conta de anúncios
        </h2>
        <p className="text-sm text-wa-textSecondary">
          O envio das conversões funciona com o conjunto de dados e o token acima — não é
          preciso conectar a conta de anúncios para isso.
        </p>
        <p className="text-sm text-wa-textSecondary">
          Entrar com o Facebook para escolher a conta numa lista exige um aplicativo aprovado
          pela Meta, com revisão e verificação da empresa. Enquanto isso não existe, a
          configuração é feita colando os dados aqui, que dá no mesmo resultado.
        </p>
        <a
          href="https://business.facebook.com/events_manager2"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Abrir o Gerenciador de Eventos do Meta
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
