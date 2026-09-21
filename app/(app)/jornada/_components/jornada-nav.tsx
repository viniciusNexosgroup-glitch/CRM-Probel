import Link from "next/link";
import { cn } from "@/lib/utils";

const ABAS = [
  { chave: "etapas", href: "/jornada", label: "Etapas" },
  { chave: "disparos", href: "/jornada/disparos", label: "Disparos ao Meta" },
  { chave: "pixel", href: "/jornada/pixel", label: "Pixel e token" },
] as const;

export function JornadaNav({ atual }: { atual: (typeof ABAS)[number]["chave"] }) {
  return (
    <nav className="flex items-center gap-1 border-b border-wa-border -mx-1 px-1 overflow-x-auto wa-scroll">
      {ABAS.map((a) => (
        <Link
          key={a.chave}
          href={a.href}
          className={cn(
            "px-3 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors",
            a.chave === atual
              ? "border-primary text-primary font-medium"
              : "border-transparent text-wa-textSecondary hover:text-wa-textPrimary"
          )}
          aria-current={a.chave === atual ? "page" : undefined}
        >
          {a.label}
        </Link>
      ))}
    </nav>
  );
}
