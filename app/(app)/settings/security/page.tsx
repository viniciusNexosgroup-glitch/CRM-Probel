"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Loader2, Smartphone, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type Factor = { id: string; status: string };

export default function SecuritySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [factor, setFactor] = useState<Factor | null>(null);
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    const totp = data?.totp ?? [];
    setFactor(totp.find((f) => f.status === "verified") ?? totp[0] ?? null);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function startEnroll() {
    setBusy(true);
    const supabase = createClient();
    // remove fatores não verificados pendentes pra evitar duplicar
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of list?.totp ?? []) {
      if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `CRM ${new Date().toISOString().slice(0, 10)}`,
    });
    setBusy(false);
    if (error || !data) {
      toast.error("Falha ao iniciar 2FA", { description: error?.message });
      return;
    }
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmEnroll() {
    if (!enrolling) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrolling.id,
      code: code.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error("Código inválido", { description: error.message });
      return;
    }
    toast.success("2FA ativado!");
    setEnrolling(null);
    setCode("");
    refresh();
  }

  async function disable() {
    if (!factor) return;
    if (!confirm("Desativar a verificação em duas etapas?")) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    setBusy(false);
    if (error) {
      toast.error("Falha ao desativar", { description: error.message });
      return;
    }
    toast.success("2FA desativado");
    setFactor(null);
  }

  const active = factor?.status === "verified";

  return (
    <div className="h-full bg-wa-bg flex flex-col overflow-hidden">
      <header className="h-14 bg-wa-header flex items-center px-4 border-b border-wa-border shrink-0">
        <h1 className="font-medium text-wa-textPrimary flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Segurança
        </h1>
      </header>
      <div className="flex-1 overflow-y-auto wa-scroll">
        <div className="container max-w-xl py-6">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <Smartphone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  Verificação em duas etapas (2FA)
                  {active && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                      Ativo
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Pede um código do app autenticador (Google Authenticator, Authy) ao entrar. Camada
                  extra de segurança além da senha.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="py-6 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-wa-textSecondary" />
              </div>
            ) : enrolling ? (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  1. Escaneie o QR no seu app autenticador (ou digite o código manual):
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={enrolling.qr}
                  alt="QR Code 2FA"
                  className="w-44 h-44 bg-white rounded-md p-2 mx-auto"
                />
                <p className="text-[11px] text-center text-wa-textSecondary break-all">
                  Código manual: <code className="text-wa-textPrimary">{enrolling.secret}</code>
                </p>
                <p className="text-xs text-muted-foreground">2. Digite o código de 6 dígitos:</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    placeholder="000000"
                    maxLength={6}
                    className="w-32"
                  />
                  <Button onClick={confirmEnroll} disabled={busy || code.trim().length < 6}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Confirmar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEnrolling(null);
                      setCode("");
                    }}
                  >
                    <X className="h-4 w-4" /> Cancelar
                  </Button>
                </div>
              </div>
            ) : active ? (
              <div className="mt-4">
                <Button variant="ghost" onClick={disable} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  Desativar 2FA
                </Button>
              </div>
            ) : (
              <div className="mt-4">
                <Button onClick={startEnroll} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Ativar 2FA
                </Button>
              </div>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground mt-3">
            Perdeu o autenticador? Um administrador pode remover o 2FA pelo painel do Supabase
            (Authentication → Users).
          </p>
        </div>
      </div>
    </div>
  );
}
