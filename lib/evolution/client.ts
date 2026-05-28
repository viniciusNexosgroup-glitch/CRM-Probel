/**
 * Wrapper minimalista da Evolution API v2.3.7.
 * Toda chamada usa header `apikey`. Sempre server-side.
 */
import type {
  EvolutionInstance,
  EvolutionConnectionStateResponse,
  EvolutionQrResponse,
  EvolutionWebhookConfig,
  EvolutionSendTextResponse,
  EvolutionSendMediaPayload,
  EvolutionSendMediaResponse,
  EvolutionMediaType,
} from "./types";

/**
 * Converte JID do WhatsApp pro formato aceito pelo endpoint /message/sendText.
 * - Individuais: "5534...@s.whatsapp.net" → "5534..."
 * - Grupos: "abc-123@g.us" → mantém igual
 */
function jidToNumber(jid: string): string {
  if (jid.endsWith("@g.us")) return jid;
  return jid.replace(/@s\.whatsapp\.net$/, "").replace(/@c\.us$/, "");
}

export class EvolutionError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "EvolutionError";
  }
}

function getConfig() {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME;
  if (!baseUrl || !apiKey || !instanceName) {
    throw new EvolutionError(
      "EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE_NAME devem estar definidos no .env.local",
      500
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, instanceName };
}

async function evoFetch<T>(
  path: string,
  init?: RequestInit & { searchParams?: Record<string, string> }
): Promise<T> {
  const { baseUrl, apiKey } = getConfig();
  const url = new URL(`${baseUrl}${path}`);
  if (init?.searchParams) {
    for (const [k, v] of Object.entries(init.searchParams)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* não-JSON → mantém texto */
  }

  if (!res.ok) {
    const msg =
      (body && typeof body === "object" && "message" in body
        ? String((body as { message: unknown }).message)
        : null) ?? res.statusText;
    throw new EvolutionError(`Evolution API ${res.status}: ${msg}`, res.status, body);
  }
  return body as T;
}

export const evolution = {
  /**
   * Retorna a instância com nome configurado, ou null se a Evolution não a tiver.
   */
  async fetchInstance(): Promise<EvolutionInstance | null> {
    const { instanceName } = getConfig();
    const data = await evoFetch<EvolutionInstance[]>("/instance/fetchInstances", {
      method: "GET",
      searchParams: { instanceName },
    });
    return data?.[0] ?? null;
  },

  async connectionState(): Promise<EvolutionConnectionStateResponse> {
    const { instanceName } = getConfig();
    return evoFetch(`/instance/connectionState/${instanceName}`, { method: "GET" });
  },

  /**
   * Tenta conectar a instância. Se desconectada, retorna QR Code (base64).
   * Se já conectada, retorna estado.
   */
  async connect(): Promise<EvolutionQrResponse> {
    const { instanceName } = getConfig();
    return evoFetch(`/instance/connect/${instanceName}`, { method: "GET" });
  },

  async logout(): Promise<{ status: string }> {
    const { instanceName } = getConfig();
    return evoFetch(`/instance/logout/${instanceName}`, { method: "DELETE" });
  },

  async setWebhook(config: EvolutionWebhookConfig): Promise<unknown> {
    const { instanceName } = getConfig();
    return evoFetch(`/webhook/set/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({ webhook: config }),
    });
  },

  /**
   * Envia mensagem de texto pra um JID (individual ou grupo).
   * Opcionalmente cita outra mensagem (reply quoted).
   */
  async sendText(
    remoteJid: string,
    text: string,
    quoted?: {
      id: string;
      remoteJid: string;
      fromMe: boolean;
      content: string;
    }
  ): Promise<EvolutionSendTextResponse> {
    const { instanceName } = getConfig();
    const body: Record<string, unknown> = {
      number: jidToNumber(remoteJid),
      text,
    };
    if (quoted) {
      body.quoted = {
        key: {
          id: quoted.id,
          remoteJid: quoted.remoteJid,
          fromMe: quoted.fromMe,
        },
        message: { conversation: quoted.content },
      };
    }
    return evoFetch(`/message/sendText/${instanceName}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /**
   * Busca a mídia de uma mensagem recebida como base64.
   * Usado pra baixar imagem/áudio/vídeo/doc que chegam e salvar no nosso Storage
   * (a URL .enc do WhatsApp não é acessível diretamente).
   */
  async getBase64FromMedia(
    messageId: string,
    convertToMp4 = false
  ): Promise<{ base64: string; mimetype: string } | null> {
    const { instanceName } = getConfig();
    try {
      const res = await evoFetch<{ base64?: string; media?: string; mimetype?: string }>(
        `/chat/getBase64FromMediaMessage/${instanceName}`,
        {
          method: "POST",
          body: JSON.stringify({ message: { key: { id: messageId } }, convertToMp4 }),
        }
      );
      const base64 = res.base64 ?? res.media;
      if (!base64) return null;
      return { base64, mimetype: res.mimetype ?? "application/octet-stream" };
    } catch (e) {
      console.warn("[getBase64FromMedia] falhou:", e instanceof Error ? e.message : e);
      return null;
    }
  },

  /**
   * Marca mensagens como lidas no WhatsApp (sincroniza o "visto" entre CRM e celular).
   * Recebe as keys das mensagens (remoteJid, fromMe, id) e dispara o read receipt.
   */
  async markAsRead(
    messages: Array<{ remoteJid: string; fromMe: boolean; id: string }>
  ): Promise<unknown> {
    if (messages.length === 0) return null;
    const { instanceName } = getConfig();
    return evoFetch(`/chat/markMessageAsRead/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({ readMessages: messages }),
    });
  },

  /**
   * Envia áudio como push-to-talk (mensagem de voz).
   * Aceita URL pública ou base64. Evolution converte pra OGG Opus se precisar.
   */
  async sendAudio(remoteJid: string, audioUrl: string): Promise<EvolutionSendMediaResponse> {
    const { instanceName } = getConfig();
    return evoFetch(`/message/sendWhatsAppAudio/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({
        number: jidToNumber(remoteJid),
        audio: audioUrl,
      }),
    });
  },

  /**
   * Envia mídia (imagem, vídeo ou documento) via URL pública.
   */
  async sendMedia(
    remoteJid: string,
    payload: Omit<EvolutionSendMediaPayload, "number">
  ): Promise<EvolutionSendMediaResponse> {
    const { instanceName } = getConfig();
    return evoFetch(`/message/sendMedia/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({
        number: jidToNumber(remoteJid),
        ...payload,
      }),
    });
  },

  async findWebhook(): Promise<EvolutionWebhookConfig | null> {
    const { instanceName } = getConfig();
    try {
      return await evoFetch<EvolutionWebhookConfig>(`/webhook/find/${instanceName}`, {
        method: "GET",
      });
    } catch (e) {
      if (e instanceof EvolutionError && e.status === 404) return null;
      throw e;
    }
  },
};

/**
 * Mapeia estado da Evolution → enum do nosso banco (whatsapp_instances.status).
 */
export function mapEvolutionStateToDb(
  state: string | null | undefined
): "connected" | "disconnected" | "connecting" | "qr" | "close" {
  switch (state) {
    case "open":
      return "connected";
    case "connecting":
      return "connecting";
    case "close":
      return "disconnected";
    default:
      return "disconnected";
  }
}
