import { redirect } from "next/navigation";
import { Repeat, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { formatarDiaHora } from "@/lib/format/date";
import { inicioDoDia, normalizarFollowUp, primeiroNome } from "@/lib/follow-up/regras";
import { FollowUpForm } from "./_components/form";

export const dynamic = "force-dynamic";

export default async function FollowUpPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  if (profile.role !== "admin") {
    return (
      <div className="h-full bg-wa-bg flex flex-col items-center justify-center text-center px-6">
        <ShieldAlert className="h-10 w-10 text-wa-textSecondary mb-3" />
        <p className="text-wa-textPrimary font-medium">Acesso restrito</p>
        <p className="text-sm text-wa-textSecondary mt-1">
          Só administradores mudam o follow-up. Para ligar numa conversa, use o botão
          &quot;Follow-up&quot; no topo dela.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: conf } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "follow_up")
    .maybeSingle();
  const cfg = normalizarFollowUp(conf?.value);

  const [{ data: ativos }, { count: enviadosHoje }, { data: equipe }] = await Promise.all([
    supabase
      .from("follow_ups")
      .select("id, conversation_id, etapa, proximo_em, iniciado_por")
      .eq("status", "ativo")
      .order("proximo_em", { ascending: true })
      .limit(200),
    supabase
      .from("follow_up_envios")
      .select("id", { count: "exact", head: true })
      .is("erro", null)
      .gte("enviado_em", inicioDoDia(cfg.timezone).toISOString()),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const conversaIds = (ativos ?? []).map((a) => a.conversation_id);
  const { data: conversas } = conversaIds.length
    ? await supabase.from("conversations").select("id, contact_id").in("id", conversaIds)
    : { data: [] };
  const contatoIds = (conversas ?? []).map((c) => c.contact_id);
  const { data: contatos } = contatoIds.length
    ? await supabase.from("contacts").select("id, name, push_name, phone").in("id", contatoIds)
    : { data: [] };

  const contatoDaConversa = new Map(
    (conversas ?? []).map((c) => [c.id, (contatos ?? []).find((k) => k.id === c.contact_id)])
  );
  const nomeDe = new Map((equipe ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="h-full bg-wa-bg flex flex-col overflow-hidden">
      <header className="h-14 bg-wa-header flex items-center px-4 border-b border-wa-border shrink-0">
        <h1 className="font-medium text-wa-textPrimary flex items-center gap-2">
          <Repeat className="h-4 w-4 text-primary" />
          Follow-up automático
        </h1>
      </header>
      <div className="flex-1 overflow-y-auto wa-scroll">
        <div className="container max-w-2xl py-6 space-y-6">
          <p className="text-sm text-muted-foreground">
            O vendedor liga o follow-up numa conversa parada (botão &quot;Follow-up&quot; no topo
            dela) e o CRM manda até 3 mensagens para reativar o cliente. Cada uma conta a partir da
            anterior. Se o cliente responder, para na hora.
          </p>

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-foreground">Em andamento</h2>
            <p className="text-xs text-muted-foreground">
              {ativos?.length ?? 0} {ativos?.length === 1 ? "follow-up ativo" : "follow-ups ativos"} ·{" "}
              {enviadosHoje ?? 0} de {cfg.limiteDiario} mensagens enviadas hoje
            </p>
            {ativos && ativos.length > 0 && (
              <div className="rounded-md border border-border divide-y divide-border text-xs">
                {ativos.map((a) => {
                  const k = contatoDaConversa.get(a.conversation_id);
                  return (
                    <div key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="truncate text-wa-textPrimary">
                        {primeiroNome(k?.name, k?.push_name) ?? k?.phone ?? "Cliente"}
                      </span>
                      <span className="shrink-0 text-wa-textSecondary">
                        {a.etapa}/{cfg.etapas.length} · próxima{" "}
                        {a.proximo_em ? formatarDiaHora(a.proximo_em) : "—"}
                        {a.iniciado_por && nomeDe.get(a.iniciado_por)
                          ? ` · ${nomeDe.get(a.iniciado_por)?.split(" ")[0]}`
                          : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <FollowUpForm inicial={cfg} />
        </div>
      </div>
    </div>
  );
}
