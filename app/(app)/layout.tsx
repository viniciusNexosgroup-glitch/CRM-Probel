import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCachedUser } from "@/lib/auth/current-user";
import { AppRail } from "@/components/app-shell/app-rail";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { TaskReminderManager } from "./_components/task-reminder-manager";
import { MentionNotifier } from "./_components/mention-notifier";
import { OverdueTasksBanner } from "./chat/_components/overdue-tasks-banner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCachedUser();
  if (!user) redirect("/login");

  return (
    // h-dvh (e não h-screen/100vh): no celular a barra do navegador entra e sai,
    // e com 100vh o rodapé fica escondido atrás dela.
    <div className="h-dvh flex flex-col bg-wa-bg overflow-hidden">
      <OverdueTasksBanner currentUserId={user.id} />
      <div className="flex-1 flex min-w-0 overflow-hidden">
        <AppRail />
        <div className="flex-1 min-w-0 overflow-hidden">{children}</div>
      </div>
      <Suspense fallback={null}>
        <MobileNav />
      </Suspense>
      <TaskReminderManager />
      <MentionNotifier currentUserId={user.id} />
    </div>
  );
}
