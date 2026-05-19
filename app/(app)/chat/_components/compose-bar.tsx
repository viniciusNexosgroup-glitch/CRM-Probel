"use client";

import { useState, useTransition, useRef, KeyboardEvent } from "react";
import { toast } from "sonner";
import { Smile, Paperclip, SendHorizonal, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { sendTextMessageAction } from "../actions";

export function ComposeBar({ conversationId }: { conversationId: string }) {
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function onSend() {
    const value = text.trim();
    if (!value || pending) return;

    // Optimistic clear: limpa o input imediatamente pra dar sensação de "enviou"
    setText("");
    startTransition(async () => {
      const res = await sendTextMessageAction(conversationId, value);
      if (!res.ok) {
        toast.error("Falha ao enviar", { description: res.error });
        setText(value); // restaura
      }
      // Re-foca pra continuar digitando
      requestAnimationFrame(() => inputRef.current?.focus());
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <footer className="bg-wa-header px-3 py-2 border-l border-wa-border shrink-0">
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
          placeholder="Digite uma mensagem"
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
    </footer>
  );
}
