/**
 * Wrapper minimalista da Evolution API v2.3.7.
 * Toda chamada usa header `apikey`. Sempre server-side.
 */
import type {
  EvolutionInstance,
  EvolutionConnectionStateResponse,
  EvolutionQrResponse,
  EvolutionWebhookConfig,
} from "./types";

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
