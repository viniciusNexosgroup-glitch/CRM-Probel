"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import {
  createQuickReplyAction,
  updateQuickReplyAction,
  type QuickReplyPayload,
} from "../actions";
import { TEMPLATE_VARIABLES } from "@/lib/format/template";
import type { Database } from "@/types/database";

type QuickReplyRow = Database["public"]["Tables"]["quick_replies"]["Row"];

export function QuickReplyDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: QuickReplyRow | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState<QuickReplyPayload>({
    shortcut: "",
    title: "",
    content: "",
    category: "",
  });

  useEffect(() => {
    if (editing) {
      setForm({
        shortcut: editing.shortcut,
        title: editing.title,
        content: editing.content,
        category: editing.category ?? "",
      });
    } else {
      setForm({ shortcut: "/", title: "", content: "", category: "" });
    }
  }, [editing, open]);

  async function onSave() {
    setPending(true);
    const action = editing
      ? updateQuickReplyAction(editing.id, form)
      : createQuickReplyAction(form);
    const res = await action;
    setPending(false);
    if (!res.ok) {
      toast.error("Falha ao salvar", { description: res.error });
      return;
    }
    toast.success(editing ? "Resposta atualizada" : "Resposta criada");
    onClose();
    router.refresh();
  }

  function set<K extends keyof QuickReplyPayload>(key: K, value: QuickReplyPayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function insertVar(token: string) {
    set("content", (form.content || "") + token);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar resposta rápida" : "Nova resposta rápida"}</DialogTitle>
          <DialogDescription>
            Atalho começa com <code>/</code>. Use variáveis pra personalizar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qr-shortcut">Atalho *</Label>
              <Input
                id="qr-shortcut"
                value={form.shortcut}
                onChange={(e) => set("shortcut", e.target.value)}
                placeholder="/saudacao"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qr-category">Categoria</Label>
              <Input
                id="qr-category"
                value={form.category ?? ""}
                onChange={(e) => set("category", e.target.value)}
                placeholder="Saudação, Preços, etc"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qr-title">Título *</Label>
            <Input
              id="qr-title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Descreva pra que serve"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="qr-content">Conteúdo *</Label>
              <div className="flex gap-1">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.token}
                    type="button"
                    onClick={() => insertVar(v.token)}
                    title={v.description}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary hover:bg-primary/25"
                  >
                    {v.token}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              id="qr-content"
              rows={6}
              value={form.content}
              onChange={(e) => set("content", e.target.value)}
              placeholder="Olá {primeiro_nome}, tudo bem?"
            />
            <p className="text-[10px] text-muted-foreground">
              Clique nas variáveis acima pra inserir no cursor (apenda no final).
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={pending}>
            {pending && <Loader2 className="animate-spin h-4 w-4" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
