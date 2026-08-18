import {
  MessageSquare,
  KanbanSquare,
  Settings,
  Zap,
  LayoutDashboard,
  Library,
  Clock,
  Users,
  Bot,
  TrendingUp,
  ScrollText,
  Tag,
  Bell,
  ShieldCheck,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof MessageSquare;
  exact?: boolean;
  adminOnly?: boolean;
  /** Aparece na barra inferior do mobile (as demais vão pro menu "Mais"). */
  primary?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/chat", label: "Conversas", icon: MessageSquare, primary: true },
  { href: "/leads", label: "Funil", icon: KanbanSquare, primary: true },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, primary: true },
  { href: "/settings/pipeline", label: "Estágios", icon: TrendingUp },
  { href: "/salesbot", label: "SalesBot", icon: Bot },
  { href: "/settings/quick-replies", label: "Respostas", icon: Zap },
  { href: "/settings/media-library", label: "Mídias", icon: Library },
  { href: "/settings/business-hours", label: "Horário", icon: Clock },
  { href: "/settings/tags", label: "Etiquetas", icon: Tag },
  { href: "/settings/notifications", label: "Notificações", icon: Bell },
  { href: "/settings/security", label: "Segurança", icon: ShieldCheck },
  { href: "/settings/team", label: "Equipe", icon: Users },
  { href: "/settings/audit", label: "Atividade", icon: ScrollText, adminOnly: true },
  { href: "/settings/whatsapp", label: "WhatsApp", icon: Settings },
];

export function isNavActive(item: NavItem, pathname: string) {
  if (item.exact) return pathname === item.href;
  return pathname.startsWith(item.href);
}
