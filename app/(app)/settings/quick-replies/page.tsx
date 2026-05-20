import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { QuickReplyList } from "./_components/list-client";

export const dynamic = "force-dynamic";

export default async function QuickRepliesPage() {
  const supabase = await createClient();
  const { data: replies } = await supabase
    .from("quick_replies")
    .select("*")
    .order("shortcut", { ascending: true });

  return (
    <div className="h-full bg-wa-bg flex flex-col overflow-hidden">
      <header className="h-14 bg-wa-header flex items-center px-4 border-b border-wa-border shrink-0">
        <h1 className="font-medium text-wa-textPrimary flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          Respostas Rápidas
        </h1>
        <span className="ml-3 text-xs text-wa-textSecondary">
          {replies?.length ?? 0} cadastradas
        </span>
      </header>
      <div className="flex-1 overflow-y-auto wa-scroll">
        <div className="container max-w-3xl py-6">
          <p className="text-sm text-muted-foreground mb-4">
            Templates pra usar no chat digitando o atalho seguido de espaço.
            Variáveis tipo <code>{"{primeiro_nome}"}</code> são substituídas automaticamente.
          </p>
          <QuickReplyList initial={replies ?? []} />
        </div>
      </div>
    </div>
  );
}
