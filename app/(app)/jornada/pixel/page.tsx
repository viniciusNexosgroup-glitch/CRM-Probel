import { createClient } from "@/lib/supabase/server";
import { getCachedProfile, getCurrentInstanceId } from "@/lib/auth/current-user";
import { JornadaNav } from "../_components/jornada-nav";
import { PixelForm } from "./pixel-form";

export const dynamic = "force-dynamic";

type MetaCfg = {
  dataset_id?: string;
  access_token?: string;
  event_name?: string;
  test_event_code?: string;
};

export default async function PixelPage() {
  const supabase = await createClient();
  const perfil = await getCachedProfile();
  const instanceId = await getCurrentInstanceId();

  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "meta_capi")
    .maybeSingle();
  const cfg = (data?.value ?? {}) as MetaCfg;

  const { data: loja } = instanceId
    ? await supabase
        .from("whatsapp_instances")
        .select("label, instance_name")
        .eq("id", instanceId)
        .maybeSingle()
    : { data: null };

  return (
    <div className="h-full overflow-y-auto wa-scroll">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-wa-textPrimary">Jornada de compra</h1>
          <p className="text-sm text-wa-textSecondary max-w-2xl">
            Onde o CRM envia as conversões de{" "}
            <strong>{loja?.label ?? loja?.instance_name ?? "sua loja"}</strong>. Cada loja tem a
            sua própria configuração.
          </p>
        </header>

        <JornadaNav atual="pixel" />

        <PixelForm
          inicial={{
            dataset_id: cfg.dataset_id ?? "",
            access_token: cfg.access_token ?? "",
            event_name: cfg.event_name ?? "Lead",
            test_event_code: cfg.test_event_code ?? "",
          }}
          podeEditar={perfil?.role === "admin"}
          jaConfigurado={Boolean(cfg.dataset_id && cfg.access_token)}
        />
      </div>
    </div>
  );
}
