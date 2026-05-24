"use client";

import { useState, useTransition, useRef, useEffect, KeyboardEvent } from "react";
import { toast } from "sonner";
import { Smile, Paperclip, SendHorizonal, Loader2, Zap, Reply, X, Mic, StickyNote, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { sendTextMessageAction, createInternalNoteAction } from "../actions";
import { QuickReplyPicker } from "./quick-reply-picker";
import { MediaPopup } from "./media-popup";
import { AudioRecorder } from "./audio-recorder";
import { EmojiPickerPopup } from "./emoji-picker-popup";
import { ScheduleDialog } from "./schedule-dialog";
import { resolveTemplate, type TemplateContext } from "@/lib/format/template";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";
import type { MessageRow } from "../types";

type QuickReplyRow = Database["public"]["Tables"]["quick_replies"]["Row"];
type MediaRow = Database["public"]["Tables"]["media_library"]["Row"];
type CategoryRow = Database["public"]["Tables"]["media_categories"]["Row"];

function previewOfMsg(m: MessageRow): string {
  if (m.content) return m.content;
  if (m.media_caption) return m.media_caption;
  if (m.message_type === "image") return "📷 Imagem";
  if (m.message_type === "video") return "🎥 Vídeo";
  if (m.message_type === "audio") return "🎵 Áudio";
  if (m.message_type === "document") return m.media_filename ?? "📄 Documento";
  return "Mensagem";
}

export function ComposeBar({
  conversationId,
  quickReplies = [],
  medias = [],
  mediaCategories = [],
  replyingTo = null,
  onCancelReply,
  templateCtx,
}: {
  conversationId: string;
  quickReplies?: QuickReplyRow[];
  medias?: MediaRow[];
  mediaCategories?: CategoryRow[];
  replyingTo?: MessageRow | null;
  onCancelReply?: () => void;
  templateCtx?: TemplateContext;
}) {
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [pickerSelectedIdx, setPickerSelectedIdx] = useState(0);
  const [manualOpen, setManualOpen] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [internalMode, setInternalMode] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const zapButtonRef = useRef<HTMLButtonElement>(null);

  function insertAtCursor(snippet: string) {
    const el = inputRef.current;
    if (!el) {
      setText((t) => t + snippet);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + snippet + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  }

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
    const wasInternal = internalMode;
    const replyToCapture = replyingTo?.id ?? null;
    onCancelReply?.();
    startTransition(async () => {
      const res = wasInternal
        ? await createInternalNoteAction(conversationId, value)
        : await sendTextMessageAction(conversationId, value, replyToCapture);
      if (!res.ok) {
        toast.error(wasInternal ? "Falha ao salvar nota" : "Falha ao enviar", {
          description: res.error,
        });
        setText(value);
      } else if (wasInternal) {
        toast.success("Nota interna salva");
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

  if (recordingAudio) {
    return (
      <footer className="bg-wa-header px-3 py-2 border-l border-wa-border shrink-0">
        <AudioRecorder
          conversationId={conversationId}
          onClose={() => setRecordingAudio(false)}
        />
      </footer>
    );
  }

  return (
    <footer className="bg-wa-header px-3 py-2 border-l border-wa-border shrink-0 relative">
      {replyingTo && (
        <div className="mb-2 px-3 py-2 rounded-md bg-wa-bg/60 border-l-4 border-primary flex items-start gap-2">
          <Reply className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-primary font-medium">
              Respondendo {replyingTo.from_me ? "você" : "cliente"}
            </p>
            <p className="text-xs text-wa-textSecondary truncate">
              {previewOfMsg(replyingTo)}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 text-wa-textSecondary hover:text-wa-textPrimary shrink-0"
            aria-label="Cancelar resposta"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
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
      <ScheduleDialog
        conversationId={conversationId}
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        initialText={text}
      />
      {mediaPickerOpen && (
        <MediaPopup
          conversationId={conversationId}
          medias={medias}
          categories={mediaCategories}
          onClose={() => setMediaPickerOpen(false)}
        />
      )}
      <div className="flex items-center gap-2">
        {emojiOpen && (
          <EmojiPickerPopup
            onSelect={(emoji) => insertAtCursor(emoji)}
            onClose={() => setEmojiOpen(false)}
          />
        )}
        <button
          data-emoji-trigger
          onClick={() => setEmojiOpen((o) => !o)}
          className={cn(
            "p-2 rounded transition-colors",
            emojiOpen
              ? "bg-primary/20 text-primary"
              : "text-wa-textSecondary hover:bg-wa-hover hover:text-primary"
          )}
          title="Emoji"
          aria-label="Emoji"
        >
          <Smile className="h-5 w-5" />
        </button>
        <button
          data-media-trigger
          onClick={() => setMediaPickerOpen((o) => !o)}
          disabled={medias.length === 0}
          className={cn(
            "p-2 rounded transition-colors",
            mediaPickerOpen
              ? "bg-primary/20 text-primary"
              : "text-wa-textSecondary hover:bg-wa-hover hover:text-primary",
            medias.length === 0 && "opacity-50 cursor-not-allowed"
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
        <button
          onClick={() => setInternalMode((v) => !v)}
          className={cn(
            "p-2 rounded transition-colors",
            internalMode
              ? "bg-amber-500/20 text-amber-400"
              : "text-wa-textSecondary hover:bg-wa-hover hover:text-amber-400"
          )}
          title={internalMode ? "Voltar pra mensagem normal" : "Nota interna (não vai pro cliente)"}
          aria-label="Alternar nota interna"
        >
          <StickyNote className="h-5 w-5" />
        </button>
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            internalMode
              ? "Nota interna (só atendentes veem)…"
              : quickReplies.length > 0
                ? "Digite uma mensagem ou / para usar uma resposta rápida…"
                : "Digite uma mensagem"
          }
          disabled={pending}
          className={cn(
            "border-0 text-sm h-10",
            internalMode ? "bg-amber-500/10 text-amber-100 placeholder:text-amber-300/60" : "bg-wa-panel"
          )}
          autoFocus
        />
        {text.trim() ? (
          <>
            {!internalMode && (
              <button
                onClick={() => setScheduleOpen(true)}
                className="p-2 rounded text-wa-textSecondary hover:bg-wa-hover hover:text-amber-400 transition-colors"
                title="Agendar envio"
                aria-label="Agendar"
              >
                <Calendar className="h-5 w-5" />
              </button>
            )}
            <Button
              onClick={onSend}
              disabled={pending}
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
          </>
        ) : (
          <button
            onClick={() => setRecordingAudio(true)}
            className="p-2 rounded text-wa-textSecondary hover:bg-wa-hover hover:text-primary transition-colors"
            title="Gravar áudio"
            aria-label="Gravar áudio"
          >
            <Mic className="h-5 w-5" />
          </button>
        )}
      </div>

    </footer>
  );
}
