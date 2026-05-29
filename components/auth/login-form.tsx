"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/chat";
  const [loading, setLoading] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null); // 2FA pendente
  const [code, setCode] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      toast.error("Falha no login", { description: error.message });
      return;
    }

    // #37 Se a conta tem 2FA ativo, pede o código antes de entrar
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal1" && aal.nextLevel === "aal2") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      setLoading(false);
      if (totp) {
        setMfaFactorId(totp.id);
        return;
      }
    }

    setLoading(false);
    toast.success("Bem-vindo de volta!");
    router.push(redirectTo);
    router.refresh();
  }

  async function onVerifyMfa(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!mfaFactorId) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: mfaFactorId,
      code: code.trim(),
    });
    setLoading(false);
    if (error) {
      toast.error("Código inválido", { description: error.message });
      return;
    }
    toast.success("Bem-vindo de volta!");
    router.push(redirectTo);
    router.refresh();
  }

  if (mfaFactorId) {
    return (
      <form onSubmit={onVerifyMfa} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="mfa-code">Código de verificação (2FA)</Label>
          <Input
            id="mfa-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={6}
            autoFocus
            required
          />
          <p className="text-xs text-muted-foreground">
            Abra seu app autenticador e digite o código de 6 dígitos.
          </p>
        </div>
        <Button type="submit" className="w-full" disabled={loading || code.trim().length < 6}>
          {loading ? <Loader2 className="animate-spin" /> : "Verificar"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="voce@empresa.com"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : "Entrar"}
      </Button>
    </form>
  );
}
