"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { AlertTriangle, FileText, Loader2, Mic, SendHorizonal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { enviarArquivo, formatarTamanho, tipoDeEnvio } from "../_lib/enviar-arquivo";

type Progresso = { atual: number; total: number; fracao: number; fase: "subindo" | "whatsapp" };

/**
 * Tela de conferência antes de mandar arquivos ao cliente: fotos e vídeos da
 * galeria, documentos, o vídeo recém-gravado e a imagem colada com Ctrl+V.
 *
 * Mostra o que vai, aceita uma legenda e manda um por vez, na ordem escolhida.
 * Quem chamou é dono da lista; aqui só se tira o que já foi -- se algo falhar,
 * o arquivo fica na tela com o motivo, e o atendente tenta de novo sem
 * precisar escolher tudo outra vez.
 */
export function PreviaEnvio({
  conversationId,
  arquivos,
  setArquivos,
}: {
  conversationId: string;
  arquivos: File[];
  setArquivos: Dispatch<SetStateAction<File[]>>;
}) {
  const [legenda, setLegenda] = useState("");
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const [falhas, setFalhas] = useState<Map<File, string>>(new Map());
  const legendaRef = useRef<HTMLInputElement>(null);
  const urls = useRef(new Map<File, string>());
  const enviando = progresso !== null;

  function urlDe(arquivo: File): string {
    let url = urls.current.get(arquivo);
    if (!url) {
      url = URL.createObjectURL(arquivo);
      urls.current.set(arquivo, url);
    }
    return url;
  }

  // Solta da memória a prévia do que saiu da lista.
  useEffect(() => {
    for (const [arquivo, url] of urls.current) {
      if (!arquivos.includes(arquivo)) {
        URL.revokeObjectURL(url);
        urls.current.delete(arquivo);
      }
    }
  }, [arquivos]);

  useEffect(() => {
    const mapa = urls.current;
    return () => {
      for (const url of mapa.values()) URL.revokeObjectURL(url);
      mapa.clear();
    };
  }, []);

  // Fica montado o tempo todo (vazio, não desenha nada). Ao abrir, põe o
  // cursor na legenda -- só com mouse: no celular, abrir o teclado sozinho
  // cobriria a foto que o atendente quer conferir.
  const aberto = arquivos.length > 0;
  useEffect(() => {
    if (!aberto) {
      setLegenda("");
      setFalhas(new Map());
      return;
    }
    if (window.matchMedia("(pointer: fine)").matches) {
      requestAnimationFrame(() => legendaRef.current?.focus());
    }
  }, [aberto]);

  function fechar() {
    if (enviando) return;
    setArquivos([]);
  }

  function remover(arquivo: File) {
    setArquivos((lista) => lista.filter((a) => a !== arquivo));
  }

  async function enviar() {
    if (enviando || arquivos.length === 0) return;
    const fila = [...arquivos];
    const texto = legenda.trim();
    const erros = new Map<File, string>();
    setFalhas(new Map());

    for (let i = 0; i < fila.length; i++) {
      const arquivo = fila[i];
      setProgresso({ atual: i + 1, total: fila.length, fracao: 0, fase: "subindo" });
      const res = await enviarArquivo(conversationId, arquivo, {
        // Legenda vai no primeiro, como no WhatsApp.
        legenda: i === 0 ? texto : undefined,
        aoProgredir: (fracao) =>
          setProgresso({
            atual: i + 1,
            total: fila.length,
            fracao,
            fase: fracao >= 1 ? "whatsapp" : "subindo",
          }),
      });
      if (res.ok) {
        setArquivos((lista) => lista.filter((a) => a !== arquivo));
        if (i === 0) setLegenda("");
      } else {
        erros.set(arquivo, res.error);
      }
    }

    setProgresso(null);
    setFalhas(erros);
    const enviados = fila.length - erros.size;
    if (erros.size === 0) {
      toast.success(enviados === 1 ? "Enviado!" : `${enviados} arquivos enviados!`);
    } else {
      toast.error(
        erros.size === fila.length
          ? "Nada foi enviado"
          : `${enviados} de ${fila.length} enviados`,
        { description: "Os que falharam continuam na tela — toque em enviar para tentar de novo." }
      );
    }
  }

  if (!aberto) return null;

  const total = arquivos.reduce((s, a) => s + a.size, 0);
  const vaoComoArquivo = arquivos.some(
    (a) => a.type.startsWith("video/") && tipoDeEnvio(a) === "document"
  );
  const unico = arquivos.length === 1 ? arquivos[0] : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <header className="flex items-center justify-between gap-3 px-4 h-14 shrink-0">
        <button
          onClick={fechar}
          disabled={enviando}
          className="p-2 rounded-full text-white/80 hover:bg-white/10 disabled:opacity-40"
          aria-label="Descartar"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="text-sm text-white/70 truncate">
          {arquivos.length === 1 ? "1 arquivo" : `${arquivos.length} arquivos`} ·{" "}
          {formatarTamanho(total)}
        </span>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4">
        {unico ? (
          <div className="h-full flex flex-col items-center justify-center gap-2">
            <Previa arquivo={unico} url={urlDe(unico)} grande />
            {falhas.get(unico) && <Falha texto={falhas.get(unico)!} />}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 py-2">
            {arquivos.map((a) => (
              <div key={urlDe(a)} className="relative">
                <div
                  className={cn(
                    "aspect-square rounded-md overflow-hidden bg-white/5 flex items-center justify-center",
                    falhas.has(a) && "ring-2 ring-red-500"
                  )}
                >
                  <Previa arquivo={a} url={urlDe(a)} />
                </div>
                {!enviando && (
                  <button
                    onClick={() => remover(a)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white/90 hover:bg-black"
                    aria-label={`Tirar ${a.name} da lista`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                {falhas.get(a) && <Falha texto={falhas.get(a)!} compacta />}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 px-3 pt-2 space-y-2">
        {vaoComoArquivo && !enviando && (
          <p className="text-xs text-white/60 text-center">
            Vídeo acima de 16 MB vai como arquivo — o cliente toca nele para assistir.
          </p>
        )}
        {progresso && (
          <div className="space-y-1">
            <p className="text-xs text-white/70 text-center">
              {progresso.total > 1 ? `Enviando ${progresso.atual} de ${progresso.total} · ` : ""}
              {progresso.fase === "whatsapp"
                ? "entregando ao WhatsApp…"
                : `subindo ${Math.round(progresso.fracao * 100)}%`}
            </p>
            <div className="h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-primary transition-[width] duration-300"
                style={{ width: `${Math.round(progresso.fracao * 100)}%` }}
              />
            </div>
          </div>
        )}
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
          placeholder={arquivos.length > 1 ? "Legenda (vai na primeira)" : "Legenda (opcional)"}
          disabled={enviando}
          className="bg-wa-panel border-0 text-base h-11"
        />
        <button
          onClick={enviar}
          disabled={enviando}
          className="p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 shrink-0"
          aria-label="Enviar"
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

function Previa({ arquivo, url, grande = false }: { arquivo: File; url: string; grande?: boolean }) {
  if (arquivo.type.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={arquivo.name}
        className={grande ? "max-h-[65vh] max-w-full object-contain rounded-lg" : "w-full h-full object-cover"}
      />
    );
  }
  if (arquivo.type.startsWith("video/")) {
    return (
      <video
        // #t=0.1 faz o navegador desenhar o primeiro quadro em vez de um retângulo preto.
        src={grande ? url : `${url}#t=0.1`}
        controls={grande}
        muted={!grande}
        playsInline
        preload="metadata"
        className={grande ? "max-h-[65vh] max-w-full rounded-lg" : "w-full h-full object-cover"}
      />
    );
  }
  const Icone = arquivo.type.startsWith("audio/") ? Mic : FileText;
  return (
    <div className={cn("flex flex-col items-center gap-1 text-white/80 text-center", grande ? "p-6" : "p-2")}>
      <Icone className={grande ? "h-12 w-12" : "h-7 w-7"} />
      <p className={cn("break-all", grande ? "text-sm" : "text-[10px] line-clamp-2")}>{arquivo.name}</p>
      {grande && <p className="text-xs text-white/50">{formatarTamanho(arquivo.size)}</p>}
    </div>
  );
}

function Falha({ texto, compacta = false }: { texto: string; compacta?: boolean }) {
  return (
    <p
      className={cn(
        "flex items-start gap-1 text-red-300",
        compacta ? "text-[10px] mt-1 line-clamp-2" : "text-xs max-w-md text-center"
      )}
      title={texto}
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
      <span>{texto}</span>
    </p>
  );
}
