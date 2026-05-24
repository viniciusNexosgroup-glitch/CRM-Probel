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
      internal_notes: {
        Row: {
          id: string;
          conversation_id: string;
          author_id: string | null;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          author_id?: string | null;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          author_id?: string | null;
          content?: string;
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
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
