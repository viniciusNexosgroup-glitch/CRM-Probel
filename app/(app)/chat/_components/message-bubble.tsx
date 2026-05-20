"use client";

import { Check, CheckCheck, Clock, AlertTriangle, FileText, Mic, Image as ImageIcon, Video, Reply } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format/date";
import type { MessageRow } from "../types";

/** True se a URL é nossa (Supabase Storage) — sem expiração. */
function isStableUrl(url: string | null): boolean {
  if (!url) return false;
  return url.includes(".supabase.co/storage/") || url.includes("supabase.in/storage/");
}

function StatusIcon({ status }: { status: MessageRow["status"] }) {
  switch (status) {
    case "read":
      return <CheckCheck className="h-3.5 w-3.5 text-sky-400" />;
    case "delivered":
      return <CheckCheck className="h-3.5 w-3.5 text-wa-textSecondary" />;
    case "sent":
      return <Check className="h-3.5 w-3.5 text-wa-textSecondary" />;
    case "pending":
      return <Clock className="h-3.5 w-3.5 text-wa-textSecondary" />;
    case "failed":
      return <AlertTriangle className="h-3.5 w-3.5 text-red-400" />;
    default:
      return null;
  }
}

function MediaPlaceholder({
  type,
  caption,
  filename,
  duration,
  mediaUrl,
}: {
  type: MessageRow["message_type"];
  caption?: string | null;
  filename?: string | null;
  duration?: number | null;
  mediaUrl?: string | null;
}) {
  // Renderiza inline se for imagem com URL estável (Supabase Storage)
  if (type === "image" && mediaUrl && isStableUrl(mediaUrl)) {
    return (
      <div className="space-y-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaUrl}
          alt={caption ?? "Imagem"}
          className="rounded-md max-w-full max-h-80 object-cover cursor-pointer"
          onClick={() => window.open(mediaUrl, "_blank")}
        />
        {caption && <p className="text-sm whitespace-pre-wrap break-words">{caption}</p>}
      </div>
    );
  }

  // Vídeo com URL estável: player
  if (type === "video" && mediaUrl && isStableUrl(mediaUrl)) {
    return (
      <div className="space-y-1">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video src={mediaUrl} controls className="rounded-md max-w-full max-h-80" />
        {caption && <p className="text-sm whitespace-pre-wrap break-words">{caption}</p>}
      </div>
    );
  }

  // Documento com URL estável: link de download
  if (type === "document" && mediaUrl && isStableUrl(mediaUrl)) {
    return (
      <a
        href={mediaUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 px-2 py-1.5 rounded bg-black/20 hover:bg-black/30 transition-colors"
      >
        <FileText className="h-5 w-5 opacity-70" />
        <div className="text-sm min-w-0">
          <p className="font-medium truncate">{filename ?? caption ?? "Documento"}</p>
          <p className="text-xs opacity-70">Clique para abrir</p>
        </div>
      </a>
    );
  }

  // Fallback: placeholder
  const Icon =
    type === "image" ? ImageIcon : type === "video" ? Video : type === "audio" ? Mic : FileText;
  const label =
    type === "image"
      ? "Imagem"
      : type === "video"
        ? `Vídeo${duration ? ` · ${duration}s` : ""}`
        : type === "audio"
          ? `Áudio${duration ? ` · ${duration}s` : ""}`
          : type === "sticker"
            ? "Figurinha"
            : filename ?? "Documento";

  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <Icon className="h-5 w-5 opacity-70" />
      <div className="text-sm">
        <p className="font-medium">{label}</p>
        {caption && <p className="text-xs opacity-80 mt-0.5">{caption}</p>}
      </div>
    </div>
  );
}

function previewOf(msg: MessageRow): string {
  if (msg.content) return msg.content;
  if (msg.media_caption) return msg.media_caption;
  switch (msg.message_type) {
    case "image":
      return "📷 Imagem";
    case "video":
      return "🎥 Vídeo";
    case "audio":
      return "🎵 Áudio";
    case "document":
      return msg.media_filename ?? "📄 Documento";
    case "sticker":
      return "🏷️ Figurinha";
    default:
      return "Mensagem";
  }
}

export function MessageBubble({
  msg,
  quotedMessage,
  onReply,
}: {
  msg: MessageRow;
  quotedMessage?: MessageRow | null;
  onReply?: (msg: MessageRow) => void;
}) {
  const fromMe = msg.from_me;
  const isMedia = msg.message_type !== "text" && msg.message_type !== "reaction";

  return (
    <div
      className={cn(
        "group flex w-full items-center gap-2",
        fromMe ? "justify-end" : "justify-start"
      )}
    >
      {/* Botão de reply à esquerda em msgs from_me, à direita em recebidas */}
      {!fromMe && onReply && (
        <button
          onClick={() => onReply(msg)}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full bg-wa-panel hover:bg-wa-hover text-wa-textSecondary transition-opacity"
          title="Responder"
          aria-label="Responder"
        >
          <Reply className="h-3.5 w-3.5" />
        </button>
      )}
      <div
        className={cn(
          "max-w-[75%] md:max-w-[65%] rounded-lg px-2.5 py-1.5 text-sm shadow-sm order-2",
          fromMe ? "bg-wa-bubbleOut text-wa-textPrimary" : "bg-wa-bubbleIn text-wa-textPrimary"
        )}
      >
        {quotedMessage && (
          <div
            className={cn(
              "mb-1.5 px-2 py-1 rounded border-l-2 text-xs",
              quotedMessage.from_me
                ? "bg-black/15 border-emerald-400 text-wa-textSecondary"
                : "bg-black/15 border-sky-400 text-wa-textSecondary"
            )}
          >
            <p
              className={cn(
                "text-[10px] font-medium",
                quotedMessage.from_me ? "text-emerald-400" : "text-sky-400"
              )}
            >
              {quotedMessage.from_me ? "Você" : "Cliente"}
            </p>
            <p className="truncate">{previewOf(quotedMessage)}</p>
          </div>
        )}
        {isMedia ? (
          <MediaPlaceholder
            type={msg.message_type}
            caption={msg.media_caption ?? msg.content}
            filename={msg.media_filename}
            duration={msg.duration}
            mediaUrl={msg.media_url}
          />
        ) : (
          <p className="whitespace-pre-wrap break-words pr-12">
            {msg.content ?? <span className="opacity-60">(mensagem sem conteúdo)</span>}
          </p>
        )}
        <div className="float-right flex items-center gap-1 -mb-0.5 ml-2 mt-0.5">
          <span className="text-[10px] text-wa-textSecondary">{formatTime(msg.timestamp)}</span>
          {fromMe && <StatusIcon status={msg.status} />}
        </div>
      </div>
      {fromMe && onReply && (
        <button
          onClick={() => onReply(msg)}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full bg-wa-panel hover:bg-wa-hover text-wa-textSecondary transition-opacity order-3"
          title="Responder"
          aria-label="Responder"
        >
          <Reply className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
