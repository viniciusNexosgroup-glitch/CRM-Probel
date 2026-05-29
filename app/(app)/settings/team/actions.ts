"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin, getCurrentProfile } from "@/lib/auth/roles";
import { logAudit } from "@/lib/audit/log";

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

const ADMIN_ONLY = "Apenas administradores podem gerenciar a equipe.";

export async function inviteUserAction(
  email: string,
  fullName: string,
  role: "admin" | "user"
): Promise<Result> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: ADMIN_ONLY };
  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
    return { ok: false, error: "Email inválido" };
  }
  if (!fullName.trim()) {
    return { ok: false, error: "Nome é obrigatório" };
  }

  const supabase = createServiceClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(cleanEmail, {
    redirectTo: `${appUrl}/auth/callback?type=invite&next=/reset-password`,
    data: { full_name: fullName.trim() },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      return { ok: false, error: "Esse email já tem cadastro." };
    }
    return { ok: false, error: error.message };
  }

  // Define a role e nome no profile (o trigger handle_new_user já cria com role=user)
  if (data?.user) {
    const adminClient = createServiceClient();
    await adminClient
      .from("profiles")
      .update({ role, full_name: fullName.trim() })
      .eq("id", data.user.id);
  }

  const actor = await getCurrentProfile();
  await logAudit({
    actorId: actor?.id ?? null,
    action: "team_invite",
    entityType: "profile",
    entityId: data?.user?.id,
    summary: `${actor?.full_name ?? actor?.email ?? "Alguém"} convidou ${cleanEmail} (${role})`,
  });

  revalidatePath("/settings/team");
  return { ok: true };
}

export async function updateUserRoleAction(
  userId: string,
  role: "admin" | "user"
): Promise<Result> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: ADMIN_ONLY };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  const actor = await getCurrentProfile();
  await logAudit({
    actorId: actor?.id ?? null,
    action: "team_role_change",
    entityType: "profile",
    entityId: userId,
    summary: `${actor?.full_name ?? actor?.email ?? "Alguém"} mudou um atendente para ${role}`,
    meta: { role },
  });

  revalidatePath("/settings/team");
  return { ok: true };
}

export async function removeUserAction(userId: string): Promise<Result> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: ADMIN_ONLY };
  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  if (currentUser?.id === userId) {
    return { ok: false, error: "Você não pode remover a si mesmo." };
  }

  const service = createServiceClient();
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };

  const actor = await getCurrentProfile();
  await logAudit({
    actorId: actor?.id ?? null,
    action: "team_remove",
    entityType: "profile",
    entityId: userId,
    summary: `${actor?.full_name ?? actor?.email ?? "Alguém"} removeu um atendente`,
  });

  revalidatePath("/settings/team");
  return { ok: true };
}
