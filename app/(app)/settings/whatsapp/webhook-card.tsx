"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Webhook, Check, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { configureWebhookAction } from "./actions";

export function WebhookCard({
  currentWebhookUrl,
  expectedAppUrl,
}: {
  currentWebhookUrl: string | null;
  expectedAppUrl: string;
}) {
  const [pending, startTransition] = useTransition();
  const [configuredUrl, setConfiguredUrl] = useState(currentWebhookUrl);

  const isConfigured = !!configuredUrl && configuredUrl.startsWith(expectedAppUrl);
  const isLocalhost = expectedAppUrl.startsWith("http://localhost") || expectedAppUrl.startsWith("http://127.");

  function onClick() {
    startTransition(async () => {
      const res = await configureWebhookAction();
      if (res.ok) {
        setConfiguredUrl(res.data?.url ?? null);
        toast.success("Webhook configurado", {
          description: "A Evolution agora vai mandar eventos pro CRM.",
        });
      } else {
        toast.error("Falha ao configurar webhook", { description: res.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="h-4 w-4" /> Webhook
          </CardTitle>
          {isConfigured ? (
            <Badge variant="success">Configurado</Badge>
          ) : (
            <Badge variant="warning">Não configurado</Badge>
          )}
        </div>
        <CardDescription>
          A Evolution precisa enviar eventos (mensagens recebidas, status, etc) pra este CRM.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {configuredUrl && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="flex items-center gap-1.5">
              <Check className="h-3 w-3 text-emerald-500" /> URL atual:
            </p>
            <code className="block text-[10px] bg-muted/30 px-2 py-1 rounded break-all">
              {configuredUrl}
            </code>
          </div>
        )}
        {isLocalhost && (
          <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 p-3 rounded">
            <CircleAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">URL local detectada</p>
              <p className="opacity-80 mt-1">
                A Evolution está num servidor remoto e não consegue chamar{" "}
                <code>localhost</code>. Faça deploy do CRM na Vercel primeiro e o
                <code className="mx-1">NEXT_PUBLIC_APP_URL</code> vai apontar pra produção.
              </p>
            </div>
          </div>
        )}
        <Button onClick={onClick} disabled={pending || isLocalhost} variant={isConfigured ? "outline" : "default"}>
          {pending ? <Loader2 className="animate-spin" /> : <Webhook />}
          {isConfigured ? "Reconfigurar webhook" : "Configurar webhook"}
        </Button>
      </CardContent>
    </Card>
  );
}
