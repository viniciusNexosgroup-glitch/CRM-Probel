"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Shield, ShieldOff, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format/avatar";
import { InviteDialog } from "./invite-dialog";
import { updateUserRoleAction, removeUserAction } from "../actions";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function TeamList({
  profiles,
  currentUserId,
}: {
  profiles: Profile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function onChangeRole(userId: string, role: "admin" | "user") {
    setPendingId(userId);
    startTransition(async () => {
      const res = await updateUserRoleAction(userId, role);
      setPendingId(null);
      if (res.ok) {
        toast.success("Permissão alterada");
        router.refresh();
      } else {
        toast.error("Falha", { description: res.error });
      }
    });
  }

  function onRemove(profile: Profile) {
    if (profile.id === currentUserId) {
      toast.error("Você não pode remover a si mesmo.");
      return;
    }
    if (!confirm(`Remover ${profile.full_name ?? profile.email} da equipe?`)) return;
    setPendingId(profile.id);
    startTransition(async () => {
      const res = await removeUserAction(profile.id);
      setPendingId(null);
      if (res.ok) {
        toast.success("Removido da equipe");
        router.refresh();
      } else {
        toast.error("Falha", { description: res.error });
      }
    });
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">
          {profiles.length} {profiles.length === 1 ? "atendente" : "atendentes"} no CRM
        </p>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Convidar atendente
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-wa-header text-wa-textSecondary text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Atendente</th>
              <th className="text-left px-4 py-2 font-medium">Email</th>
              <th className="text-left px-4 py-2 font-medium">Permissão</th>
              <th className="text-right px-4 py-2 font-medium w-12"></th>
            </tr>
          </thead>
          <tbody className="bg-card">
            {profiles.map((p) => {
              const isCurrent = p.id === currentUserId;
              const busy = pendingId === p.id;
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                        {getInitials(p.full_name ?? p.email ?? "?").slice(0, 2)}
                      </span>
                      <div>
                        <p className="font-medium text-foreground">
                          {p.full_name ?? "—"}
                          {isCurrent && (
                            <span className="text-[10px] text-primary ml-2">(você)</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{p.email}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={p.role}
                      onChange={(e) =>
                        onChangeRole(p.id, e.target.value as "admin" | "user")
                      }
                      disabled={busy}
                      className="h-8 text-xs w-36"
                    >
                      <option value="user">Atendente</option>
                      <option value="admin">Administrador</option>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onRemove(p)}
                      disabled={busy || isCurrent}
                      title={isCurrent ? "Você não pode remover a si mesmo" : "Remover"}
                      className={cn(
                        "p-1.5 rounded-full text-wa-textSecondary hover:text-red-400 hover:bg-red-500/10 transition-colors",
                        (busy || isCurrent) && "opacity-30 cursor-not-allowed"
                      )}
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground mt-4 flex items-start gap-1.5">
        <Shield className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
        <span>
          <strong>Administradores</strong> podem gerenciar a equipe e configurações.{" "}
          <strong>Atendentes</strong> têm acesso normal a conversas, leads e funil.
        </span>
      </p>

      <InviteDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
