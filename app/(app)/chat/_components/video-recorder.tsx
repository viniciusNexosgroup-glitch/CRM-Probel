"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, SendHorizonal, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { sendUploadedMediaAction } from "../actions";

/**
 * Limite do WhatsApp para vídeo. Acima disso o envio falha lá na ponta, depois
 * de o atendente já ter esperado o upload inteiro — melhor barrar antes.
 */
const LIMITE_BYTES = 16 * 1024 * 1024;

function formatarTamanho(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Botão de câmera do celular: grava um vídeo e manda pro cliente.
 *
 * Usa `capture` num input de arquivo, que abre o app de câmera do próprio
 * celular, em vez de gravar pela página com MediaRecorder. O aparelho cuida de
 * codec, orientação e compressão — três coisas que, feitas no navegador, saem
 * diferentes em cada celular e costumam gerar vídeo que o WhatsApp recusa.
 *
 * No desktop não aparece: lá o caminho é a biblioteca de mídias.
 */
export function VideoRecorder({ conversationId }: { conversationId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [legenda, setLegenda] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    // Permite escolher o mesmo arquivo de novo depois de cancelar.
    e.target.value = "";
    if (!f) return;

    if (f.size > LIMITE_BYTES) {
      toast.error("Vídeo muito grande", {
        description: `${formatarTamanho(f.size)} — o WhatsApp aceita até 16 MB. Grave um trecho mais curto.`,
      });
      return;
    }

    setArquivo(f);
    setPreviewUrl(URL.createObjectURL(f));
    setLegenda("");
  }

  function fechar() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setArquivo(null);
    setLegenda("");
  }

  async function enviar() {
    if (!arquivo) return;
    setEnviando(true);

    const supabase = createClient();
    const ext = arquivo.name.split(".").pop()?.toLowerCase() || "mp4";
    const path = `video/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    const { error: erroUpload } = await supabase.storage
      .from("contact-media")
      .upload(path, arquivo, {
        contentType: arquivo.type || "video/mp4",
        cacheControl: "31536000",
        upsert: false,
      });

    if (erroUpload) {
      toast.error("Falha ao subir o vídeo", { description: erroUpload.message });
      setEnviando(false);
      return;
    }

    const { data: pub } = supabase.storage.from("contact-media").getPublicUrl(path);

    const res = await sendUploadedMediaAction(conversationId, {
      fileUrl: pub.publicUrl,
      fileType: "video",
      mimetype: arquivo.type || "video/mp4",
      fileName: arquivo.name || `video.${ext}`,
      caption: legenda.trim() || undefined,
    });

    if (!res.ok) {
      toast.error("Falha ao enviar", { description: res.error });
      // Não deixa lixo no storage: o vídeo não chegou ao cliente.
      await supabase.storage.from("contact-media").remove([path]);
      setEnviando(false);
      return;
    }

    toast.success("Vídeo enviado!");
    setEnviando(false);
    fechar();
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        capture="environment"
        onChange={aoEscolher}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="md:hidden p-2 rounded text-wa-textSecondary hover:bg-wa-hover hover:text-primary transition-colors shrink-0"
        title="Gravar vídeo"
        aria-label="Gravar vídeo com a câmera"
      >
        <Camera className="h-5 w-5" />
      </button>

      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
          <header className="flex items-center justify-between px-4 h-14 shrink-0">
            <button
              onClick={fechar}
              disabled={enviando}
              className="p-2 rounded-full text-white/80 hover:bg-white/10 disabled:opacity-40"
              aria-label="Descartar vídeo"
            >
              <X className="h-5 w-5" />
            </button>
            <span className="text-sm text-white/70">
              {arquivo ? formatarTamanho(arquivo.size) : ""}
            </span>
          </header>

          <div className="flex-1 min-h-0 flex items-center justify-center px-4">
            <video
              src={previewUrl}
              controls
              playsInline
              className="max-h-full max-w-full rounded-lg"
            />
          </div>

          <div className="shrink-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-2">
            <Input
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              placeholder="Legenda (opcional)"
              disabled={enviando}
              className="bg-wa-panel border-0 text-base h-11"
            />
            <button
              onClick={enviar}
              disabled={enviando}
              className="p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 shrink-0"
              aria-label="Enviar vídeo"
            >
              {enviando ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <SendHorizonal className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
