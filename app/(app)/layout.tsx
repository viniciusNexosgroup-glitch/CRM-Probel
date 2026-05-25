import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppRail } from "@/components/app-shell/app-rail";
import { TaskReminderManager } from "./_components/task-reminder-manager";
import { MentionNotifier } from "./_components/mention-notifier";
import { OverdueTasksBanner } from "./chat/_components/overdue-tasks-banner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="h-screen flex flex-col bg-wa-bg overflow-hidden">
      <OverdueTasksBanner currentUserId={user.id} />
      <div className="flex-1 flex min-w-0 overflow-hidden">
        <AppRail />
        <div className="flex-1 min-w-0 overflow-hidden">{children}</div>
      </div>
      <TaskReminderManager />
      <MentionNotifier currentUserId={user.id} />
    </div>
  );
}
