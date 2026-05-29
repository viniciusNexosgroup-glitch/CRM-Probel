import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
        id, name, push_name, phone, profile_pic_url, is_group, is_favorite, whatsapp_id,
        leads:leads_contact_id_fkey (
          id,
          lead_tags ( tag:tags(*) )
        )
      ),
      assigned_user:profiles!conversations_assigned_to_fkey (
        id, full_name, email, avatar_url
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

  const activityRes = lead
    ? await supabase
        .from("lead_activity")
        .select(`*, user:profiles!lead_activity_user_id_fkey(full_name, email)`)
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(30)
    : { data: [] };

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { c: selectedId } = await searchParams;

  const selected = selectedId ? await getConversationById(selectedId) : null;

  if (!selected) return <EmptyState />;

  const [messages, panelData, quickRepliesRes, mediasRes, mediaCatsRes, internalNotes, allProfiles] =
    await Promise.all([
      getMessages(selected.id),
      getContactPanelData(selected.contact.id),
      supabase.from("quick_replies").select("*").order("shortcut", { ascending: true }),
      supabase.from("media_library").select("*").order("created_at", { ascending: false }),
      supabase.from("media_categories").select("*").order("position", { ascending: true }),
      getInternalNotes(selected.id),
      getAllProfiles(),
    ]);

  return (
    <ChatWindow
      conversation={selected}
      initialMessages={messages}
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
