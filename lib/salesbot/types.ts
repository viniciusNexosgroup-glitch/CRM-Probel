import type { Json } from "@/types/database";

export type SalesbotFlowStatus = "draft" | "active" | "paused" | "archived";
export type SalesbotChannel = "whatsapp" | "instagram" | "facebook" | "webchat" | "multi";

export type SalesbotFlow = {
  id: string;
  name: string;
  description: string | null;
  channel: SalesbotChannel;
  status: SalesbotFlowStatus;
  created_by: string | null;
  updated_by: string | null;
  last_published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SalesbotNodeType =
  | "send_message"
  | "ask_question"
  | "capture_response"
  | "wait"
  | "condition"
  | "keyword"
  | "add_tag"
  | "remove_tag"
  | "change_stage"
  | "assign_user"
  | "create_task"
  | "send_media"
  | "handoff"
  | "notify_user"
  | "end_flow"
  | "webhook"
  | "ai_response";

export type SalesbotNode = {
  id?: string;
  flow_id?: string;
  node_key: string;
  type: SalesbotNodeType;
  label: string;
  position_x: number;
  position_y: number;
  config: Record<string, Json | undefined>;
};

export type SalesbotEdge = {
  id?: string;
  flow_id?: string;
  edge_key: string;
  source_node_key: string;
  target_node_key: string;
  label: string | null;
  condition: Record<string, Json | undefined>;
};

export type SalesbotTriggerType =
  | "new_conversation"
  | "new_message"
  | "lead_created"
  | "stage_changed"
  | "no_response"
  | "keyword_detected"
  | "instagram_comment"
  | "outside_business_hours";

export type SalesbotTrigger = {
  id: string;
  flow_id: string;
  type: SalesbotTriggerType;
  config: Record<string, Json | undefined>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SalesbotStats = {
  totalExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  humanHandoffs: number;
};
