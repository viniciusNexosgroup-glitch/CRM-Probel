"use server";

import { revalidatePath } from "next/cache";
import { evolution, mapEvolutionStateToDb, EvolutionError } from "@/lib/evolution/client";
import { createClient } from "@/lib/supabase/server";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Busca dados atualizados da instância na Evolution e faz upsert na tabela whatsapp_instances.
 */
export async function syncInstanceAction(): Promise<ActionResult<{ status: string }>> {
  try {
    const instance = await evolution.fetchInstance();
    if (!instance) {
      return {
        ok: false,
        error:
          "Instância não encontrada na Evolution. Verifique EVOLUTION_INSTANCE_NAME no .env.local.",
      };
    }

    const supabase = await createClient();
    const status = mapEvolutionStateToDb(instance.connectionStatus);

    const { error } = await supabase
      .from("whatsapp_instances")
      .upsert(
        {
          instance_name: instance.name,
          evolution_api_url: process.env.EVOLUTION_API_URL!,
          status,
          phone_number: instance.ownerJid?.split("@")[0] ?? null,
          profile_name: instance.profileName,
          profile_pic_url: instance.profilePicUrl,
          last_connected_at: status === "connected" ? new Date().toISOString() : undefined,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "instance_name" }
      );

    if (error) {
      return { ok: false, error: `Erro ao salvar no banco: ${error.message}` };
    }

    revalidatePath("/settings/whatsapp");
    return { ok: true, data: { status } };
  } catch (e) {
    if (e instanceof EvolutionError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Desconecta o WhatsApp da instância (logout). Mantém a instância na Evolution.
 */
export async function disconnectAction(): Promise<ActionResult> {
  try {
    await evolution.logout();
    await syncInstanceAction();
    revalidatePath("/settings/whatsapp");
    return { ok: true };
  } catch (e) {
    if (e instanceof EvolutionError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Reconecta a instância. Se estiver disconnected, retorna QR Code em base64.
 */
export async function reconnectAction(): Promise<ActionResult<{ qrCode?: string }>> {
  try {
    const resp = await evolution.connect();
    await syncInstanceAction();
    revalidatePath("/settings/whatsapp");
    return { ok: true, data: { qrCode: resp.base64 } };
  } catch (e) {
    if (e instanceof EvolutionError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: (e as Error).message };
  }
}
