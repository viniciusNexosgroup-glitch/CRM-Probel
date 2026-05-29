import { redirect } from "next/navigation";
import { Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { parseLeadSources } from "@/lib/lead-sources";
import { SourcesManager } from "./_components/sources-manager";

export const dynamic = "force-dynamic";

export default async function SourcesSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "lead_sources")
    .maybeSingle();

  const sources = parseLeadSources(data?.value);

  return (
    <div className="h-full bg-wa-bg flex flex-col overflow-hidden">
      <header className="h-14 bg-wa-header flex items-center px-4 border-b border-wa-border shrink-0">
        <h1 className="font-medium text-wa-textPrimary flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Origens de lead
        </h1>
      </header>
      <div className="flex-1 overflow-y-auto wa-scroll">
        <div className="container max-w-2xl py-6">
          <p className="text-sm text-muted-foreground mb-6">
            Personalize de onde vêm seus leads (ex: Feira, Vitrine, TikTok). Aparecem no funil e no
            dashboard. Leads já marcados com uma origem removida continuam com o valor antigo.
          </p>
          <SourcesManager initial={sources} />
        </div>
      </div>
    </div>
  );
}
