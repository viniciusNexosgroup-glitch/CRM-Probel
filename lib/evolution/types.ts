/**
 * Tipos para respostas da Evolution API v2.3.7.
 * Cobre só o que o CRM usa — não é exaustivo.
 */

export type EvolutionConnectionState = "open" | "close" | "connecting";

export interface EvolutionInstance {
  id: string;
  name: string;
  connectionStatus: EvolutionConnectionState;
  ownerJid: string | null;
  profileName: string | null;
  profilePicUrl: string | null;
  integration: string;
  number: string | null;
  token: string;
  clientName: string;
  disconnectionReasonCode: number | null;
  disconnectionAt: string | null;
  createdAt: string;
  updatedAt: string;
  Setting?: {
    rejectCall: boolean;
    msgCall: string;
    groupsIgnore: boolean;
    alwaysOnline: boolean;
    readMessages: boolean;
    readStatus: boolean;
    syncFullHistory: boolean;
  };
  _count?: {
    Message: number;
    Contact: number;
    Chat: number;
  };
}

export interface EvolutionConnectionStateResponse {
  instance: {
    instanceName: string;
    state: EvolutionConnectionState;
  };
}

export interface EvolutionQrResponse {
  pairingCode?: string;
  code?: string;
  base64?: string;       // data URI da imagem do QR
  count?: number;
}

export interface EvolutionWebhookConfig {
  enabled: boolean;
  url: string;
  webhookByEvents?: boolean;
  webhookBase64?: boolean;
  events: string[];
}
