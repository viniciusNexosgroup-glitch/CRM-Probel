import { CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { JornadaNav } from "../_components/jornada-nav";
import { SeletorEtapa } from "./seletor-etapa";

export const dynamic = "force-dynamic";

type Disparo = {
  id: string;
  event_name: string;
  sent_at: string;
  ok: boolean;
  detail: string | null;
  dataset_id: string | null;
  stage: { name: string } | null;
  lead: {
    id: string;
    stage_id: string | null;
    assigned_to: string | null;
    name: string | null;
    phone: string | null;
    ad_name: string | null;
  } | null;
};

function quando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DisparosPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("lead_stage_events")
    .select(
      `id, event_name, sent_at, ok, detail, dataset_id,
       stage:pipeline_stages!lead_stage_events_stage_id_fkey(name),
       lead:leads!lead_stage_events_lead_id_fkey(id, stage_id, assigned_to, name, phone, ad_name)`
    )
    .order("sent_at", { ascending: false })
    .limit(200);

  const disparos = (data ?? []) as unknown as Disparo[];

  // Etapas disponíveis para mover o lead. O funil é por vendedor, então
  // buscamos todas as da loja e escolhemos o board do dono de cada lead.
  const { data: todasEtapas } = await supabase
    .from("pipeline_stages")
    .select("id, name, meta_event_name, user_id")
    .order("position", { ascending: true });

  const etapasPorBoard = new Map<string, Array<{ id: string; name: string; meta_event_name: string | null }>>();
  for (const e of todasEtapas ?? []) {
    const chave = e.user_id ?? "loja";
    const lista = etapasPorBoard.get(chave) ?? [];
    lista.push({ id: e.id, name: e.name, meta_event_name: e.meta_event_name });
    etapasPorBoard.set(chave, lista);
  }
  const enviados = disparos.filter((d) => d.ok).length;
  const falhas = disparos.length - enviados;

  return (
    <div className="h-full overflow-y-auto wa-scroll">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-wa-textPrimary">Jornada de compra</h1>
          <p className="text-sm text-wa-textSecondary max-w-2xl">
            Tudo que o CRM já enviou ao Meta Ads, com o resultado de cada envio e para qual
            pixel foi. Dá para avançar o lead por aqui — ao trocar a etapa, o evento dela
            dispara na hora.
          </p>
        </header>

        <JornadaNav atual="disparos" />

        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg border border-wa-border bg-wa-panel px-4 py-3 min-w-[140px]">
            <span className="block text-[11px] uppercase tracking-wider text-wa-textTertiary">
              Enviados
            </span>
            <span className="block text-2xl font-semibold text-emerald-400 tabular-nums">
              {enviados}
            </span>
          </div>
          <div className="rounded-lg border border-wa-border bg-wa-panel px-4 py-3 min-w-[140px]">
            <span className="block text-[11px] uppercase tracking-wider text-wa-textTertiary">
              Com falha
            </span>
            <span className="block text-2xl font-semibold text-red-400 tabular-nums">
              {falhas}
            </span>
          </div>
        </div>

        {disparos.length === 0 ? (
          <div className="rounded-lg border border-wa-border bg-wa-panel p-8 text-center space-y-2">
            <p className="text-wa-textPrimary font-medium">Nenhum disparo ainda</p>
            <p className="text-sm text-wa-textSecondary max-w-md mx-auto">
              Os eventos aparecem aqui quando um lead é movido para uma etapa que tenha evento
              configurado. Quem veio de anúncio é creditado à campanha; quem chegou por outro
              caminho entra pelo telefone e alimenta seu público.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-wa-border overflow-x-auto bg-wa-panel">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-wa-textTertiary border-b border-wa-border">
                  <th className="px-4 py-3 font-medium">Quando</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Etapa atual</th>
                  <th className="px-4 py-3 font-medium">Evento</th>
                  <th className="px-4 py-3 font-medium">Anúncio</th>
                  <th className="px-4 py-3 font-medium">Pixel</th>
                  <th className="px-4 py-3 font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {disparos.map((d) => (
                  <tr key={d.id} className="border-b border-wa-border/50 last:border-0">
                    <td className="px-4 py-3 text-wa-textSecondary whitespace-nowrap tabular-nums">
                      {quando(d.sent_at)}
                    </td>
                    <td className="px-4 py-3 text-wa-textPrimary">
                      {d.lead?.name ?? d.lead?.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {d.lead ? (
                        <SeletorEtapa
                          leadId={d.lead.id}
                          etapaAtualId={d.lead.stage_id}
                          etapas={etapasPorBoard.get(d.lead.assigned_to ?? "loja") ?? []}
                        />
                      ) : (
                        <span className="text-wa-textSecondary">{d.stage?.name ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex text-xs px-2 py-1 rounded-full bg-blue-500/15 text-blue-300">
                        {d.event_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-wa-textSecondary text-xs max-w-[220px] truncate">
                      {d.lead?.ad_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-wa-textSecondary text-xs tabular-nums">
                      {d.dataset_id ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {d.ok ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Enviado
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5 text-xs text-red-400"
                          title={d.detail ?? undefined}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Falhou
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
