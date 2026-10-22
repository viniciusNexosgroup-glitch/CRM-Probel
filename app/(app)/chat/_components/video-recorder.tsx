"use client";

import { useRef } from "react";
import { Camera } from "lucide-react";

/**
 * Botão de câmera do celular: grava um vídeo para mandar ao cliente.
 *
 * Usa `capture` num input de arquivo, que abre o app de câmera do próprio
 * celular, em vez de gravar pela página com MediaRecorder. O aparelho cuida de
 * codec, orientação e compressão — três coisas que, feitas no navegador, saem
 * diferentes em cada celular e costumam gerar vídeo que o WhatsApp recusa.
 *
 * O vídeo gravado vai para a tela de conferência (PreviaEnvio), que cuida do
 * tamanho: acima de 16 MB ele segue como arquivo.
 *
 * No desktop não aparece: lá o caminho é o clipe de anexar.
 */
export function VideoRecorder({ onVideo }: { onVideo: (video: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        capture="environment"
        onChange={(e) => {
          const f = e.target.files?.[0];
          // Permite escolher o mesmo arquivo de novo depois de cancelar.
          e.target.value = "";
          if (f) onVideo(f);
        }}
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
    </>
  );
}
