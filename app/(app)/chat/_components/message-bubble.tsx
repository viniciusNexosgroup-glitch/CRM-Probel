"use client";

import { Check, CheckCheck, Clock, AlertTriangle, FileText, Mic, Image as ImageIcon, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format/date";
import type { MessageRow } from "../types";

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

function MediaPlaceholder({ type, caption, filename, duration }: { type: MessageRow["message_type"]; caption?: string | null; filename?: string | null; duration?: number | null }) {
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

export function MessageBubble({ msg }: { msg: MessageRow }) {
  const fromMe = msg.from_me;
  const isMedia = msg.message_type !== "text" && msg.message_type !== "reaction";

  return (
    <div className={cn("flex w-full", fromMe ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] md:max-w-[65%] rounded-lg px-2.5 py-1.5 text-sm shadow-sm",
          fromMe ? "bg-wa-bubbleOut text-wa-textPrimary" : "bg-wa-bubbleIn text-wa-textPrimary"
        )}
      >
        {isMedia ? (
          <MediaPlaceholder
            type={msg.message_type}
            caption={msg.media_caption ?? msg.content}
            filename={msg.media_filename}
            duration={msg.duration}
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
    </div>
  );
}
