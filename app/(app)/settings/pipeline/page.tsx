import { TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StagesEditor } from "./_components/stages-editor";

export const dynamic = "force-dynamic";

export default async function PipelineSettingsPage() {
  const supabase = await createClient();
  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("*")
    .order("position", { ascending: true });

  return (
    <div className="h-full bg-wa-bg flex flex-col overflow-hidden">
      <header className="h-14 bg-wa-header flex items-center px-4 border-b border-wa-border shrink-0">
        <h1 className="font-medium text-wa-textPrimary flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Funil de Vendas
        </h1>
      </header>
      <div className="flex-1 overflow-y-auto wa-scroll">
        <div className="container max-w-3xl py-6">
          <p className="text-sm text-muted-foreground mb-6">
            Customize os estágios do Kanban. Marque um como <strong>Ganho</strong> ou{" "}
            <strong>Perdido</strong> pra fechar o lead automaticamente quando o card chegar lá.
            Use setas pra reordenar.
          </p>
          <StagesEditor initial={stages ?? []} />
        </div>
      </div>
    </div>
  );
}
