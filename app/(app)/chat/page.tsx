import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/auth/current-user";
import { ChatWindow } from "./_components/chat-window";
import { EmptyState } from "./_components/empty-state";
import {
  MESSAGE_COLUMNS,
  type ConversationWithContact,
  type ContactPanelData,
  type MessageRow,
  type AssigneeProfile,
} from "./types";

export const dynamic = "force-dynamic";

const MESSAGES_LIMIT = 100;

async function getAllProfiles(): Promise<AssigneeProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .order("full_name", { ascending: true });
  return (data ?? []) as AssigneeProfile[];
}

async function getConversationById(id: string): Promise<ConversationWithContact | null> {
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
    .eq("id", id)
    .single();
  if (error || !data) return null;

  // As etiquetas do lead não vêm nesta consulta de propósito. Quem as usa é a
  // lista de conversas, que vive no layout e não recarrega a cada clique --
  // aqui elas seriam buscadas e descartadas. Pedi-las aninhadas custava 155ms
  // contra 100ms sem, em toda abertura de conversa, e essa é a primeira ida à
  // rede: tudo o mais espera por ela.
  const bruto = data as unknown as ConversationWithContact;
  return { ...bruto, contact: { ...bruto.contact, leads: null } };
}

async function getContactPanelData(contactId: string): Promise<ContactPanelData | null> {
  const supabase = await createClient();
  const [contactRes, leadRes, allTagsRes] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", contactId).single(),
    supabase
      .from("leads")
      .select("*, lead_tags(tag:tags(*))")
      .eq("contact_id", contactId)
      .maybeSingle(),
    supabase.from("tags").select("*").order("name", { ascending: true }),
  ]);

  if (contactRes.error || !contactRes.data) return null;
  const lead = leadRes.data ?? null;

  // Estágios do DONO do lead (funil individual); sem dono => board "Sem vendedor".
  const stageOwnerId = (lead as { assigned_to?: string | null } | null)?.assigned_to ?? null;
  let stagesQuery = supabase
    .from("pipeline_stages")
    .select("*")
    .order("position", { ascending: true });
  stagesQuery =
    stageOwnerId === null
      ? stagesQuery.is("user_id", null)
      : stagesQuery.eq("user_id", stageOwnerId);

  // Estágios, tarefas e histórico dependem do lead, mas não uns dos outros —
  // vão juntos numa ida só. Em série eram 3 idas à rede, e é isso que fazia a
  // conversa demorar a abrir (o banco responde em milissegundos).
  const [allStagesRes, tasksRes, activityRes] = await Promise.all([
    stagesQuery,
    supabase
      .from("tasks")
      .select("*")
      .or(
        lead
          ? `lead_id.eq.${lead.id},contact_id.eq.${contactId}`
          : `contact_id.eq.${contactId}`
      )
      .order("due_at", { ascending: true, nullsFirst: false }),
    lead
      ? supabase
          .from("lead_activity")
          .select(`*, user:profiles!lead_activity_user_id_fkey(full_name, email)`)
          .eq("lead_id", lead.id)
          .order("created_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    contact: contactRes.data,
    lead: lead as ContactPanelData["lead"],
    tasks: tasksRes.data ?? [],
    allTags: allTagsRes.data ?? [],
    allStages: allStagesRes.data ?? [],
    activity: (activityRes.data ?? []) as unknown as ContactPanelData["activity"],
  };
}

async function getMessages(conversationId: string): Promise<MessageRow[]> {
  const supabase = await createClient();
  // Carrega as ÚLTIMAS N (desc) e reverte pra ordem cronológica.
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId)
    .order("timestamp", { ascending: false })
    .limit(MESSAGES_LIMIT);
  if (error) {
    console.error("[chat] erro buscando mensagens:", error.message);
    return [];
  }
  return ((data ?? []) as MessageRow[]).reverse();
}

/**
 * Mensagens citadas que ficaram fora da janela carregada.
 *
 * A tela carrega as últimas N mensagens e monta a citação olhando só para
 * essas. Quando o cliente responde a algo mais antigo, a citação não teria o
 * que mostrar. Estas vão à parte, só para consulta -- não entram na timeline,
 * senão mensagens velhas reapareceriam no meio da conversa.
 */
async function getQuotedExtras(messages: MessageRow[]): Promise<MessageRow[]> {
  const carregadas = new Set(messages.map((m) => m.id));
  const faltando = [
    ...new Set(
      messages
        .map((m) => m.reply_to_id)
        .filter((id): id is string => !!id && !carregadas.has(id))
    ),
  ];
  if (faltando.length === 0) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .in("id", faltando);
  return (data ?? []) as MessageRow[];
}

async function getInternalNotes(conversationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("internal_notes")
    .select("*, author:profiles!internal_notes_author_id_fkey(id, full_name, email, avatar_url)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return (data ?? []) as unknown as import("./types").InternalNoteWithAuthor[];
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) redirect("/login");

  const { c: selectedId } = await searchParams;

  if (!selectedId) return <EmptyState />;

  // Tudo que precisa só do id da conversa sai na mesma leva. Antes, a conversa
  // era buscada sozinha e só então o resto começava -- uma ida à rede inteira
  // de espera antes da primeira consulta útil, em cada clique num lead.
  const [selected, messages, internalNotes, quickRepliesRes, mediasRes, mediaCatsRes, allProfiles] =
    await Promise.all([
      getConversationById(selectedId),
      getMessages(selectedId),
      getInternalNotes(selectedId),
      supabase.from("quick_replies").select("*").order("position", { ascending: true }),
      supabase.from("media_library").select("*").order("created_at", { ascending: false }),
      supabase.from("media_categories").select("*").order("position", { ascending: true }),
      getAllProfiles(),
    ]);

  if (!selected) return <EmptyState />;

  // Só o painel do contato depende da conversa já carregada (precisa do id do
  // contato). As citações dependem das mensagens, então vão junto com ele.
  const [panelData, quotedExtras] = await Promise.all([
    getContactPanelData(selected.contact.id),
    getQuotedExtras(messages),
  ]);

  return (
    <ChatWindow
      conversation={selected}
      initialMessages={messages}
      quotedExtras={quotedExtras}
      internalNotes={internalNotes ?? []}
      panelData={panelData}
      quickReplies={quickRepliesRes?.data ?? []}
      medias={mediasRes?.data ?? []}
      mediaCategories={mediaCatsRes?.data ?? []}
      allProfiles={allProfiles}
      currentUserId={user.id}
    />
  );
}
