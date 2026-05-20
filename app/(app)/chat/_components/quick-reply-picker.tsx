"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Database } from "@/types/database";

type QuickReplyRow = Database["public"]["Tables"]["quick_replies"]["Row"];

export function QuickReplyPicker({
  replies,
  query,
  onSelect,
  onClose,
  selectedIndex,
  onIndexChange,
}: {
  replies: QuickReplyRow[];
  query: string; // o que vem depois do /
  onSelect: (r: QuickReplyRow) => void;
  onClose: () => void;
  selectedIndex: number;
  onIndexChange: (i: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return replies.slice(0, 8);
    return replies
      .filter(
        (r) =>
          r.shortcut.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          (r.category?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 8);
  }, [replies, query]);

  // Reset selection quando filtro muda
  useEffect(() => {
    if (selectedIndex >= filtered.length) onIndexChange(0);
  }, [filtered.length, selectedIndex, onIndexChange]);

  // Scroll do item selecionado pra área visível
  useEffect(() => {
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-idx="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (filtered.length === 0) {
    return (
      <div className="absolute bottom-full left-0 right-0 mb-2 mx-3 bg-wa-panel border border-wa-border rounded-lg shadow-lg p-3 text-center text-xs text-wa-textSecondary">
        Nenhuma resposta encontrada com <code>/{query}</code>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-2 mx-3 bg-wa-panel border border-wa-border rounded-lg shadow-lg max-h-64 overflow-y-auto wa-scroll"
    >
      <div className="px-3 py-2 border-b border-wa-border text-[10px] uppercase tracking-wider text-wa-textTertiary flex justify-between">
        <span>Respostas rápidas</span>
        <span>↑↓ navegar · Enter selecionar · Esc fechar</span>
      </div>
      <ul>
        {filtered.map((r, i) => {
          const active = i === selectedIndex;
          return (
            <li
              key={r.id}
              data-idx={i}
              onMouseEnter={() => onIndexChange(i)}
              onClick={() => onSelect(r)}
              className={`px-3 py-2 cursor-pointer flex items-start gap-2 ${active ? "bg-wa-active" : "hover:bg-wa-hover"}`}
            >
              <code className="text-[11px] bg-primary/20 text-primary px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                {r.shortcut}
              </code>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-wa-textPrimary font-medium">{r.title}</p>
                <p className="text-xs text-wa-textSecondary line-clamp-1 mt-0.5">
                  {r.content}
                </p>
              </div>
              {r.category && (
                <span className="text-[10px] text-wa-textTertiary shrink-0 mt-1">
                  {r.category}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
