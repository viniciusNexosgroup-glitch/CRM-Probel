/**
 * Resolve variáveis tipo {nome} no conteúdo de uma resposta rápida.
 *
 * Variáveis suportadas:
 *   {nome}          → nome completo do contato (ou push_name, ou telefone formatado)
 *   {primeiro_nome} → primeira palavra de {nome}
 *   {telefone}      → telefone formatado
 */
import { formatPhone } from "./avatar";

export type TemplateContext = {
  contactName?: string | null;
  pushName?: string | null;
  phone?: string | null;
};

export function resolveTemplate(template: string, ctx: TemplateContext): string {
  const fullName =
    ctx.contactName?.trim() ||
    ctx.pushName?.trim() ||
    (ctx.phone ? formatPhone(ctx.phone) : "") ||
    "";

  const firstName = fullName ? fullName.split(/\s+/)[0] : "";
  const phoneFormatted = ctx.phone ? formatPhone(ctx.phone) : "";

  return template
    .replace(/\{nome\}/gi, fullName || "amigo(a)")
    .replace(/\{primeiro_nome\}/gi, firstName || "amigo(a)")
    .replace(/\{telefone\}/gi, phoneFormatted);
}

/** Lista das variáveis disponíveis (pra mostrar no editor). */
export const TEMPLATE_VARIABLES = [
  { token: "{nome}", description: "Nome completo do contato" },
  { token: "{primeiro_nome}", description: "Primeiro nome do contato" },
  { token: "{telefone}", description: "Telefone formatado" },
] as const;
