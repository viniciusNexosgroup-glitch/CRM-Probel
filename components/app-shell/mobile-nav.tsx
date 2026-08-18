"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MoreHorizontal, X, LogOut, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { NAV_ITEMS, isNavActive } from "./nav-items";

/**
 * Navegação do mobile: barra fixa embaixo (alcance do polegar) com os destinos
 * principais + um menu "Mais" para o resto. Substitui a barra lateral, que abre
 * por hover e por isso fica inutilizável no toque.
 *
 * Some quando uma conversa está aberta no celular — ali a tela é do chat inteiro
 * e a barra de digitar ocupa a base (mesmo padrão do WhatsApp).
 */
export function MobileNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [logoutPending, setLogoutPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserEmail(user.email ?? "");
      const meta = user.user_metadata as { full_name?: string } | null;
      setUserName(meta?.full_name ?? user.email?.split("@")[0] ?? "");
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      setIsAdmin(profile?.role === "admin");
    });
  }, []);

  // Fecha o menu ao navegar
  useEffect(() => setOpen(false), [pathname, searchParams]);

  // Trava o scroll do fundo enquanto o menu está aberto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const items = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin);
  const primary = items.filter((i) => i.primary);
  const rest = items.filter((i) => !i.primary);

  // No chat com conversa aberta, a tela é toda do chat.
  const conversaAberta = pathname.startsWith("/chat") && Boolean(searchParams.get("c"));
  if (conversaAberta) return null;

  const moreAtivo = rest.some((i) => isNavActive(i, pathname));

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
    <>
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <button
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          />
          <div className="relative bg-wa-panel border-t border-wa-border rounded-t-2xl max-h-[80dvh] flex flex-col pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between px-4 h-14 border-b border-wa-border shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-wa-textPrimary truncate">
                    {userName || "Usuário"}
                  </span>
                  <span className="block text-[11px] text-wa-textSecondary truncate">
                    {userEmail}
                  </span>
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2.5 -mr-2 rounded-full text-wa-textSecondary hover:bg-wa-hover"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto wa-scroll p-2 grid grid-cols-2 gap-1 content-start">
              {rest.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(item, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 min-h-[52px] text-sm transition-colors",
                      active
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-wa-textSecondary active:bg-wa-hover"
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-2 border-t border-wa-border shrink-0">
              <button
                onClick={onLogout}
                disabled={logoutPending}
                className="w-full flex items-center justify-center gap-2 rounded-lg min-h-[48px] text-sm text-red-400 active:bg-red-500/10 disabled:opacity-50"
              >
                {logoutPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      <nav
        className="md:hidden shrink-0 bg-wa-header border-t border-wa-border flex items-stretch pb-[env(safe-area-inset-bottom)]"
        aria-label="Navegação principal"
      >
        {primary.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 min-h-[56px] text-[11px] transition-colors",
                active ? "text-primary font-medium" : "text-wa-textSecondary active:bg-wa-hover"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "flex-1 flex flex-col items-center justify-center gap-1 min-h-[56px] text-[11px] transition-colors",
            moreAtivo ? "text-primary font-medium" : "text-wa-textSecondary active:bg-wa-hover"
          )}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <MoreHorizontal className="h-5 w-5" />
          Mais
        </button>
      </nav>
    </>
  );
}
