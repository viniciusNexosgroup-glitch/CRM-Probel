import { redirect } from "next/navigation";
import { Tag as TagIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TagsManager } from "./_components/tags-manager";

export const dynamic = "force-dynamic";

export default async function TagsSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tags } = await supabase
    .from("tags")
    .select("id, name, color, lead_tags(count)")
    .order("name", { ascending: true });

  const items = (tags ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    color: t.color as string,
    count: ((t.lead_tags as unknown as { count: number }[])?.[0]?.count ?? 0) as number,
  }));

  return (
    <div className="h-full bg-wa-bg flex flex-col overflow-hidden">
      <header className="h-14 bg-wa-header flex items-center px-4 border-b border-wa-border shrink-0">
        <h1 className="font-medium text-wa-textPrimary flex items-center gap-2">
          <TagIcon className="h-4 w-4 text-primary" />
          Etiquetas
        </h1>
      </header>
      <div className="flex-1 overflow-y-auto wa-scroll">
        <div className="container max-w-2xl py-6">
          <p className="text-sm text-muted-foreground mb-6">
            Crie, renomeie, troque a cor ou exclua etiquetas. Excluir uma etiqueta a remove de todos os leads.
          </p>
          <TagsManager initial={items} />
        </div>
      </div>
    </div>
  );
}
