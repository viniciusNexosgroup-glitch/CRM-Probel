"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ClipboardPaste, Loader2, SendHorizonal, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { acaoSegura } from "@/lib/ui/acao-segura";
import { sendUploadedMediaAction } from "../actions";

/** Teto do WhatsApp para mídia. Acima disso o envio falha na ponta. */
const LIMITE_BYTES = 16 * 1024 * 1024;

const EXTENSAO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function formatarTamanho(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Cola imagem direto na conversa, como no WhatsApp Business.
 *
 * O atendente dá Ctrl+C num print, num anúncio ou numa foto de produto e
 * Ctrl+V aqui — sem salvar no computador antes, sem procurar a pasta depois.
 *
 * O ouvinte fica na janela, não no campo de texto: quem copia uma imagem e
 * cola raramente clica no campo antes, e exigir isso faria a função parecer
 * quebrada. Colar texto continua normal — só imagem é interceptada.
 */
export function ImagemColada({ conversationId }: { conversationId: string }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [legenda, setLegenda] = useState("");
  const [enviando, setEnviando] = useState(false);
  const legendaRef = useRef<HTMLInputElement>(null);

  const aoColar = useCallback((e: ClipboardEvent) => {
    const dados = e.clipboardData;
    if (!dados) return;

    const imagens = Array.from(dados.files).filter((f) => f.type.startsWith("image/"));
    if (imagens.length === 0) return; // texto ou outro conteúdo: deixa passar

    e.preventDefault();

    if (imagens.length > 1) {
      toast.info(`${imagens.length} imagens copiadas — envio a primeira`, {
        description: "Cole as outras uma a uma.",
      });
    }

    const img = imagens[0];
    if (img.size > LIMITE_BYTES) {
      toast.error("Imagem muito grande", {
        description: `${formatarTamanho(img.size)} — o WhatsApp aceita até 16 MB.`,
      });
      return;
    }

    setArquivo(img);
    setPreviewUrl(URL.createObjectURL(img));
    setLegenda("");
  }, []);

  useEffect(() => {
    window.addEventListener("paste", aoColar);
    return () => window.removeEventListener("paste", aoColar);
  }, [aoColar]);

  // Trocar de conversa com uma imagem pendente enviaria a foto para o cliente
  // errado. Descarta.
  useEffect(() => {
    setArquivo(null);
    setPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    setLegenda("");
  }, [conversationId]);

  useEffect(() => {
    if (previewUrl) requestAnimationFrame(() => legendaRef.current?.focus());
  }, [previewUrl]);

  function fechar() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setArquivo(null);
    setLegenda("");
  }

  async function enviar() {
    if (!arquivo || enviando) return;
    setEnviando(true);

    const supabase = createClient();
    const ext = EXTENSAO[arquivo.type] ?? arquivo.type.split("/")[1] ?? "png";
    const caminho = `adhoc/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    let erroUpload: { message: string } | null = null;
    try {
      const r = await supabase.storage.from("contact-media").upload(caminho, arquivo, {
        contentType: arquivo.type,
        cacheControl: "31536000",
        upsert: false,
      });
      erroUpload = r.error;
    } catch (e) {
      erroUpload = { message: e instanceof Error ? e.message : String(e) };
    }

    if (erroUpload) {
      toast.error("Falha ao subir a imagem", {
        description: `${erroUpload.message} — a imagem continua aqui, tente de novo.`,
      });
      setEnviando(false);
      return;
    }

    const { data: pub } = supabase.storage.from("contact-media").getPublicUrl(caminho);

    const res = await acaoSegura(() =>
      sendUploadedMediaAction(conversationId, {
        fileUrl: pub.publicUrl,
        fileType: "image",
        mimetype: arquivo.type,
        fileName: arquivo.name || `imagem.${ext}`,
        caption: legenda.trim() || undefined,
      })
    );

    if (!res.ok) {
      toast.error("Falha ao enviar", { description: res.error });
      try {
        await supabase.storage.from("contact-media").remove([caminho]);
      } catch {
        /* arquivo órfão: o aviso de falha já foi dado */
      }
      setEnviando(false);
      return;
    }

    toast.success("Imagem enviada!");
    setEnviando(false);
    fechar();
  }

  if (!previewUrl) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <header className="flex items-center justify-between px-4 h-14 shrink-0">
        <button
          onClick={fechar}
          disabled={enviando}
          className="p-2 rounded-full text-white/80 hover:bg-white/10 disabled:opacity-40"
          aria-label="Descartar imagem"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="text-sm text-white/70 flex items-center gap-2">
          <ClipboardPaste className="h-4 w-4" />
          {arquivo ? formatarTamanho(arquivo.size) : ""}
        </span>
      </header>

      <div className="flex-1 min-h-0 flex items-center justify-center px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="Imagem colada, pronta para enviar"
          className="max-h-full max-w-full object-contain rounded-lg"
        />
      </div>

      <div className="shrink-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-2">
        <Input
          ref={legendaRef}
          value={legenda}
          onChange={(e) => setLegenda(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
            if (e.key === "Escape") fechar();
          }}
          placeholder="Legenda (opcional) — Enter envia"
          disabled={enviando}
          className="bg-wa-panel border-0 text-base h-11"
        />
        <button
          onClick={enviar}
          disabled={enviando}
          className="p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 shrink-0"
          aria-label="Enviar imagem"
        >
          {enviando ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <SendHorizonal className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}
