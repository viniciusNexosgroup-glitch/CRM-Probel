import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppRail } from "@/components/app-shell/app-rail";
import { TaskReminderManager } from "./_components/task-reminder-manager";

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
    <div className="h-screen flex bg-wa-bg overflow-hidden">
      <AppRail />
      <div className="flex-1 min-w-0 overflow-hidden">{children}</div>
      <TaskReminderManager />
    </div>
  );
}
