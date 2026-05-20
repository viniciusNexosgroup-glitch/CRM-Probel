"use client";

import { useState, useTransition, useRef, useEffect, KeyboardEvent } from "react";
import { toast } from "sonner";
import { Smile, Paperclip, SendHorizonal, Loader2, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { sendTextMessageAction } from "../actions";
import { QuickReplyPicker } from "./quick-reply-picker";
import { MediaPicker } from "./media-picker";
import { resolveTemplate, type TemplateContext } from "@/lib/format/template";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type QuickReplyRow = Database["public"]["Tables"]["quick_replies"]["Row"];
type MediaRow = Database["public"]["Tables"]["media_library"]["Row"];
type CategoryRow = Database["public"]["Tables"]["media_categories"]["Row"];

export function ComposeBar({
  conversationId,
  quickReplies = [],
  medias = [],
  mediaCategories = [],
  templateCtx,
}: {
  conversationId: string;
  quickReplies?: QuickReplyRow[];
  medias?: MediaRow[];
  mediaCategories?: CategoryRow[];
  templateCtx?: TemplateContext;
}) {
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [pickerSelectedIdx, setPickerSelectedIdx] = useState(0);
  const [manualOpen, setManualOpen] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const zapButtonRef = useRef<HTMLButtonElement>(null);

  // Picker abre por "/" no input OU por click no botão de raio
  const slashMatch = /^\/(\S*)$/.exec(text);
  const showFromSlash = !!slashMatch && quickReplies.length > 0;
  const showPicker = showFromSlash || manualOpen;
  const slashQuery = manualOpen ? "" : (slashMatch?.[1] ?? "");

  useEffect(() => {
    setPickerSelectedIdx(0);
  }, [slashQuery, manualOpen]);

  // Click fora fecha o picker manual
  useEffect(() => {
    if (!manualOpen) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      // Não fecha se clicou no botão de raio ou dentro do picker
      if (zapButtonRef.current?.contains(target)) return;
      const picker = document.querySelector("[data-quick-reply-picker]");
      if (picker?.contains(target)) return;
      setManualOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [manualOpen]);

  function sendNow(value: string) {
    if (!value || pending) return;
    setText("");
    setManualOpen(false);
    startTransition(async () => {
      const res = await sendTextMessageAction(conversationId, value);
      if (!res.ok) {
        toast.error("Falha ao enviar", { description: res.error });
        setText(value);
      }
      requestAnimationFrame(() => inputRef.current?.focus());
    });
  }

  function onSend() {
    sendNow(text.trim());
  }

  function selectQuickReply(r: QuickReplyRow, immediate = false) {
    const resolved = templateCtx ? resolveTemplate(r.content, templateCtx) : r.content;
    setManualOpen(false);

    if (immediate) {
      // Click direto no botão de raio → envia na hora
      sendNow(resolved);
      return;
    }

    // Veio por "/" digitado → coloca no input pra usuário revisar/editar antes de mandar
    setText(resolved);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const el = inputRef.current;
      if (el) el.setSelectionRange(resolved.length, resolved.length);
    });
  }

  function getFilteredReplies() {
    const q = slashQuery.toLowerCase();
    if (!q) return quickReplies.slice(0, 8);
    return quickReplies
      .filter(
        (r) =>
          r.shortcut.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          (r.category?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 8);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (showPicker) {
      const filtered = getFilteredReplies();
      const visible = filtered.length;

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
        if (manualOpen) {
          setManualOpen(false);
        } else {
          setText("");
        }
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
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
        <div data-quick-reply-picker>
          <QuickReplyPicker
            replies={quickReplies}
            query={slashQuery}
            onSelect={(r) => selectQuickReply(r, manualOpen)}
            onClose={() => {
              setManualOpen(false);
              setText("");
            }}
            selectedIndex={pickerSelectedIdx}
            onIndexChange={setPickerSelectedIdx}
            hint={
              manualOpen
                ? "Clique numa resposta para enviar"
                : "↑↓ navegar · Enter selecionar · Esc fechar"
            }
          />
        </div>
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
          onClick={() => setMediaPickerOpen(true)}
          disabled={medias.length === 0}
          className={cn(
            "p-2 rounded transition-colors",
            medias.length === 0
              ? "text-wa-textSecondary opacity-50 cursor-not-allowed"
              : "text-wa-textSecondary hover:bg-wa-hover hover:text-primary"
          )}
          aria-label="Enviar mídia"
          title={
            medias.length === 0
              ? "Nenhuma mídia cadastrada — vá em Mídias no menu"
              : "Enviar da biblioteca"
          }
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <button
          ref={zapButtonRef}
          onClick={() => setManualOpen((o) => !o)}
          disabled={quickReplies.length === 0}
          className={cn(
            "p-2 rounded transition-colors",
            manualOpen
              ? "bg-primary/20 text-primary"
              : "text-wa-textSecondary hover:bg-wa-hover hover:text-primary",
            quickReplies.length === 0 && "opacity-50 cursor-not-allowed"
          )}
          title={
            quickReplies.length === 0
              ? "Nenhuma resposta rápida cadastrada"
              : "Respostas rápidas"
          }
          aria-label="Respostas rápidas"
        >
          <Zap className="h-5 w-5" />
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
          onClick={onSend}
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

      <MediaPicker
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        conversationId={conversationId}
        medias={medias}
        categories={mediaCategories}
      />
    </footer>
  );
}
