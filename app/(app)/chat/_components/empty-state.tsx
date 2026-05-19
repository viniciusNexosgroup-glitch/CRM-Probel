import { MessageSquare } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center bg-wa-bg border-l border-wa-border">
      <div className="text-center max-w-md p-8 space-y-3">
        <MessageSquare className="h-16 w-16 text-wa-textTertiary mx-auto" />
        <h2 className="text-xl text-wa-textPrimary">CRM Probel — WhatsApp Web</h2>
        <p className="text-sm text-wa-textSecondary">
          Selecione uma conversa na lista ao lado para ver as mensagens.
          <br />
          Mensagens novas aparecem aqui em tempo real.
        </p>
      </div>
    </div>
  );
}
