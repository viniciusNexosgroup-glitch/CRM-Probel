import { Loader2 } from "lucide-react";

/**
 * Mostrado no painel da conversa enquanto a page (mensagens/painel) carrega.
 * A lista de conversas fica no layout, então não recarrega — só esta área.
 */
export default function ChatLoading() {
  return (
    <div className="flex-1 flex items-center justify-center bg-wa-bg">
      <Loader2 className="h-6 w-6 animate-spin text-wa-textSecondary" />
    </div>
  );
}
