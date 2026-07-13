"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { editMessageAction, deleteMessageAction } from "../actions";
import type { MessageRow } from "../types";

/**
 * Dialog de edição de mensagem enviada (texto).
 * WhatsApp só aceita editar em até ~15 min — o server action valida e
 * devolve erro amigável se passou da janela.
 */
export function EditMessageDialog({
  message,
  onClose,
  onEdited,
}: {
  message: MessageRow | null;
  onClose: () => void;
  onEdited: (id: string, newText: string) => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (message) setText(message.content ?? "");
  }, [message]);

  async function save() {
    if (!message || saving) return;
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error("Mensagem não pode ficar vazia");
      return;
    }
    setSaving(true);
    const res = await editMessageAction(message.id, trimmed);
    setSaving(false);
    if (res.ok) {
      onEdited(message.id, trimmed);
      toast.success("Mensagem editada");
      onClose();
    } else {
      toast.error("Não foi possível editar", { description: res.error });
    }
  }

  return (
    <Dialog open={!!message} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" /> Editar mensagem
          </DialogTitle>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={4096}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              save();
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          O WhatsApp permite editar em até 15 minutos após o envio. O cliente verá
          a mensagem marcada como &quot;editada&quot;.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !text.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Confirmação de "apagar para todos". A mensagem some no WhatsApp do cliente
 * e vira "Mensagem apagada" no CRM (is_deleted).
 */
export function DeleteMessageDialog({
  message,
  onClose,
  onDeleted,
}: {
  message: MessageRow | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function confirm() {
    if (!message || deleting) return;
    setDeleting(true);
    const res = await deleteMessageAction(message.id);
    setDeleting(false);
    if (res.ok) {
      onDeleted(message.id);
      toast.success("Mensagem apagada para todos");
      onClose();
    } else {
      toast.error("Não foi possível apagar", { description: res.error });
    }
  }

  return (
    <Dialog open={!!message} onOpenChange={(o) => !o && !deleting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" /> Apagar mensagem?
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          A mensagem será apagada para todos — some do WhatsApp do cliente também.
          Essa ação não pode ser desfeita.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={deleting}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={deleting}>
            {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Apagar para todos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
