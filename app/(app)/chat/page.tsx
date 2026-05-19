import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConversationList } from "./_components/conversation-list";
import { ChatWindow } from "./_components/chat-window";
import { EmptyState } from "./_components/empty-state";
import type { ConversationWithContact, MessageRow } from "./types";

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
        id, name, push_name, phone, profile_pic_url, is_group, whatsapp_id
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

async function getConversationById(id: string): Promise<ConversationWithContact | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select(
      `
      *,
      contact:contacts!conversations_contact_id_fkey (
        id, name, push_name, phone, profile_pic_url, is_group, whatsapp_id
      )
    `
    )
    .eq("id", id)
    .single();
  if (error) return null;
  return data as unknown as ConversationWithContact;
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

  const [conversations, selected] = await Promise.all([
    getConversations(),
    selectedId ? getConversationById(selectedId) : Promise.resolve(null),
  ]);

  const messages = selected ? await getMessages(selected.id) : [];

  return (
    <div className="h-full flex bg-wa-bg overflow-hidden">
      <ConversationList initial={conversations} selectedId={selected?.id} />
      {selected ? <ChatWindow conversation={selected} initialMessages={messages} /> : <EmptyState />}
    </div>
  );
}
