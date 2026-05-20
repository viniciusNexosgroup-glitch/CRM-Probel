"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { createMediaAction } from "../actions";
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
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>("");

  function reset() {
    setFile(null);
    setTitle("");
    setDescription("");
    setCategoryId("");
    setUploading(false);
    setProgress("");
  }

  function onFileChange(f: File | null) {
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  async function onUpload() {
    if (!file) {
      toast.error("Selecione um arquivo");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Arquivo muito grande (max ${MAX_SIZE_MB}MB)`);
      return;
    }
    if (!title.trim()) {
      toast.error("Informe um título");
      return;
    }

    setUploading(true);
    setProgress("Enviando arquivo…");

    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "bin";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;

    const { error: uploadErr } = await supabase.storage
      .from("media-library")
      .upload(path, file, {
        contentType: file.type || `application/${ext}`,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadErr) {
      toast.error("Falha no upload", { description: uploadErr.message });
      setUploading(false);
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

    setUploading(false);
    setProgress("");

    if (!res.ok) {
      toast.error("Falha ao salvar", { description: res.error });
      // Tenta limpar o arquivo do storage
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
        if (!o && !uploading) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova mídia</DialogTitle>
          <DialogDescription>
            Imagem, vídeo, áudio ou documento até {MAX_SIZE_MB}MB.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ml-file">Arquivo *</Label>
            <Input
              id="ml-file"
              type="file"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
              disabled={uploading}
              className="cursor-pointer"
            />
            {file && (
              <p className="text-[11px] text-muted-foreground">
                {file.name} · {(file.size / 1024).toFixed(0)} KB · {file.type || "?"}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ml-title">Título *</Label>
            <Input
              id="ml-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Vídeo apresentação colchão king"
              disabled={uploading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ml-cat">Categoria</Label>
            <Select
              id="ml-cat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={uploading}
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
              disabled={uploading}
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
            disabled={uploading}
          >
            Cancelar
          </Button>
          <Button onClick={onUpload} disabled={uploading || !file || !title.trim()}>
            {uploading ? <Loader2 className="animate-spin h-4 w-4" /> : <Upload className="h-4 w-4" />}
            {uploading ? progress || "Enviando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
