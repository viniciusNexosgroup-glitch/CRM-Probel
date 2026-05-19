import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, MessageSquare, Phone, Users, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { evolution, mapEvolutionStateToDb, EvolutionError } from "@/lib/evolution/client";
import { createClient } from "@/lib/supabase/server";
import {
  SyncButton,
  DisconnectButton,
} from "./actions-buttons";
import { QrCard } from "./qr-card";
import { WebhookCard } from "./webhook-card";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, { label: string; variant: "success" | "warning" | "danger" | "secondary" }> = {
  connected: { label: "Conectado", variant: "success" },
  connecting: { label: "Conectando…", variant: "warning" },
  qr: { label: "Aguardando QR Code", variant: "warning" },
  disconnected: { label: "Desconectado", variant: "danger" },
  close: { label: "Desconectado", variant: "danger" },
};

async function fetchAndPersistInstance() {
  try {
    const instance = await evolution.fetchInstance();
    if (!instance) return { instance: null, error: "Instância não encontrada na Evolution." };

    const supabase = await createClient();
    const status = mapEvolutionStateToDb(instance.connectionStatus);
    await supabase
      .from("whatsapp_instances")
      .upsert(
        {
          instance_name: instance.name,
          evolution_api_url: process.env.EVOLUTION_API_URL!,
          status,
          phone_number: instance.ownerJid?.split("@")[0] ?? null,
          profile_name: instance.profileName,
          profile_pic_url: instance.profilePicUrl,
          last_connected_at: status === "connected" ? new Date().toISOString() : undefined,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "instance_name" }
      );

    return { instance, status, error: null };
  } catch (e) {
    if (e instanceof EvolutionError) return { instance: null, error: e.message };
    return { instance: null, error: (e as Error).message };
  }
}

async function fetchCurrentWebhook(): Promise<string | null> {
  try {
    const wh = await evolution.findWebhook();
    return (wh as { url?: string } | null)?.url ?? null;
  } catch {
    return null;
  }
}

export default async function WhatsAppSettingsPage() {
  const { instance, status, error } = await fetchAndPersistInstance();
  const currentWebhookUrl = await fetchCurrentWebhook();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <div className="min-h-screen container max-w-3xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <SyncButton />
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Conexão WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Status e dados da instância <code>{process.env.EVOLUTION_INSTANCE_NAME}</code> na Evolution API.
        </p>
      </div>

      {error && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-red-400">⚠️ {error}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Verifique <code>EVOLUTION_API_URL</code>, <code>EVOLUTION_API_KEY</code> e{" "}
              <code>EVOLUTION_INSTANCE_NAME</code> no <code>.env.local</code>.
            </p>
          </CardContent>
        </Card>
      )}

      {instance && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  {instance.profilePicUrl ? (
                    <Image
                      src={instance.profilePicUrl}
                      alt={instance.profileName ?? "Perfil"}
                      width={48}
                      height={48}
                      className="rounded-full"
                      unoptimized
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <span>{instance.profileName ?? "Sem nome"}</span>
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" />
                  +{instance.ownerJid?.split("@")[0] ?? "—"}
                </CardDescription>
              </div>
              <Badge variant={statusLabel[status ?? "disconnected"].variant}>
                {statusLabel[status ?? "disconnected"].label}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <StatBox icon={<MessageSquare className="h-4 w-4" />} label="Mensagens" value={instance._count?.Message ?? 0} />
                <StatBox icon={<Users className="h-4 w-4" />} label="Contatos" value={instance._count?.Contact ?? 0} />
                <StatBox icon={<MessageSquare className="h-4 w-4" />} label="Chats" value={instance._count?.Chat ?? 0} />
              </div>

              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
                <p className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> Criada em{" "}
                  {new Date(instance.createdAt).toLocaleString("pt-BR")}
                </p>
                <p className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> Atualizada em{" "}
                  {new Date(instance.updatedAt).toLocaleString("pt-BR")}
                </p>
                <p>
                  Integration: <code>{instance.integration}</code>
                </p>
                <p>
                  Instance ID: <code className="text-[10px]">{instance.id}</code>
                </p>
              </div>

              {status === "connected" && (
                <div className="pt-2">
                  <DisconnectButton />
                </div>
              )}
            </CardContent>
          </Card>

          {(status === "disconnected" || status === "connecting") && (
            <QrCard />
          )}

          <WebhookCard currentWebhookUrl={currentWebhookUrl} expectedAppUrl={appUrl} />
        </>
      )}
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <div className="text-2xl font-semibold">{value.toLocaleString("pt-BR")}</div>
    </div>
  );
}
