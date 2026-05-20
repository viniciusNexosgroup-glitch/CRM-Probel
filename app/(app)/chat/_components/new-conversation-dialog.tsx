"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MessageSquarePlus, Phone } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { startConversationAction } from "../actions";

/** Formatação visual conforme digita: (34) 9 9999-8888 */
function formatPhoneInput(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11); // sem o 55
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
}

export function NewConversationDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setPhone("");
    setText("");
  }

  function onSubmit() {
    if (pending) return;
    if (!phone.trim() || !text.trim()) {
      toast.error("Preencha telefone e mensagem");
      return;
    }
    startTransition(async () => {
      const res = await startConversationAction(phone, text);
      if (!res.ok) {
        toast.error("Falha ao iniciar conversa", { description: res.error });
        return;
      }
      toast.success("Conversa iniciada!");
      const id = res.data?.conversationId;
      reset();
      onClose();
      if (id) router.push(`/chat?c=${id}`);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !pending) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-primary" /> Nova conversa
          </DialogTitle>
          <DialogDescription>
            Inicie uma conversa com um número que ainda não te enviou mensagem (lead
            do site, anúncio, indicação, etc).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nc-phone">Telefone *</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-wa-textSecondary" />
              <Input
                id="nc-phone"
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                placeholder="(34) 9 9999-8888"
                disabled={pending}
                className="pl-9"
                autoFocus
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Brasileiro com DDD. Sistema adiciona o 55 automaticamente.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nc-msg">Mensagem inicial *</Label>
            <Textarea
              id="nc-msg"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="Olá! Sou da Colchões Probel, vi que você se interessou pelo nosso catálogo..."
              disabled={pending}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={pending || !phone.trim() || !text.trim()}>
            {pending && <Loader2 className="animate-spin h-4 w-4" />}
            Iniciar conversa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
