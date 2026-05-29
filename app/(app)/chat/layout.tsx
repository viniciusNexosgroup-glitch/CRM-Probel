import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConversationList } from "./_components/conversation-list";
import type { ConversationWithContact } from "./types";

export const dynamic = "force-dynamic";

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
  return (data ?? []) as unknown as ConversationWithContact[];
}

async function getAllTags() {
  const supabase = await createClient();
  const { data } = await supabase.from("tags").select("*").order("name", { ascending: true });
  return data ?? [];
}

/**
 * Layout do chat: a lista de conversas vive aqui (não na page) pra NÃO ser
 * re-buscada a cada troca de conversa (mudança do ?c=). O Next mantém o layout
 * montado entre navegações; só a page (painel da conversa) recarrega.
 */
export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [conversations, allTags] = await Promise.all([getConversations(), getAllTags()]);

  return (
    <div className="h-full flex bg-wa-bg overflow-hidden">
      <ConversationList initial={conversations} allTags={allTags} currentUserId={user.id} />
      {children}
    </div>
  );
}
