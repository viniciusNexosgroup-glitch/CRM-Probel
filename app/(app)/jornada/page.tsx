import { createClient } from "@/lib/supabase/server";
import { getCachedProfile } from "@/lib/auth/current-user";
import { JornadaEditor } from "./_components/jornada-editor";
import { JornadaNav } from "./_components/jornada-nav";

export const dynamic = "force-dynamic";

const SEM_VENDEDOR = "none";

export default async function JornadaPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const supabase = await createClient();
  const perfil = await getCachedProfile();
  const { board } = await searchParams;

  const isAdmin = perfil?.role === "admin";

  // Admin monta a jornada da loja ou a de cada vendedor; vendedor vê só a dele.
  const boards: Array<{ value: string; label: string; ownerId: string | null }> = [];
  if (isAdmin) {
    boards.push({ value: SEM_VENDEDOR, label: "Jornada da loja", ownerId: null });
    const { data: pessoas } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name", { ascending: true });
    for (const p of pessoas ?? []) {
      boards.push({
        value: p.id,
        label: p.full_name ?? p.email ?? "Vendedor",
        ownerId: p.id,
      });
    }
  }

  const selectedValue = isAdmin ? (board ?? SEM_VENDEDOR) : (perfil?.id ?? SEM_VENDEDOR);
  const ownerId = selectedValue === SEM_VENDEDOR ? null : selectedValue;

  let q = supabase.from("pipeline_stages").select("*").order("position", { ascending: true });
  q = ownerId === null ? q.is("user_id", null) : q.eq("user_id", ownerId);
  const { data: etapas } = await q;

  return (
    <div className="h-full overflow-y-auto wa-scroll">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-wa-textPrimary">Jornada de compra</h1>
          <p className="text-sm text-wa-textSecondary max-w-2xl">
            Monte as etapas por onde o cliente passa e escolha qual evento cada uma envia ao
            Meta Ads. Assim a campanha aprende com quem realmente avança — e não só com quem
            manda a primeira mensagem.
          </p>
        </header>

        <JornadaNav atual="etapas" />

        <JornadaEditor
          etapas={etapas ?? []}
          isAdmin={isAdmin}
          boards={boards}
          selectedValue={selectedValue}
          targetOwnerId={ownerId}
        />
      </div>
    </div>
  );
}
