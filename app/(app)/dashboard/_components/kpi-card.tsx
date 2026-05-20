import { cn } from "@/lib/utils";

export function KpiCard({
  icon,
  label,
  value,
  helper,
  accent = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  helper?: string;
  accent?: "default" | "success" | "warning" | "danger";
}) {
  const accentClass =
    accent === "success"
      ? "text-emerald-400"
      : accent === "warning"
        ? "text-amber-400"
        : accent === "danger"
          ? "text-red-400"
          : "text-wa-textPrimary";

  return (
    <div className="rounded-lg border border-wa-border bg-wa-panel p-4 space-y-2">
      <div className="flex items-center justify-between text-xs text-wa-textSecondary">
        <span className="uppercase tracking-wider">{label}</span>
        <span className="text-wa-textTertiary">{icon}</span>
      </div>
      <div className={cn("text-2xl font-semibold tabular-nums", accentClass)}>
        {value}
      </div>
      {helper && <p className="text-[11px] text-wa-textTertiary">{helper}</p>}
    </div>
  );
}
