"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { X, SendHorizonal, Loader2, Mic, Pause, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { sendAudioMessageAction } from "../actions";

type Mode = "idle" | "recording" | "preview" | "sending";

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function AudioRecorder({
  conversationId,
  onClose,
}: {
  conversationId: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const [duration, setDuration] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const blobRef = useRef<Blob | null>(null);

  // Inicia gravação automaticamente ao montar
  useEffect(() => {
    startRecording();
    return () => {
      cleanupStream();
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanupStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Tenta usar opus (compatível com WhatsApp PTT após conversão da Evolution)
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
          ? "audio/ogg;codecs=opus"
          : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        cleanupStream();
        setMode("preview");
      };

      recorder.start();
      setMode("recording");
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (e) {
      toast.error("Não foi possível acessar o microfone", {
        description: e instanceof Error ? e.message : String(e),
      });
      onClose();
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }

  function cancelAll() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      // Limpa chunks pra não usar
      chunksRef.current = [];
      recorderRef.current.onstop = null as never;
      recorderRef.current.stop();
    }
    cleanupStream();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onClose();
  }

  async function send() {
    if (!blobRef.current) return;
    setMode("sending");

    const supabase = createClient();
    const ext = blobRef.current.type.includes("ogg") ? "ogg" : "webm";
    const path = `audio/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("contact-media")
      .upload(path, blobRef.current, {
        contentType: blobRef.current.type,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadErr) {
      toast.error("Falha ao subir áudio", { description: uploadErr.message });
      setMode("preview");
      return;
    }

    const res = await sendAudioMessageAction(conversationId, path, duration);
    if (!res.ok) {
      toast.error("Falha ao enviar", { description: res.error });
      setMode("preview");
      // Tenta limpar o arquivo do storage já que não enviamos
      await supabase.storage.from("contact-media").remove([path]);
      return;
    }

    toast.success("Áudio enviado!");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onClose();
  }

  function togglePreview() {
    const el = audioElRef.current;
    if (!el || !previewUrl) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play();
      setPlaying(true);
    }
  }

  return (
    <div className="flex items-center gap-3 w-full">
      <button
        onClick={cancelAll}
        disabled={mode === "sending"}
        className="p-2 rounded-full text-wa-textSecondary hover:bg-wa-hover hover:text-red-400 transition-colors"
        title="Cancelar"
        aria-label="Cancelar gravação"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex-1 flex items-center gap-3 px-3 py-2 rounded-md bg-wa-bg/40">
        {mode === "recording" && (
          <>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span className="text-sm text-wa-textPrimary font-mono tabular-nums">
              {formatDuration(duration)}
            </span>
            <span className="text-xs text-wa-textSecondary">Gravando…</span>
          </>
        )}
        {mode === "preview" && previewUrl && (
          <>
            <button
              onClick={togglePreview}
              className="p-1.5 rounded-full bg-primary/20 hover:bg-primary/30 text-primary"
              aria-label={playing ? "Pausar" : "Tocar"}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <span className="text-sm text-wa-textPrimary font-mono tabular-nums">
              {formatDuration(duration)}
            </span>
            <span className="text-xs text-wa-textSecondary">Pré-escuta</span>
            <audio
              ref={audioElRef}
              src={previewUrl}
              onEnded={() => setPlaying(false)}
              className="hidden"
            />
          </>
        )}
        {mode === "sending" && (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-wa-textSecondary">Enviando…</span>
          </>
        )}
      </div>

      <button
        onClick={mode === "recording" ? stopRecording : send}
        disabled={mode === "sending"}
        className={cn(
          "p-2 rounded-full transition-colors",
          mode === "recording"
            ? "bg-amber-500 text-black hover:bg-amber-400"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
        title={mode === "recording" ? "Parar gravação" : "Enviar"}
        aria-label={mode === "recording" ? "Parar" : "Enviar"}
      >
        {mode === "recording" ? (
          <Mic className="h-5 w-5" />
        ) : (
          <SendHorizonal className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}
