"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveInviteWelcomeAction } from "../actions";

export function InviteWelcomeEditor({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  const [pending, startTransition] = useTransition();

  function onSave() {
    startTransition(async () => {
      const res = await saveInviteWelcomeAction(text);
      if (res.ok) toast.success("Mensagem salva");
      else toast.error("Falha", { description: res.error });
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 mt-6">
      <p className="text-sm font-medium text-foreground flex items-center gap-2 mb-1">
        <Mail className="h-4 w-4 text-primary" />
        Mensagem de boas-vindas
      </p>
      <p className="text-xs text-muted-foreground mb-3">
        Texto que o atendente vê ao abrir o convite e definir a senha. Ex: regras da loja, link de
        treinamento, etc.
      </p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Bem-vindo(a) à equipe da Probel! Qualquer dúvida, fale com o gerente…"
        rows={3}
        className="text-sm"
      />
      <div className="flex justify-end mt-2">
        <Button onClick={onSave} disabled={pending} size="sm">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}
