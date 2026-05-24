"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createSalesbotFlowAction } from "../actions";

type Props = {
  disabled?: boolean;
};

export function CreateFlowForm({ disabled = false }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createSalesbotFlowAction(formData);
      if (!result.ok) {
        toast.error("Falha ao criar fluxo", { description: result.error });
        return;
      }
      if (!result.data) {
        toast.error("Falha ao criar fluxo", { description: "Resposta sem ID do fluxo." });
        return;
      }

      toast.success("Fluxo criado");
      router.push(`/salesbot/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="bg-wa-panel border border-wa-border rounded-lg p-4 space-y-3">
      <div>
        <h2 className="text-sm font-medium text-wa-textPrimary flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          Novo fluxo
        </h2>
        <p className="text-xs text-wa-textSecondary mt-1">
          Comece com um rascunho e monte os blocos no editor.
        </p>
      </div>
      <Input name="name" placeholder={"Ex: Qualifica\u00e7\u00e3o WhatsApp"} disabled={disabled || isPending} />
      <Input name="description" placeholder={"Descri\u00e7\u00e3o curta"} disabled={disabled || isPending} />
      <Select name="channel" defaultValue="whatsapp" disabled={disabled || isPending}>
        <option value="whatsapp">WhatsApp</option>
        <option value="instagram">Instagram Direct</option>
        <option value="facebook">Facebook Messenger</option>
        <option value="webchat">Webchat</option>
        <option value="multi">Multi-canal</option>
      </Select>
      <Button type="submit" className="w-full" disabled={disabled || isPending}>
        <Plus className="h-4 w-4" />
        {isPending ? "Criando..." : "Criar fluxo"}
      </Button>
    </form>
  );
}
