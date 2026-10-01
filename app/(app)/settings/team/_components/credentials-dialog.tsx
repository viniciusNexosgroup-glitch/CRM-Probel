"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Loader2, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setUserPasswordAction, updateUserEmailAction } from "../actions";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Troca o email de login e/ou define a senha de um atendente.
 *
 * Os dois campos são independentes: quem só quer repor a senha deixa o email
 * como está, e vice-versa. Mandamos apenas o que o admin mexeu, pra não
 * reescrever um valor sem necessidade.
 */
export function CredentialsDialog({
  profile,
  onClose,
}: {
  profile: Profile | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  // Reabrir o diálogo em outra pessoa não pode herdar o que foi digitado antes.
  useEffect(() => {
    setEmail(profile?.email ?? "");
    setSenha("");
    setMostrarSenha(false);
  }, [profile]);

  const emailOriginal = (profile?.email ?? "").trim().toLowerCase();
  const emailMudou = email.trim().toLowerCase() !== emailOriginal;
  const querTrocarSenha = senha.length > 0;
  const senhaCurta = querTrocarSenha && senha.length < 8;
  const nada = !emailMudou && !querTrocarSenha;

  function onSubmit() {
    if (!profile) return;

    startTransition(async () => {
      const feito: string[] = [];

      if (emailMudou) {
        const res = await updateUserEmailAction(profile.id, email);
        if (!res.ok) {
          toast.error("Falha ao trocar o email", { description: res.error });
          return;
        }
        feito.push("email");
      }

      if (querTrocarSenha) {
        const res = await setUserPasswordAction(profile.id, senha);
        if (!res.ok) {
          // Se o email já foi trocado, dizer isso evita o admin repetir a troca.
          toast.error("Falha ao definir a senha", {
            description: feito.length
              ? `${res.error} (o email novo já foi salvo)`
              : res.error,
          });
          return;
        }
        feito.push("senha");
      }

      toast.success(`Acesso atualizado (${feito.join(" e ")})`, {
        description: "Avise a pessoa pra entrar com os dados novos.",
      });
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={!!profile} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Acesso de{" "}
            {profile?.full_name ?? profile?.email ?? "atendente"}
          </DialogTitle>
          <DialogDescription>
            Mexa só no que precisa mudar. A senha atual não aparece aqui porque o
            banco guarda apenas um resumo embaralhado dela — ninguém consegue ler.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cred-email">Email de login</Label>
            <Input
              id="cred-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cred-senha">Nova senha</Label>
            <div className="relative">
              <Input
                id="cred-senha"
                type={mostrarSenha ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Deixe vazio pra não mexer na senha"
                disabled={pending}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                tabIndex={-1}
                aria-label={mostrarSenha ? "Esconder senha" : "Mostrar senha"}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-wa-textSecondary hover:text-foreground"
              >
                {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {senhaCurta && (
              <p className="text-xs text-red-400">Pelo menos 8 caracteres.</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={pending || nada || senhaCurta}>
            {pending ? (
              <Loader2 className="animate-spin h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar acesso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
