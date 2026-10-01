"use server";

import { revalidatePath } from "next/cache";
import { getCurrentInstanceId } from "@/lib/auth/current-user";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin, getCurrentProfile } from "@/lib/auth/roles";
import { logAudit } from "@/lib/audit/log";
import type { Json } from "@/types/database";

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

const ADMIN_ONLY = "Apenas administradores podem gerenciar a equipe.";

export async function saveInviteWelcomeAction(text: string): Promise<Result> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: ADMIN_ONLY };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const instanceId = await getCurrentInstanceId();
  if (!instanceId) return { ok: false, error: "Usuário sem loja vinculada" };
  const { error } = await supabase.from("settings").upsert(
    {
      key: "invite_welcome",
      instance_id: instanceId,
      value: { text: text.trim() } as unknown as Json,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "instance_id,key" }
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/team");
  return { ok: true };
}

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

/**
 * Confere se o admin logado pode mexer na conta `userId`.
 *
 * As duas ações abaixo usam o service client (só ele fala com a API de
 * autenticação), e service client ignora RLS. Então a checagem de loja que o
 * banco faria sozinho precisa ser feita aqui na mão: sem isso, um admin da
 * Vivence conseguiria trocar a senha de alguém da Probel.
 */
async function autorizarAlvo(
  userId: string
): Promise<{ ok: true; alvoNome: string; atorId: string | null } | { ok: false; error: string }> {
  const ator = await getCurrentProfile();
  if (ator?.role !== "admin") return { ok: false, error: ADMIN_ONLY };

  const service = createServiceClient();
  const { data: alvo, error } = await service
    .from("profiles")
    .select("id, full_name, email, instance_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!alvo) return { ok: false, error: "Atendente não encontrado." };
  if (alvo.instance_id !== ator.instance_id) {
    return { ok: false, error: "Esse atendente é de outra loja." };
  }

  return { ok: true, alvoNome: alvo.full_name ?? alvo.email ?? "o atendente", atorId: ator.id };
}

/**
 * Troca o email de login de um atendente.
 *
 * Grava nos dois lugares: `auth.users` (que é o login de verdade) e
 * `profiles.email` (que é o que a tela de Equipe mostra). Mudar só um deixaria
 * a tela exibindo um email com o qual ninguém consegue entrar.
 *
 * `email_confirm: true` é obrigatório aqui: o Supabase da VPS não tem SMTP, o
 * email de confirmação nunca sairia e a pessoa ficaria trancada do lado de fora.
 */
export async function updateUserEmailAction(userId: string, email: string): Promise<Result> {
  const permissao = await autorizarAlvo(userId);
  if (!permissao.ok) return permissao;

  const novoEmail = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(novoEmail)) {
    return { ok: false, error: "Email inválido" };
  }

  const service = createServiceClient();
  const { error } = await service.auth.admin.updateUserById(userId, {
    email: novoEmail,
    email_confirm: true,
  });
  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      return { ok: false, error: "Esse email já está em uso por outra conta." };
    }
    return { ok: false, error: error.message };
  }

  const { error: erroPerfil } = await service
    .from("profiles")
    .update({ email: novoEmail })
    .eq("id", userId);
  if (erroPerfil) {
    return {
      ok: false,
      error: `Login trocado, mas a lista ficou com o email antigo: ${erroPerfil.message}`,
    };
  }

  await logAudit({
    actorId: permissao.atorId,
    action: "team_email_change",
    entityType: "profile",
    entityId: userId,
    summary: `Email de login de ${permissao.alvoNome} mudou para ${novoEmail}`,
  });

  revalidatePath("/settings/team");
  return { ok: true };
}

/**
 * Define uma senha nova para um atendente.
 *
 * Existe porque não há como recuperar a senha de ninguém — o banco guarda só o
 * hash — e o fluxo de "esqueci minha senha" depende de email, que o Supabase da
 * VPS não consegue enviar. Sem isso, repor o acesso de um atendente exigia SSH.
 *
 * A senha nunca entra no audit_log.
 */
export async function setUserPasswordAction(userId: string, password: string): Promise<Result> {
  const permissao = await autorizarAlvo(userId);
  if (!permissao.ok) return permissao;

  if (password.length < 8) {
    return { ok: false, error: "A senha precisa de pelo menos 8 caracteres." };
  }

  const service = createServiceClient();
  const { error } = await service.auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: permissao.atorId,
    action: "team_password_set",
    entityType: "profile",
    entityId: userId,
    summary: `Senha de ${permissao.alvoNome} foi redefinida por um administrador`,
  });

  revalidatePath("/settings/team");
  return { ok: true };
}
