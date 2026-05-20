"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  KanbanSquare,
  Settings,
  LogOut,
  Loader2,
  User,
  Zap,
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
  { href: "/settings/quick-replies", label: "Respostas", icon: Zap },
  { href: "/settings/whatsapp", label: "WhatsApp", icon: Settings },
];

export function AppRail() {
  const pathname = usePathname();
  const router = useRouter();
  const [logoutPending, setLogoutPending] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");

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
    <nav className="w-56 shrink-0 bg-wa-header border-r border-wa-border flex flex-col">
      {/* Logo + nome */}
      <div className="h-16 px-4 flex items-center gap-3 border-b border-wa-border">
        <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-wa-textPrimary text-sm">CRM Probel</p>
          <p className="text-[10px] text-wa-textSecondary truncate">
            Colchões Probel
          </p>
        </div>
      </div>

      {/* Navegação */}
      <div className="flex-1 flex flex-col gap-0.5 p-2 overflow-y-auto wa-scroll">
        <p className="text-[10px] uppercase tracking-wider text-wa-textTertiary px-3 py-2">
          Menu
        </p>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                active
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-wa-textSecondary hover:bg-wa-hover hover:text-wa-textPrimary"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-r-full bg-primary" />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* User + Logout */}
      <div className="border-t border-wa-border p-2">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-wa-bg/40">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-wa-textPrimary truncate">
              {userName || "Usuário"}
            </p>
            <p className="text-[10px] text-wa-textSecondary truncate">{userEmail}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          disabled={logoutPending}
          className="mt-1 w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-wa-textSecondary hover:bg-wa-hover hover:text-red-400 transition-colors disabled:opacity-50"
        >
          {logoutPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          <span>Sair</span>
        </button>
      </div>
    </nav>
  );
}
