"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  MessageSquare,
  KanbanSquare,
  Settings,
  LogOut,
  Loader2,
  User,
  Zap,
  LayoutDashboard,
  Library,
  Clock,
  Users,
  Bot,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type NavItem = {
  href: string;
  label: string;
  icon: typeof MessageSquare;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/chat", label: "Conversas", icon: MessageSquare },
  { href: "/leads", label: "Funil", icon: KanbanSquare },
  { href: "/settings/pipeline", label: "Estágios", icon: TrendingUp },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/salesbot", label: "SalesBot", icon: Bot },
  { href: "/settings/quick-replies", label: "Respostas", icon: Zap },
  { href: "/settings/media-library", label: "M\u00eddias", icon: Library },
  { href: "/settings/business-hours", label: "Hor\u00e1rio", icon: Clock },
  { href: "/settings/team", label: "Equipe", icon: Users },
  { href: "/settings/whatsapp", label: "WhatsApp", icon: Settings },
];

export function AppRail() {
  const pathname = usePathname();
  const router = useRouter();
  const [logoutPending, setLogoutPending] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [hovered, setHovered] = useState(false);
  const isCompact = !hovered;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserEmail(user.email ?? "");
      const meta = user.user_metadata as { full_name?: string } | null;
      setUserName(meta?.full_name ?? user.email?.split("@")[0] ?? "");
    });
  }, []);

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  async function onLogout() {
    if (logoutPending) return;
    setLogoutPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    setLogoutPending(false);
    if (error) {
      toast.error("Falha ao sair", { description: error.message });
      return;
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <nav
      className={cn(
        "shrink-0 bg-wa-header border-r border-wa-border flex flex-col transition-[width] duration-200 ease-out",
        isCompact ? "w-16" : "w-56"
      )}
      aria-label="Navega\u00e7\u00e3o principal"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={cn(
          "h-16 flex items-center gap-3 border-b border-wa-border",
          isCompact ? "justify-center px-2" : "px-4"
        )}
      >
        <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <div className={cn("min-w-0", isCompact && "hidden")}>
          <p className="font-semibold text-wa-textPrimary text-sm">CRM Probel</p>
          <p className="text-[10px] text-wa-textSecondary truncate">
            {"Colch\u00f5es Probel"}
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-0.5 p-2 overflow-y-auto wa-scroll">
        <p
          className={cn(
            "text-[10px] uppercase tracking-wider text-wa-textTertiary px-3 py-2",
            isCompact && "sr-only"
          )}
        >
          Menu
        </p>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCompact ? item.label : undefined}
              className={cn(
                "relative flex items-center rounded-md text-sm transition-colors",
                isCompact ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                active
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-wa-textSecondary hover:bg-wa-hover hover:text-wa-textPrimary"
              )}
              aria-label={isCompact ? item.label : undefined}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-r-full bg-primary" />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              <span className={cn(isCompact && "hidden")}>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="border-t border-wa-border p-2">
        <div
          className={cn(
            "flex items-center rounded-md bg-wa-bg/40",
            isCompact ? "justify-center px-2 py-2" : "gap-2.5 px-3 py-2"
          )}
          title={isCompact ? userName || userEmail || "Usu\u00e1rio" : undefined}
        >
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className={cn("min-w-0 flex-1", isCompact && "hidden")}>
            <p className="text-xs font-medium text-wa-textPrimary truncate">
              {userName || "Usu\u00e1rio"}
            </p>
            <p className="text-[10px] text-wa-textSecondary truncate">{userEmail}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          disabled={logoutPending}
          className={cn(
            "mt-1 w-full flex items-center rounded-md text-sm text-wa-textSecondary hover:bg-wa-hover hover:text-red-400 transition-colors disabled:opacity-50",
            isCompact ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2"
          )}
          aria-label="Sair"
          title={isCompact ? "Sair" : undefined}
        >
          {logoutPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          <span className={cn(isCompact && "hidden")}>Sair</span>
        </button>
      </div>
    </nav>
  );
}
