import { Library } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MediaList } from "./_components/list-client";

export const dynamic = "force-dynamic";

export default async function MediaLibraryPage() {
  const supabase = await createClient();
  const [mediaRes, catsRes] = await Promise.all([
    supabase.from("media_library").select("*").order("created_at", { ascending: false }),
    supabase.from("media_categories").select("*").order("position", { ascending: true }),
  ]);

  return (
    <div className="h-full bg-wa-bg flex flex-col overflow-hidden">
      <header className="h-14 bg-wa-header flex items-center px-4 border-b border-wa-border shrink-0">
        <h1 className="font-medium text-wa-textPrimary flex items-center gap-2">
          <Library className="h-4 w-4 text-primary" />
          Biblioteca de Mídias
        </h1>
        <span className="ml-3 text-xs text-wa-textSecondary">
          {mediaRes.data?.length ?? 0} cadastradas
        </span>
      </header>
      <div className="flex-1 overflow-y-auto wa-scroll">
        <div className="container max-w-5xl py-6">
          <p className="text-sm text-muted-foreground mb-4">
            Suba vídeos, imagens, áudios e documentos pra enviar com 1 clique do chat.
          </p>
          <MediaList initial={mediaRes.data ?? []} categories={catsRes.data ?? []} />
        </div>
      </div>
    </div>
  );
}
