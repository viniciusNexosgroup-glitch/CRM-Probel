"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import {
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

type FileType = "image" | "video" | "audio" | "document";

function FallbackIcon({ type, className }: { type: FileType; className?: string }) {
  if (type === "image") return <ImageIcon className={className} />;
  if (type === "video") return <VideoIcon className={className} />;
  if (type === "audio") return <Music className={className} />;
  return <FileText className={className} />;
}

/**
 * Renderiza preview real para imagem/vídeo quando possível.
 * Vídeo: pega o primeiro frame em 0.1s.
 * Falha (CORS, URL morta) → cai no ícone placeholder.
 */
export function MediaThumb({
  fileType,
  fileUrl,
  alt,
  iconSize = "h-7 w-7",
}: {
  fileType: FileType;
  fileUrl: string;
  alt: string;
  iconSize?: string;
}) {
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  if (failed || fileType === "audio" || fileType === "document") {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-wa-textTertiary">
        <FallbackIcon type={fileType} className={iconSize} />
      </div>
    );
  }

  if (fileType === "image") {
    return (
      <Image
        src={fileUrl}
        alt={alt}
        fill
        unoptimized
        className="object-cover"
        onError={() => setFailed(true)}
      />
    );
  }

  // Video: vai mostrar o primeiro frame
  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={fileUrl}
        preload="metadata"
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        onLoadedMetadata={() => {
          // Força o frame em 0.1s pra aparecer thumbnail (em vez de tela preta)
          if (videoRef.current && videoRef.current.currentTime === 0) {
            try {
              videoRef.current.currentTime = 0.1;
            } catch {
              /* alguns browsers/codecs não permitem seek; mantém tela preta */
            }
          }
        }}
        onError={() => setFailed(true)}
      />
      {/* Overlay com ícone de play centralizado */}
      <div className={cn(
        "absolute inset-0 flex items-center justify-center pointer-events-none",
      )}>
        <div className="bg-black/50 rounded-full p-2">
          <VideoIcon className="h-4 w-4 text-white" />
        </div>
      </div>
    </>
  );
}
