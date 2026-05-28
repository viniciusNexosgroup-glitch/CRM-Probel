/**
 * Tipos do banco do CRM Probel.
 * Escritos à mão a partir de supabase/migrations/0001_init.sql.
 *
 * Para regenerar automaticamente no futuro (quando linkar o projeto):
 *   npx supabase gen types typescript --project-id ibcnfdqthqglpnqcyauq --schema public > types/database.ts
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WhatsAppStatus = "connected" | "disconnected" | "connecting" | "qr" | "close";
export type MessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker"
  | "gif"
  | "location"
  | "contact"
  | "reaction"
  | "unknown";
export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";
export type LeadStatus = "open" | "won" | "lost";
export type SalesbotFlowStatus = "draft" | "active" | "paused" | "archived";
export type SalesbotChannel = "whatsapp" | "instagram" | "facebook" | "webchat" | "multi";
export type SalesbotExecutionStatus =
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled";
export type SalesbotTriggerType =
  | "new_conversation"
  | "new_message"
  | "lead_created"
  | "stage_changed"
  | "no_response"
  | "keyword_detected"
  | "instagram_comment"
  | "outside_business_hours";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          role: "admin" | "user";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: "admin" | "user";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: "admin" | "user";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      whatsapp_instances: {
        Row: {
          id: string;
          user_id: string | null;
          instance_name: string;
          evolution_api_url: string | null;
          status: WhatsAppStatus;
          phone_number: string | null;
          profile_name: string | null;
          profile_pic_url: string | null;
          qr_code: string | null;
          qr_code_updated_at: string | null;
          last_connected_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          instance_name: string;
          evolution_api_url?: string | null;
          status?: WhatsAppStatus;
          phone_number?: string | null;
          profile_name?: string | null;
          profile_pic_url?: string | null;
          qr_code?: string | null;
          qr_code_updated_at?: string | null;
          last_connected_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          instance_name?: string;
          evolution_api_url?: string | null;
          status?: WhatsAppStatus;
          phone_number?: string | null;
          profile_name?: string | null;
          profile_pic_url?: string | null;
          qr_code?: string | null;
          qr_code_updated_at?: string | null;
          last_connected_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          instance_id: string;
          whatsapp_id: string;
          phone: string | null;
          name: string | null;
          push_name: string | null;
          profile_pic_url: string | null;
          status_message: string | null;
          is_group: boolean;
          is_blocked: boolean;
          is_favorite: boolean;
          last_contact_at: string | null;
          notes: string | null;
          presence_status: string | null;
          presence_updated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          instance_id: string;
          whatsapp_id: string;
          phone?: string | null;
          name?: string | null;
          push_name?: string | null;
          profile_pic_url?: string | null;
          status_message?: string | null;
          is_group?: boolean;
          is_blocked?: boolean;
          is_favorite?: boolean;
          last_contact_at?: string | null;
          notes?: string | null;
          presence_status?: string | null;
          presence_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          instance_id?: string;
          whatsapp_id?: string;
          phone?: string | null;
          name?: string | null;
          push_name?: string | null;
          profile_pic_url?: string | null;
          status_message?: string | null;
          is_group?: boolean;
          is_blocked?: boolean;
          is_favorite?: boolean;
          last_contact_at?: string | null;
          notes?: string | null;
          presence_status?: string | null;
          presence_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          instance_id: string;
          contact_id: string;
          remote_jid: string;
          is_pinned: boolean;
          is_muted: boolean;
          is_archived: boolean;
          unread_count: number;
          last_message_text: string | null;
          last_message_at: string | null;
          last_message_from_me: boolean | null;
          assigned_to: string | null;
          auto_replied_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          instance_id: string;
          contact_id: string;
          remote_jid: string;
          is_pinned?: boolean;
          is_muted?: boolean;
          is_archived?: boolean;
          unread_count?: number;
          last_message_text?: string | null;
          last_message_at?: string | null;
          last_message_from_me?: boolean | null;
          assigned_to?: string | null;
          auto_replied_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          instance_id?: string;
          contact_id?: string;
          remote_jid?: string;
          is_pinned?: boolean;
          is_muted?: boolean;
          is_archived?: boolean;
          unread_count?: number;
          last_message_text?: string | null;
          last_message_at?: string | null;
          last_message_from_me?: boolean | null;
          assigned_to?: string | null;
          auto_replied_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          instance_id: string;
          evolution_message_id: string | null;
          remote_jid: string;
          from_me: boolean;
          sender_jid: string | null;
          message_type: MessageType;
          content: string | null;
          media_url: string | null;
          media_mimetype: string | null;
          media_filename: string | null;
          media_size: number | null;
          media_caption: string | null;
          thumbnail_url: string | null;
          duration: number | null;
          reply_to_id: string | null;
          status: MessageStatus;
          timestamp: string;
          raw_payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          instance_id: string;
          evolution_message_id?: string | null;
          remote_jid: string;
          from_me?: boolean;
          sender_jid?: string | null;
          message_type: MessageType;
          content?: string | null;
          media_url?: string | null;
          media_mimetype?: string | null;
          media_filename?: string | null;
          media_size?: number | null;
          media_caption?: string | null;
          thumbnail_url?: string | null;
          duration?: number | null;
          reply_to_id?: string | null;
          status?: MessageStatus;
          timestamp: string;
          raw_payload?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          instance_id?: string;
          evolution_message_id?: string | null;
          remote_jid?: string;
          from_me?: boolean;
          sender_jid?: string | null;
          message_type?: MessageType;
          content?: string | null;
          media_url?: string | null;
          media_mimetype?: string | null;
          media_filename?: string | null;
          media_size?: number | null;
          media_caption?: string | null;
          thumbnail_url?: string | null;
          duration?: number | null;
          reply_to_id?: string | null;
          status?: MessageStatus;
          timestamp?: string;
          raw_payload?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      pipeline_stages: {
        Row: {
          id: string;
          name: string;
          position: number;
          color: string;
          is_won: boolean;
          is_lost: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          position: number;
          color?: string;
          is_won?: boolean;
          is_lost?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          position?: number;
          color?: string;
          is_won?: boolean;
          is_lost?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          contact_id: string;
          conversation_id: string | null;
          stage_id: string | null;
          name: string | null;
          phone: string | null;
          source: string | null;
          campaign_name: string | null;
          ad_name: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          utm_content: string | null;
          interest: string | null;
          status: LeadStatus;
          estimated_value: number | null;
          closed_value: number | null;
          lost_reason: string | null;
          assigned_to: string | null;
          next_action: string | null;
          next_action_at: string | null;
          last_contact_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          conversation_id?: string | null;
          stage_id?: string | null;
          name?: string | null;
          phone?: string | null;
          source?: string | null;
          campaign_name?: string | null;
          ad_name?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          interest?: string | null;
          status?: LeadStatus;
          estimated_value?: number | null;
          closed_value?: number | null;
          lost_reason?: string | null;
          assigned_to?: string | null;
          next_action?: string | null;
          next_action_at?: string | null;
          last_contact_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          conversation_id?: string | null;
          stage_id?: string | null;
          name?: string | null;
          phone?: string | null;
          source?: string | null;
          campaign_name?: string | null;
          ad_name?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          interest?: string | null;
          status?: LeadStatus;
          estimated_value?: number | null;
          closed_value?: number | null;
          lost_reason?: string | null;
          assigned_to?: string | null;
          next_action?: string | null;
          next_action_at?: string | null;
          last_contact_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: { id: string; name: string; color: string; created_at: string };
        Insert: { id?: string; name: string; color?: string; created_at?: string };
        Update: { id?: string; name?: string; color?: string; created_at?: string };
        Relationships: [];
      };
      lead_tags: {
        Row: { lead_id: string; tag_id: string; created_at: string };
        Insert: { lead_id: string; tag_id: string; created_at?: string };
        Update: { lead_id?: string; tag_id?: string; created_at?: string };
        Relationships: [];
      };
      quick_replies: {
        Row: {
          id: string;
          shortcut: string;
          title: string;
          content: string;
          category: string | null;
          user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shortcut: string;
          title: string;
          content: string;
          category?: string | null;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shortcut?: string;
          title?: string;
          content?: string;
          category?: string | null;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          lead_id: string | null;
          contact_id: string | null;
          title: string;
          description: string | null;
          due_at: string | null;
          completed: boolean;
          completed_at: string | null;
          assigned_to: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id?: string | null;
          contact_id?: string | null;
          title: string;
          description?: string | null;
          due_at?: string | null;
          completed?: boolean;
          completed_at?: string | null;
          assigned_to?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string | null;
          contact_id?: string | null;
          title?: string;
          description?: string | null;
          due_at?: string | null;
          completed?: boolean;
          completed_at?: string | null;
          assigned_to?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      media_categories: {
        Row: {
          id: string;
          name: string;
          color: string | null;
          position: number;
          created_at: string;
        };
        Insert: { id?: string; name: string; color?: string | null; position?: number; created_at?: string };
        Update: { id?: string; name?: string; color?: string | null; position?: number; created_at?: string };
        Relationships: [];
      };
      media_library: {
        Row: {
          id: string;
          category_id: string | null;
          title: string;
          description: string | null;
          file_url: string;
          file_path: string;
          file_type: "image" | "video" | "audio" | "document";
          mimetype: string | null;
          file_size: number | null;
          thumbnail_url: string | null;
          duration: number | null;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id?: string | null;
          title: string;
          description?: string | null;
          file_url: string;
          file_path: string;
          file_type: "image" | "video" | "audio" | "document";
          mimetype?: string | null;
          file_size?: number | null;
          thumbnail_url?: string | null;
          duration?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string | null;
          title?: string;
          description?: string | null;
          file_url?: string;
          file_path?: string;
          file_type?: "image" | "video" | "audio" | "document";
          mimetype?: string | null;
          file_size?: number | null;
          thumbnail_url?: string | null;
          duration?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: { key: string; value: Json; updated_by: string | null; updated_at: string };
        Insert: { key: string; value: Json; updated_by?: string | null; updated_at?: string };
        Update: { key?: string; value?: Json; updated_by?: string | null; updated_at?: string };
        Relationships: [];
      };
      scheduled_messages: {
        Row: {
          id: string;
          conversation_id: string;
          instance_id: string;
          content: string;
          scheduled_for: string;
          status: "pending" | "sent" | "failed" | "cancelled";
          sent_at: string | null;
          error_message: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          instance_id: string;
          content: string;
          scheduled_for: string;
          status?: "pending" | "sent" | "failed" | "cancelled";
          sent_at?: string | null;
          error_message?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          instance_id?: string;
          content?: string;
          scheduled_for?: string;
          status?: "pending" | "sent" | "failed" | "cancelled";
          sent_at?: string | null;
          error_message?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lead_activity: {
        Row: {
          id: string;
          lead_id: string;
          type: "created" | "stage_changed" | "assigned" | "won" | "lost" | "value_changed" | "reopened";
          description: string;
          metadata: Json | null;
          user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          type: "created" | "stage_changed" | "assigned" | "won" | "lost" | "value_changed" | "reopened";
          description: string;
          metadata?: Json | null;
          user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          type?: "created" | "stage_changed" | "assigned" | "won" | "lost" | "value_changed" | "reopened";
          description?: string;
          metadata?: Json | null;
          user_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      internal_notes: {
        Row: {
          id: string;
          conversation_id: string;
          author_id: string | null;
          content: string;
          mentioned_user_ids: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          author_id?: string | null;
          content: string;
          mentioned_user_ids?: string[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          author_id?: string | null;
          content?: string;
          mentioned_user_ids?: string[] | null;
          created_at?: string;
        };
        Relationships: [];
      };
      automations: {
        Row: {
          id: string;
          name: string;
          trigger_type: "new_conversation" | "no_response" | "stage_change" | "tag_added" | "task_overdue";
          trigger_config: Json;
          action_type: "send_message" | "create_task" | "change_stage" | "add_tag" | "send_media";
          action_config: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          trigger_type: "new_conversation" | "no_response" | "stage_change" | "tag_added" | "task_overdue";
          trigger_config?: Json;
          action_type: "send_message" | "create_task" | "change_stage" | "add_tag" | "send_media";
          action_config?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          trigger_type?: "new_conversation" | "no_response" | "stage_change" | "tag_added" | "task_overdue";
          trigger_config?: Json;
          action_type?: "send_message" | "create_task" | "change_stage" | "add_tag" | "send_media";
          action_config?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      salesbot_flows: {
        Row: {
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
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          channel?: SalesbotChannel;
          status?: SalesbotFlowStatus;
          created_by?: string | null;
          updated_by?: string | null;
          last_published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          channel?: SalesbotChannel;
          status?: SalesbotFlowStatus;
          created_by?: string | null;
          updated_by?: string | null;
          last_published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      salesbot_nodes: {
        Row: {
          id: string;
          flow_id: string;
          node_key: string;
          type: string;
          label: string;
          position_x: number;
          position_y: number;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          flow_id: string;
          node_key: string;
          type: string;
          label: string;
          position_x?: number;
          position_y?: number;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          flow_id?: string;
          node_key?: string;
          type?: string;
          label?: string;
          position_x?: number;
          position_y?: number;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      salesbot_edges: {
        Row: {
          id: string;
          flow_id: string;
          edge_key: string;
          source_node_key: string;
          target_node_key: string;
          label: string | null;
          condition: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          flow_id: string;
          edge_key: string;
          source_node_key: string;
          target_node_key: string;
          label?: string | null;
          condition?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          flow_id?: string;
          edge_key?: string;
          source_node_key?: string;
          target_node_key?: string;
          label?: string | null;
          condition?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      salesbot_triggers: {
        Row: {
          id: string;
          flow_id: string;
          type: SalesbotTriggerType;
          config: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          flow_id: string;
          type: SalesbotTriggerType;
          config?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          flow_id?: string;
          type?: SalesbotTriggerType;
          config?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      salesbot_executions: {
        Row: {
          id: string;
          flow_id: string | null;
          trigger_id: string | null;
          conversation_id: string | null;
          lead_id: string | null;
          contact_id: string | null;
          current_node_key: string | null;
          status: SalesbotExecutionStatus;
          variables: Json;
          started_at: string;
          finished_at: string | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          flow_id?: string | null;
          trigger_id?: string | null;
          conversation_id?: string | null;
          lead_id?: string | null;
          contact_id?: string | null;
          current_node_key?: string | null;
          status?: SalesbotExecutionStatus;
          variables?: Json;
          started_at?: string;
          finished_at?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          flow_id?: string | null;
          trigger_id?: string | null;
          conversation_id?: string | null;
          lead_id?: string | null;
          contact_id?: string | null;
          current_node_key?: string | null;
          status?: SalesbotExecutionStatus;
          variables?: Json;
          started_at?: string;
          finished_at?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      salesbot_execution_logs: {
        Row: {
          id: string;
          execution_id: string;
          flow_id: string | null;
          node_key: string | null;
          level: "debug" | "info" | "warning" | "error";
          message: string;
          data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          execution_id: string;
          flow_id?: string | null;
          node_key?: string | null;
          level?: "debug" | "info" | "warning" | "error";
          message: string;
          data?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          execution_id?: string;
          flow_id?: string | null;
          node_key?: string | null;
          level?: "debug" | "info" | "warning" | "error";
          message?: string;
          data?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      salesbot_variables: {
        Row: {
          id: string;
          flow_id: string;
          key: string;
          label: string;
          value_type: "text" | "number" | "boolean" | "date" | "json";
          default_value: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          flow_id: string;
          key: string;
          label: string;
          value_type?: "text" | "number" | "boolean" | "date" | "json";
          default_value?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          flow_id?: string;
          key?: string;
          label?: string;
          value_type?: "text" | "number" | "boolean" | "date" | "json";
          default_value?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      salesbot_ai_settings: {
        Row: {
          id: string;
          flow_id: string | null;
          model: string;
          system_prompt: string | null;
          fallback_message: string | null;
          handoff_on_uncertainty: boolean;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          flow_id?: string | null;
          model?: string;
          system_prompt?: string | null;
          fallback_message?: string | null;
          handoff_on_uncertainty?: boolean;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          flow_id?: string | null;
          model?: string;
          system_prompt?: string | null;
          fallback_message?: string | null;
          handoff_on_uncertainty?: boolean;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      salesbot_knowledge_base: {
        Row: {
          id: string;
          title: string;
          content: string;
          category: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          category?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          category?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      save_salesbot_graph: {
        Args: {
          p_flow_id: string;
          p_nodes: Json;
          p_edges: Json;
        };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
