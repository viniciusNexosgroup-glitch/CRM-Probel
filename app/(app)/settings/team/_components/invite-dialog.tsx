"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Mail, UserPlus } from "lucide-react";
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
import { Select } from "@/components/ui/select";
import { inviteUserAction } from "../actions";

export function InviteDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");

  function reset() {
    setEmail("");
    setName("");
    setRole("user");
  }

  function onSubmit() {
    startTransition(async () => {
      const res = await inviteUserAction(email, name, role);
      if (res.ok) {
        toast.success("Convite enviado", {
          description: `${email} vai receber um email pra definir senha.`,
        });
        reset();
        onClose();
        router.refresh();
      } else {
        toast.error("Falha ao convidar", { description: res.error });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && (reset(), onClose())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" /> Convidar atendente
          </DialogTitle>
          <DialogDescription>
            A pessoa receberá um email pra definir senha e acessar o CRM.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="inv-name">Nome completo *</Label>
            <Input
              id="inv-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João Silva"
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-email">Email *</Label>
            <Input
              id="inv-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="joao@empresa.com"
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-role">Permissão</Label>
            <Select
              id="inv-role"
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "user")}
              disabled={pending}
            >
              <option value="user">Atendente — uso normal</option>
              <option value="admin">Administrador — pode gerenciar equipe</option>
            </Select>
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
          <Button
            onClick={onSubmit}
            disabled={pending || !email.trim() || !name.trim()}
          >
            {pending ? <Loader2 className="animate-spin h-4 w-4" /> : <Mail className="h-4 w-4" />}
            Enviar convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
