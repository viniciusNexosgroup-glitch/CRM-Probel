import { MessageSquare, Settings } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user!.id)
    .single();

  return (
    <div className="flex h-screen items-center justify-center text-wa-textPrimary">
      <div className="text-center space-y-6 max-w-md p-8">
        <MessageSquare className="h-16 w-16 text-primary mx-auto" />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            Bem-vindo, {profile?.full_name ?? user?.email}!
          </h1>
          <p className="text-wa-textSecondary">
            A fundação do CRM está pronta. Os próximos passos da implementação
            (etapa 6 em diante) vão habilitar a conexão WhatsApp via QR Code,
            recebimento/envio de mensagens, inbox estilo WhatsApp Web e Kanban.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button asChild>
            <Link href="/settings/whatsapp">
              <Settings className="h-4 w-4" /> Configurar WhatsApp (em breve)
            </Link>
          </Button>
          <LogoutButton />
        </div>
        <p className="text-xs text-wa-textTertiary">
          Logado como {user?.email} • {profile?.role}
        </p>
      </div>
    </div>
  );
}
