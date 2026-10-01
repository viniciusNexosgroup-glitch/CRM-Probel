import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { ConversationList } from "./_components/conversation-list";
import type { ConversationWithContact, TagRow } from "./types";

export const dynamic = "force-dynamic";

/**
 * Lista de conversas SEM as etiquetas penduradas em cada linha.
 *
 * Com elas, o banco precisava montar quatro níveis encaixados (conversa →
 * contato → lead → etiqueta) para 200 conversas: medido em 943ms contra 448ms
 * sem. Como existem pouquíssimas associações de etiqueta no banco inteiro, sai
 * muito mais barato buscá-las de uma vez (ver getLeadTags) e juntar aqui.
 */
async function getConversations() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select(
      `
      *,
      contact:contacts!conversations_contact_id_fkey (
        id, name, push_name, phone, profile_pic_url, is_group, is_favorite, whatsapp_id
      ),
      assigned_user:profiles!conversations_assigned_to_fkey (
        id, full_name, email, avatar_url
      )
    `
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200);

  if (error) {
    console.error("[chat] erro buscando conversas:", error.message);
    return [];
  }
  // Os tipos gerados não descrevem os relacionamentos, então a forma vem daqui.
  return (data ?? []) as unknown as ConversaSemEtiquetas[];
}

/**
 * Todas as etiquetas aplicadas a leads. São poucas, então vem numa consulta só,
 * em paralelo com a lista — sem esperar nada e sem custo perceptível.
 */
/** Conversa como vem do banco, antes de receber as etiquetas. */
type ConversaSemEtiquetas = Omit<ConversationWithContact, "contact"> & {
  contact: Omit<ConversationWithContact["contact"], "leads">;
};

async function getLeadTags() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_tags")
    .select("tag:tags(id, name, color, created_at), lead:leads!inner(id, contact_id)");
  return (data ?? []) as unknown as Array<{
    tag: TagRow;
    lead: { id: string; contact_id: string };
  }>;
}

/** Devolve as conversas no formato que a lista espera, com as etiquetas no lugar. */
function juntarEtiquetas(
  conversas: ConversaSemEtiquetas[],
  vinculos: Awaited<ReturnType<typeof getLeadTags>>
): ConversationWithContact[] {
  const porContato = new Map<string, { id: string; lead_tags: { tag: TagRow }[] }>();
  for (const v of vinculos) {
    if (!v.lead?.contact_id || !v.tag) continue;
    const atual = porContato.get(v.lead.contact_id) ?? { id: v.lead.id, lead_tags: [] };
    atual.lead_tags.push({ tag: v.tag });
    porContato.set(v.lead.contact_id, atual);
  }
  return conversas.map((c) => ({
    ...c,
    contact: { ...c.contact, leads: porContato.get(c.contact.id) ?? null },
  }));
}

async function getAllTags() {
  const supabase = await createClient();
  const { data } = await supabase.from("tags").select("*").order("name", { ascending: true });
  return data ?? [];
}

async function getAssignees() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name", { ascending: true });
  return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
}

/**
 * Layout do chat: a lista de conversas vive aqui (não na page) pra NÃO ser
 * re-buscada a cada troca de conversa (mudança do ?c=). O Next mantém o layout
 * montado entre navegações; só a page (painel da conversa) recarrega.
 */
export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  // O perfil entra no mesmo lote das consultas: as listas dependem da sessão
  // (que vem do cookie), não do perfil, então esperar por ele antes só somava
  // uma ida à rede na frente de todas as outras.
  const [profile, conversasCruas, vinculosDeEtiqueta, allTags, assignees] = await Promise.all([
    getCurrentProfile(),
    getConversations(),
    getLeadTags(),
    getAllTags(),
    getAssignees(),
  ]);
  const conversations = juntarEtiquetas(conversasCruas, vinculosDeEtiqueta);

  if (!profile) redirect("/login");

  return (
    <div className="h-full flex bg-wa-bg overflow-hidden">
      <ConversationList
        initial={conversations}
        allTags={allTags}
        currentUserId={profile.id}
        isAdmin={profile.role === "admin"}
        assignees={assignees}
      />
      {children}
    </div>
  );
}
