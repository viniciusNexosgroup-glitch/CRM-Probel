"use server";

import { revalidatePath } from "next/cache";
import { getCurrentInstanceId } from "@/lib/auth/current-user";
import { getCurrentProfile } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { normalizarFollowUp, type FollowUpConfig } from "@/lib/follow-up/regras";
import type { Json } from "@/types/database";

type Result = { ok: true } | { ok: false; error: string };

export async function salvarFollowUpAction(cfg: FollowUpConfig): Promise<Result> {
  const perfil = await getCurrentProfile();
  if (perfil?.role !== "admin") return { ok: false, error: "Só administradores mudam o follow-up." };

  for (const [i, etapa] of cfg.etapas.entries()) {
    if (!etapa.mensagens.some((m) => m.trim())) {
      return { ok: false, error: `A ${i + 1}ª mensagem precisa de pelo menos um texto.` };
    }
  }
  if (cfg.dias.length === 0) return { ok: false, error: "Escolha pelo menos um dia de envio." };
  if (cfg.inicio >= cfg.fim) return { ok: false, error: "O horário de início tem de ser antes do fim." };

  const instanceId = await getCurrentInstanceId();
  if (!instanceId) return { ok: false, error: "Usuário sem loja vinculada" };

  // Normaliza para gravar só o que a rotina entende (textos vazios fora,
  // números dentro dos limites).
  const limpo = normalizarFollowUp({
    ...cfg,
    etapas: cfg.etapas.map((e) => ({ ...e, mensagens: e.mensagens.map((m) => m.trim()).filter(Boolean) })),
  });

  const supabase = await createClient();
  const { error } = await supabase.from("settings").upsert(
    {
      key: "follow_up",
      instance_id: instanceId,
      value: limpo as unknown as Json,
      updated_by: perfil.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "instance_id,key" }
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/follow-up");
  return { ok: true };
}
