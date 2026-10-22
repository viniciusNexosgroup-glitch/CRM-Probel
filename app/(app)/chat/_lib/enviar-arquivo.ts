import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/client";
import { acaoSegura, type ResultadoAcao } from "@/lib/ui/acao-segura";
import { sendUploadedMediaAction } from "../actions";

const MB = 1024 * 1024;
const BALDE = "contact-media";

/**
 * Teto do WhatsApp para foto, vídeo e áudio. Acima disso o arquivo vai como
 * documento -- é o que o próprio WhatsApp faz: o vídeo de 46 MB que um cliente
 * mandou chegou aqui como documento. O cliente toca no arquivo e assiste.
 */
export const LIMITE_MIDIA = 16 * MB;

/** Teto do CRM. Tem que bater com o `file_size_limit` do balde (migração 0035). */
export const LIMITE_ARQUIVO = 100 * MB;

/**
 * Arquivo maior que isso sobe em partes. O servidor corta qualquer requisição
 * que passe de 60 s, e um vídeo de 40 MB no 4G passa disso numa tacada só; em
 * partes, cada uma leva poucos segundos e, se a rede cair, retoma de onde
 * parou. 6 MB é o tamanho de parte que o Storage do Supabase exige.
 */
const PARTE = 6 * MB;

const EXTENSAO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/3gpp": "3gp",
  "video/webm": "webm",
  "application/pdf": "pdf",
};

export type TipoEnvio = "image" | "video" | "audio" | "document";

export function formatarTamanho(bytes: number): string {
  return bytes < MB ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / MB).toFixed(1)} MB`;
}

/**
 * Como o arquivo vai para o WhatsApp.
 *
 * Vídeo só vai como vídeo se for MP4: é o formato que todo celular toca dentro
 * da conversa. Um .mov ou .webm enviado como vídeo chega, mas pode não abrir
 * -- como documento, o celular do cliente escolhe o player.
 */
export function tipoDeEnvio(arquivo: File): TipoEnvio {
  const mime = arquivo.type;
  if (arquivo.size > LIMITE_MIDIA) return "document";
  if (mime.startsWith("image/")) return "image";
  if (mime === "video/mp4") return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

/**
 * Nome do arquivo como o cliente vai ver, sempre com extensão: a Evolution
 * descobre o tipo pela extensão, e sem ela o arquivo chega sem formato.
 */
function nomeDoArquivo(arquivo: File): string {
  const nome = arquivo.name?.trim() || "arquivo";
  if (/\.[a-z0-9]{2,5}$/i.test(nome)) return nome;
  const ext = EXTENSAO[arquivo.type] ?? arquivo.type.split("/")[1]?.split(/[+;]/)[0];
  return ext ? `${nome}.${ext}` : nome;
}

function mensagemDoTus(erro: Error): string {
  const corpo = (erro as tus.DetailedError).originalResponse?.getBody();
  if (corpo) {
    try {
      const json = JSON.parse(corpo) as { message?: string; error?: string };
      if (json.message || json.error) return (json.message || json.error) as string;
    } catch {
      /* corpo não é JSON: cai na mensagem genérica */
    }
  }
  return "a conexão caiu no meio do envio";
}

async function subir(
  arquivo: File,
  caminho: string,
  aoProgredir?: (fracao: number) => void
): Promise<void> {
  const supabase = createClient();
  const contentType = arquivo.type || "application/octet-stream";

  if (arquivo.size <= PARTE) {
    const { error } = await supabase.storage.from(BALDE).upload(caminho, arquivo, {
      contentType,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) throw new Error(error.message);
    aoProgredir?.(1);
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("sessão expirada — entre de novo");

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(arquivo, {
      endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: PARTE,
      metadata: {
        bucketName: BALDE,
        objectName: caminho,
        contentType,
        cacheControl: "31536000",
      },
      onProgress: (enviados, total) => aoProgredir?.(total ? enviados / total : 0),
      onSuccess: () => resolve(),
      onError: (e) => reject(new Error(mensagemDoTus(e))),
    });
    upload.start();
  });
}

/**
 * Sobe o arquivo e manda para o cliente da conversa.
 *
 * Se o WhatsApp recusar, apaga o que subiu: o arquivo não chegou ao cliente e
 * só ocuparia espaço.
 */
export async function enviarArquivo(
  conversationId: string,
  arquivo: File,
  opcoes: { legenda?: string; aoProgredir?: (fracao: number) => void } = {}
): Promise<ResultadoAcao> {
  if (arquivo.size > LIMITE_ARQUIVO) {
    return {
      ok: false,
      error: `${formatarTamanho(arquivo.size)} — o limite é ${LIMITE_ARQUIVO / MB} MB.`,
    };
  }

  const tipo = tipoDeEnvio(arquivo);
  const nome = nomeDoArquivo(arquivo);
  const seguro = nome.replace(/[^a-zA-Z0-9._-]/g, "_");
  const caminho = `adhoc/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${seguro}`;

  try {
    await subir(arquivo, caminho, opcoes.aoProgredir);
  } catch (e) {
    return { ok: false, error: `Falha ao subir: ${e instanceof Error ? e.message : String(e)}` };
  }

  const supabase = createClient();
  const { data: pub } = supabase.storage.from(BALDE).getPublicUrl(caminho);

  const res = await acaoSegura(() =>
    sendUploadedMediaAction(conversationId, {
      fileUrl: pub.publicUrl,
      fileType: tipo,
      mimetype: arquivo.type || "application/octet-stream",
      fileName: nome,
      caption: opcoes.legenda?.trim() || undefined,
    })
  );

  if (!res.ok) {
    // Se a própria limpeza falhar, sobra um arquivo órfão -- o menor dos males.
    try {
      await supabase.storage.from(BALDE).remove([caminho]);
    } catch {
      /* o aviso de falha já vai para o atendente */
    }
  }
  return res;
}
