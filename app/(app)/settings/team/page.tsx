import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TeamList } from "./_components/team-list";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="h-full bg-wa-bg flex flex-col overflow-hidden">
      <header className="h-14 bg-wa-header flex items-center px-4 border-b border-wa-border shrink-0">
        <h1 className="font-medium text-wa-textPrimary flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Equipe
        </h1>
      </header>
      <div className="flex-1 overflow-y-auto wa-scroll">
        <div className="container max-w-4xl py-6">
          <p className="text-sm text-muted-foreground mb-6">
            Gerencie quem tem acesso ao CRM. Atendentes convidados recebem email pra definir senha.
          </p>
          <TeamList profiles={profiles ?? []} currentUserId={user.id} />
        </div>
      </div>
    </div>
  );
}
