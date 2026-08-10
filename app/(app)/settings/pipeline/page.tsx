import { TrendingUp } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { StagesEditor } from "./_components/stages-editor";

export const dynamic = "force-dynamic";

export default async function PipelineSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const isAdmin = profile.role === "admin";

  // Boards disponíveis: admin gerencia o de qualquer vendedor + o "Sem vendedor";
  // vendedor gerencia só o próprio.
  let boards: { value: string; label: string; ownerId: string | null }[];
  if (isAdmin) {
    const { data: users } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name", { ascending: true });
    boards = [
      ...(users ?? []).map((u) => ({
        value: u.id,
        label: (u.full_name ?? u.email ?? "Usuário") + (u.id === profile.id ? " (você)" : ""),
        ownerId: u.id as string | null,
      })),
      { value: "none", label: "Sem vendedor", ownerId: null },
    ];
  } else {
    boards = [{ value: profile.id, label: "Meu funil", ownerId: profile.id }];
  }

  const sp = await searchParams;
  const selectedValue =
    boards.find((b) => b.value === sp.board)?.value ??
    boards.find((b) => b.ownerId === profile.id)?.value ??
    boards[0].value;
  const selectedOwnerId = boards.find((b) => b.value === selectedValue)!.ownerId;

  let stagesQuery = supabase
    .from("pipeline_stages")
    .select("*")
    .order("position", { ascending: true });
  stagesQuery =
    selectedOwnerId === null
      ? stagesQuery.is("user_id", null)
      : stagesQuery.eq("user_id", selectedOwnerId);
  const { data: stages } = await stagesQuery;

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
            {isAdmin
              ? " Como admin, você edita o funil de cada vendedor (e o board “Sem vendedor”) pelo seletor abaixo."
              : " Cada vendedor tem seu próprio funil."}
          </p>
          <StagesEditor
            initial={stages ?? []}
            isAdmin={isAdmin}
            boards={boards}
            selectedValue={selectedValue}
            targetOwnerId={selectedOwnerId}
          />
        </div>
      </div>
    </div>
  );
}
