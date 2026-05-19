"use client";

import { useState, useEffect } from "react";
import { ReconnectButton } from "./actions-buttons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Card que renderiza o QR Code base64 retornado pela Evolution.
 * Atualiza automaticamente a cada 30s (QR expira) enquanto exibido.
 */
export function QrCard({ initialQr }: { initialQr?: string | null }) {
  const [qr, setQr] = useState<string | null>(initialQr ?? null);

  useEffect(() => {
    if (!qr) return;
    const id = setInterval(() => {
      // Recarrega a página inteira pra revalidar o status do server
      // (mais simples que polling manual nessa primeira versão)
      window.location.reload();
    }, 30_000);
    return () => clearInterval(id);
  }, [qr]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conectar WhatsApp</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {qr ? (
          <>
            <div className="flex justify-center bg-white p-4 rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR Code WhatsApp" className="w-64 h-64" />
            </div>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Abra o WhatsApp no celular</li>
              <li>Vá em <strong>Configurações → Aparelhos conectados</strong></li>
              <li>Toque em <strong>Conectar um aparelho</strong></li>
              <li>Aponte a câmera para esta tela</li>
            </ol>
            <p className="text-xs text-muted-foreground">
              O QR expira em 30 segundos. A página recarrega automaticamente.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Clique no botão abaixo para gerar um novo QR Code.
            </p>
            <ReconnectButton onQr={setQr} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
