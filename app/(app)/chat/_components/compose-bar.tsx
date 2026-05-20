"use client";

import { useState, useTransition, useRef, useEffect, KeyboardEvent } from "react";
import { toast } from "sonner";
import { Smile, Paperclip, SendHorizonal, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { sendTextMessageAction } from "../actions";
import { QuickReplyPicker } from "./quick-reply-picker";
import { resolveTemplate, type TemplateContext } from "@/lib/format/template";
import type { Database } from "@/types/database";

type QuickReplyRow = Database["public"]["Tables"]["quick_replies"]["Row"];

export function ComposeBar({
  conversationId,
  quickReplies = [],
  templateCtx,
}: {
  conversationId: string;
  quickReplies?: QuickReplyRow[];
  templateCtx?: TemplateContext;
}) {
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [pickerSelectedIdx, setPickerSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Detecta se está digitando uma quick reply: texto começa com / e não tem espaço ainda
  const slashMatch = /^\/(\S*)$/.exec(text);
  const showPicker = !!slashMatch && quickReplies.length > 0;
  const slashQuery = slashMatch?.[1] ?? "";

  useEffect(() => {
    setPickerSelectedIdx(0);
  }, [slashQuery]);

  function onSend(overrideText?: string) {
    const value = (overrideText ?? text).trim();
    if (!value || pending) return;

    setText("");
    startTransition(async () => {
      const res = await sendTextMessageAction(conversationId, value);
      if (!res.ok) {
        toast.error("Falha ao enviar", { description: res.error });
        setText(value);
      }
      requestAnimationFrame(() => inputRef.current?.focus());
    });
  }

  function selectQuickReply(r: QuickReplyRow) {
    const resolved = templateCtx ? resolveTemplate(r.content, templateCtx) : r.content;
    setText(resolved);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      // Move cursor pro final
      const el = inputRef.current;
      if (el) el.setSelectionRange(resolved.length, resolved.length);
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (showPicker) {
      const filteredCount = quickReplies.filter((r) => {
        const q = slashQuery.toLowerCase();
        if (!q) return true;
        return (
          r.shortcut.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          (r.category?.toLowerCase().includes(q) ?? false)
        );
      }).length;
      const visible = Math.min(filteredCount, 8);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPickerSelectedIdx((i) => (visible > 0 ? (i + 1) % visible : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setPickerSelectedIdx((i) => (visible > 0 ? (i - 1 + visible) % visible : 0));
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setText("");
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        const filtered = quickReplies
          .filter((r) => {
            const q = slashQuery.toLowerCase();
            if (!q) return true;
            return (
              r.shortcut.toLowerCase().includes(q) ||
              r.title.toLowerCase().includes(q) ||
              (r.category?.toLowerCase().includes(q) ?? false)
            );
          })
          .slice(0, 8);
        const chosen = filtered[pickerSelectedIdx];
        if (chosen) {
          e.preventDefault();
          selectQuickReply(chosen);
          return;
        }
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <footer className="bg-wa-header px-3 py-2 border-l border-wa-border shrink-0 relative">
      {showPicker && (
        <QuickReplyPicker
          replies={quickReplies}
          query={slashQuery}
          onSelect={selectQuickReply}
          onClose={() => setText("")}
          selectedIndex={pickerSelectedIdx}
          onIndexChange={setPickerSelectedIdx}
        />
      )}
      <div className="flex items-center gap-2">
        <button
          className="p-2 text-wa-textSecondary cursor-not-allowed opacity-50"
          disabled
          aria-label="Emoji (em breve)"
          title="Em breve"
        >
          <Smile className="h-5 w-5" />
        </button>
        <button
          className="p-2 text-wa-textSecondary cursor-not-allowed opacity-50"
          disabled
          aria-label="Anexar (em breve)"
          title="Em breve"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            quickReplies.length > 0
              ? "Digite uma mensagem ou / para usar uma resposta rápida…"
              : "Digite uma mensagem"
          }
          disabled={pending}
          className="bg-wa-panel border-0 text-sm h-10"
          autoFocus
        />
        <Button
          onClick={() => onSend()}
          disabled={!text.trim() || pending}
          size="icon"
          variant="ghost"
          aria-label="Enviar"
        >
          {pending ? (
            <Loader2 className="animate-spin h-5 w-5" />
          ) : (
            <SendHorizonal className="h-5 w-5 text-wa-textSecondary" />
          )}
        </Button>
      </div>
    </footer>
  );
}
