"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload, Link as LinkIcon, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { createMediaAction, EXTERNAL_PREFIX, normalizeExternalUrl } from "../actions";
import type { Database } from "@/types/database";

type Category = Database["public"]["Tables"]["media_categories"]["Row"];
type FileType = "image" | "video" | "audio" | "document";

const MAX_SIZE_MB = 50;

function inferFileType(mime: string): FileType {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

function inferTypeFromUrl(url: string): FileType {
  const lower = url.toLowerCase();
  if (/\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/.test(lower)) return "image";
  if (/\.(mp4|webm|mov|avi|mkv|m4v)(\?|$)/.test(lower)) return "video";
  if (/\.(mp3|wav|ogg|m4a|aac)(\?|$)/.test(lower)) return "audio";
  return "document";
}

export function UploadDialog({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"url" | "upload">("url");

  // Comum
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string>("");

  // Upload
  const [file, setFile] = useState<File | null>(null);

  // URL
  const [externalUrl, setExternalUrl] = useState("");
  const [externalType, setExternalType] = useState<FileType>("image");

  function reset() {
    setMode("url");
    setTitle("");
    setDescription("");
    setCategoryId("");
    setFile(null);
    setExternalUrl("");
    setExternalType("image");
    setSaving(false);
    setProgress("");
  }

  function onFileChange(f: File | null) {
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  function onUrlChange(v: string) {
    setExternalUrl(v);
    if (v.trim()) {
      setExternalType(inferTypeFromUrl(v));
    }
  }

  async function onSave() {
    if (!title.trim()) {
      toast.error("Informe um título");
      return;
    }

    if (mode === "url") {
      if (!externalUrl.trim()) {
        toast.error("Cole a URL do arquivo");
        return;
      }
      try {
        new URL(externalUrl);
      } catch {
        toast.error("URL inválida");
        return;
      }

      setSaving(true);
      setProgress("Salvando…");
      const normalizedUrl = normalizeExternalUrl(externalUrl.trim());
      const res = await createMediaAction({
        title,
        description: description.trim() || null,
        category_id: categoryId || null,
        file_url: normalizedUrl,
        file_path: `${EXTERNAL_PREFIX}${Date.now()}`, // marker, não usado como path real
        file_type: externalType,
        mimetype: null,
        file_size: null,
      });
      setSaving(false);
      setProgress("");

      if (!res.ok) {
        toast.error("Falha ao salvar", { description: res.error });
        return;
      }
      toast.success("Mídia cadastrada (URL externa)");
      reset();
      onClose();
      router.refresh();
      return;
    }

    // Modo upload
    if (!file) {
      toast.error("Selecione um arquivo");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Arquivo muito grande (max ${MAX_SIZE_MB}MB)`);
      return;
    }

    setSaving(true);
    setProgress("Enviando arquivo…");

    const supabase = createClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;

    const { error: uploadErr } = await supabase.storage
      .from("media-library")
      .upload(path, file, {
        contentType: file.type || "application/octet-stream",
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadErr) {
      toast.error("Falha no upload", { description: uploadErr.message });
      setSaving(false);
      setProgress("");
      return;
    }

    const { data: publicData } = supabase.storage
      .from("media-library")
      .getPublicUrl(path);

    setProgress("Salvando no banco…");
    const fileType = inferFileType(file.type);
    const res = await createMediaAction({
      title,
      description: description.trim() || null,
      category_id: categoryId || null,
      file_url: publicData.publicUrl,
      file_path: path,
      file_type: fileType,
      mimetype: file.type || null,
      file_size: file.size,
    });

    setSaving(false);
    setProgress("");

    if (!res.ok) {
      toast.error("Falha ao salvar", { description: res.error });
      await supabase.storage.from("media-library").remove([path]);
      return;
    }

    toast.success("Mídia cadastrada");
    reset();
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !saving) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova mídia</DialogTitle>
          <DialogDescription>
            URL externa não consome storage. Use Google Drive, Dropbox, seu CDN ou link
            direto de imagem/vídeo.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-wa-bg/40 rounded-md">
          <button
            type="button"
            onClick={() => setMode("url")}
            disabled={saving}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-2 py-1.5 rounded text-sm transition-colors",
              mode === "url"
                ? "bg-primary/15 text-primary font-medium"
                : "text-wa-textSecondary hover:bg-wa-hover"
            )}
          >
            <LinkIcon className="h-4 w-4" />
            URL externa
          </button>
          <button
            type="button"
            onClick={() => setMode("upload")}
            disabled={saving}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-2 py-1.5 rounded text-sm transition-colors",
              mode === "upload"
                ? "bg-primary/15 text-primary font-medium"
                : "text-wa-textSecondary hover:bg-wa-hover"
            )}
          >
            <Upload className="h-4 w-4" />
            Upload no Supabase
          </button>
        </div>

        <div className="space-y-3">
          {mode === "url" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="ml-url">URL pública *</Label>
                <Input
                  id="ml-url"
                  type="url"
                  value={externalUrl}
                  onChange={(e) => onUrlChange(e.target.value)}
                  placeholder="https://drive.google.com/file/d/.../view"
                  disabled={saving}
                />
                <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                  <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>
                    Funciona com Google Drive, Dropbox, YouTube embed, ou qualquer URL
                    pública. Conversão automática pra Google Drive e Dropbox.
                  </span>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ml-type">Tipo</Label>
                <Select
                  id="ml-type"
                  value={externalType}
                  onChange={(e) => setExternalType(e.target.value as FileType)}
                  disabled={saving}
                >
                  <option value="image">Imagem</option>
                  <option value="video">Vídeo</option>
                  <option value="audio">Áudio</option>
                  <option value="document">Documento</option>
                </Select>
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="ml-file">Arquivo (max {MAX_SIZE_MB}MB) *</Label>
              <Input
                id="ml-file"
                type="file"
                onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                disabled={saving}
                className="cursor-pointer"
              />
              {file && (
                <p className="text-[11px] text-muted-foreground">
                  {file.name} · {(file.size / 1024).toFixed(0)} KB · {file.type || "?"}
                </p>
              )}
              <p className="text-[11px] text-amber-400 flex items-start gap-1">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>
                  Consome storage do Supabase (limite 1GB no plano Free). Pra vídeos
                  prefira URL externa.
                </span>
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ml-title">Título *</Label>
            <Input
              id="ml-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Vídeo apresentação colchão king"
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ml-cat">Categoria</Label>
            <Select
              id="ml-cat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={saving}
            >
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ml-desc">Descrição</Label>
            <Textarea
              id="ml-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Pra quê serve essa mídia?"
              disabled={saving}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving || !title.trim()}>
            {saving ? (
              <Loader2 className="animate-spin h-4 w-4" />
            ) : mode === "url" ? (
              <LinkIcon className="h-4 w-4" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {saving ? progress || "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
