"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, LogOut, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  syncInstanceAction,
  disconnectAction,
  reconnectAction,
} from "./actions";

export function SyncButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      onClick={() =>
        startTransition(async () => {
          const res = await syncInstanceAction();
          if (res.ok) toast.success("Status atualizado");
          else toast.error("Falha ao sincronizar", { description: res.error });
        })
      }
      disabled={pending}
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      Atualizar status
    </Button>
  );
}

export function DisconnectButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="destructive"
      onClick={() => {
        if (
          !confirm(
            "Tem certeza? Isso vai desconectar o WhatsApp e você precisará escanear o QR Code novamente."
          )
        )
          return;
        startTransition(async () => {
          const res = await disconnectAction();
          if (res.ok) toast.success("WhatsApp desconectado");
          else toast.error("Falha ao desconectar", { description: res.error });
        });
      }}
      disabled={pending}
    >
      {pending ? <Loader2 className="animate-spin" /> : <LogOut />}
      Desconectar
    </Button>
  );
}

export function ReconnectButton({
  onQr,
}: {
  onQr?: (qrBase64: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      onClick={() =>
        startTransition(async () => {
          const res = await reconnectAction();
          if (res.ok) {
            if (res.data?.qrCode && onQr) {
              onQr(res.data.qrCode);
              toast.info("Escaneie o QR Code com seu WhatsApp");
            } else {
              toast.success("Reconexão iniciada");
            }
          } else {
            toast.error("Falha na reconexão", { description: res.error });
          }
        })
      }
      disabled={pending}
    >
      {pending ? <Loader2 className="animate-spin" /> : <QrCode />}
      Conectar / Gerar QR Code
    </Button>
  );
}
