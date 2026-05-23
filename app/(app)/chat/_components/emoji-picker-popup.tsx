"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";

// Carrega só no client (a lib usa window)
const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
});

export function EmojiPickerPopup({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      // Não fecha se clicou no botão de emoji (controlado pelo pai)
      const trigger = (target as HTMLElement)?.closest?.("[data-emoji-trigger]");
      if (trigger) return;
      onClose();
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-2 mb-2 z-50 shadow-2xl rounded-lg overflow-hidden"
    >
      <EmojiPicker
        onEmojiClick={(d) => onSelect(d.emoji)}
        theme={"dark" as never}
        width={340}
        height={420}
        searchPlaceholder="Buscar emoji…"
        previewConfig={{ showPreview: false }}
        skinTonesDisabled
      />
    </div>
  );
}
