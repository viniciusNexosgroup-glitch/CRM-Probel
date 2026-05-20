import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConversationList } from "./_components/conversation-list";
import { ChatWindow } from "./_components/chat-window";
import { EmptyState } from "./_components/empty-state";
import type {
  ConversationWithContact,
  ContactPanelData,
  MessageRow,
} from "./types";

export const dynamic = "force-dynamic";

const MESSAGES_LIMIT = 100;

async function getConversations(): Promise<ConversationWithContact[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select(
      `
      *,
      contact:contacts!conversations_contact_id_fkey (
        id, name, push_name, phone, profile_pic_url, is_group, is_favorite, whatsapp_id,
        leads:leads_contact_id_fkey (
          id,
          lead_tags ( tag:tags(*) )
        )
      )
    `
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200);

  if (error) {
    console.error("[chat] erro buscando conversas:", error.message);
    return [];
  }
  return (data ?? []) as unknown as ConversationWithContact[];
}

async function getAllTags() {
  const supabase = await createClient();
  const { data } = await supabase.from("tags").select("*").order("name", { ascending: true });
  return data ?? [];
}

async function getConversationById(id: string): Promise<ConversationWithContact | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select(
      `
      *,
      contact:contacts!conversations_contact_id_fkey (
        id, name, push_name, phone, profile_pic_url, is_group, is_favorite, whatsapp_id,
        leads:leads_contact_id_fkey (
          id,
          lead_tags ( tag:tags(*) )
        )
      )
    `
    )
    .eq("id", id)
    .single();
  if (error) return null;
  return data as unknown as ConversationWithContact;
}

async function getContactPanelData(contactId: string): Promise<ContactPanelData | null> {
  const supabase = await createClient();
  const [contactRes, leadRes, allTagsRes, allStagesRes] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", contactId).single(),
    supabase
      .from("leads")
      .select("*, lead_tags(tag:tags(*))")
      .eq("contact_id", contactId)
      .maybeSingle(),
    supabase.from("tags").select("*").order("name", { ascending: true }),
    supabase.from("pipeline_stages").select("*").order("position", { ascending: true }),
  ]);

  if (contactRes.error || !contactRes.data) return null;
  const lead = leadRes.data ?? null;

  const tasksRes = await supabase
    .from("tasks")
    .select("*")
    .or(
      lead
        ? `lead_id.eq.${lead.id},contact_id.eq.${contactId}`
        : `contact_id.eq.${contactId}`
    )
    .order("due_at", { ascending: true, nullsFirst: false });

  return {
    contact: contactRes.data,
    lead: lead as ContactPanelData["lead"],
    tasks: tasksRes.data ?? [],
    allTags: allTagsRes.data ?? [],
    allStages: allStagesRes.data ?? [],
  };
}

async function getMessages(conversationId: string): Promise<MessageRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("timestamp", { ascending: true })
    .limit(MESSAGES_LIMIT);
  if (error) {
    console.error("[chat] erro buscando mensagens:", error.message);
    return [];
  }
  return (data ?? []) as MessageRow[];
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { c: selectedId } = await searchParams;

  const [conversations, selected, allTags] = await Promise.all([
    getConversations(),
    selectedId ? getConversationById(selectedId) : Promise.resolve(null),
    getAllTags(),
  ]);

  const [messages, panelData, quickRepliesRes] = selected
    ? await Promise.all([
        getMessages(selected.id),
        getContactPanelData(selected.contact.id),
        supabase.from("quick_replies").select("*").order("shortcut", { ascending: true }),
      ])
    : [[], null, null];

  return (
    <div className="h-full flex bg-wa-bg overflow-hidden">
      <ConversationList initial={conversations} selectedId={selected?.id} allTags={allTags} />
      {selected ? (
        <ChatWindow
          conversation={selected}
          initialMessages={messages}
          panelData={panelData}
          quickReplies={quickRepliesRes?.data ?? []}
        />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
