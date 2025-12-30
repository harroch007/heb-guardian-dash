export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          acknowledged_at: string | null
          ai_analysis: Json | null
          ai_classification: Json | null
          ai_confidence: number | null
          ai_explanation: string | null
          ai_explanation_short: string | null
          ai_patterns: string[] | null
          ai_recommendation: string | null
          ai_recommendation_short: string | null
          ai_risk_score: number | null
          ai_summary: string | null
          ai_verdict: string | null
          analyzed_at: string | null
          category: string | null
          chat_type: string | null
          child_id: string | null
          content: string | null
          created_at: string
          device_id: string | null
          escalate: boolean | null
          id: number
          is_processed: boolean | null
          message_count: number | null
          parent_message: string | null
          risk_score: number | null
          sender: string | null
          sender_display: string | null
          should_alert: boolean | null
          should_store: boolean | null
          source: string | null
          suggested_action: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          ai_analysis?: Json | null
          ai_classification?: Json | null
          ai_confidence?: number | null
          ai_explanation?: string | null
          ai_explanation_short?: string | null
          ai_patterns?: string[] | null
          ai_recommendation?: string | null
          ai_recommendation_short?: string | null
          ai_risk_score?: number | null
          ai_summary?: string | null
          ai_verdict?: string | null
          analyzed_at?: string | null
          category?: string | null
          chat_type?: string | null
          child_id?: string | null
          content?: string | null
          created_at?: string
          device_id?: string | null
          escalate?: boolean | null
          id?: number
          is_processed?: boolean | null
          message_count?: number | null
          parent_message?: string | null
          risk_score?: number | null
          sender?: string | null
          sender_display?: string | null
          should_alert?: boolean | null
          should_store?: boolean | null
          source?: string | null
          suggested_action?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          ai_analysis?: Json | null
          ai_classification?: Json | null
          ai_confidence?: number | null
          ai_explanation?: string | null
          ai_explanation_short?: string | null
          ai_patterns?: string[] | null
          ai_recommendation?: string | null
          ai_recommendation_short?: string | null
          ai_risk_score?: number | null
          ai_summary?: string | null
          ai_verdict?: string | null
          analyzed_at?: string | null
          category?: string | null
          chat_type?: string | null
          child_id?: string | null
          content?: string | null
          created_at?: string
          device_id?: string | null
          escalate?: boolean | null
          id?: number
          is_processed?: boolean | null
          message_count?: number | null
          parent_message?: string | null
          risk_score?: number | null
          sender?: string | null
          sender_display?: string | null
          should_alert?: boolean | null
          should_store?: boolean | null
          source?: string | null
          suggested_action?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["device_id"]
          },
        ]
      }
      app_usage: {
        Row: {
          app_name: string | null
          child_id: string | null
          created_at: string | null
          device_id: string | null
          id: number
          package_name: string
          updated_at: string | null
          usage_date: string
          usage_minutes: number | null
        }
        Insert: {
          app_name?: string | null
          child_id?: string | null
          created_at?: string | null
          device_id?: string | null
          id?: number
          package_name: string
          updated_at?: string | null
          usage_date?: string
          usage_minutes?: number | null
        }
        Update: {
          app_name?: string | null
          child_id?: string | null
          created_at?: string | null
          device_id?: string | null
          id?: number
          package_name?: string
          updated_at?: string | null
          usage_date?: string
          usage_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "app_usage_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_usage_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["device_id"]
          },
        ]
      }
      children: {
        Row: {
          city: string | null
          created_at: string
          date_of_birth: string
          gender: string
          id: string
          name: string
          pairing_code: string | null
          pairing_code_expires_at: string | null
          parent_id: string
          phone_number: string
          school: string | null
          subscription_tier: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          date_of_birth: string
          gender: string
          id?: string
          name: string
          pairing_code?: string | null
          pairing_code_expires_at?: string | null
          parent_id: string
          phone_number: string
          school?: string | null
          subscription_tier?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          date_of_birth?: string
          gender?: string
          id?: string
          name?: string
          pairing_code?: string | null
          pairing_code_expires_at?: string | null
          parent_id?: string
          phone_number?: string
          school?: string | null
          subscription_tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "children_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      device_commands: {
        Row: {
          command_type: string
          created_at: string
          device_id: string
          id: string
          status: string
        }
        Insert: {
          command_type: string
          created_at?: string
          device_id: string
          id?: string
          status?: string
        }
        Update: {
          command_type?: string
          created_at?: string
          device_id?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_commands_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["device_id"]
          },
        ]
      }
      device_events: {
        Row: {
          child_id: string | null
          created_at: string | null
          device_id: string
          event_data: Json | null
          event_type: string
          id: string
          is_notified: boolean | null
        }
        Insert: {
          child_id?: string | null
          created_at?: string | null
          device_id: string
          event_data?: Json | null
          event_type: string
          id?: string
          is_notified?: boolean | null
        }
        Update: {
          child_id?: string | null
          created_at?: string | null
          device_id?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          is_notified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "device_events_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["device_id"]
          },
        ]
      }
      device_status: {
        Row: {
          battery: number | null
          device_id: string
          latitude: number | null
          longitude: number | null
          updated_at: string | null
        }
        Insert: {
          battery?: number | null
          device_id: string
          latitude?: number | null
          longitude?: number | null
          updated_at?: string | null
        }
        Update: {
          battery?: number | null
          device_id?: string
          latitude?: number | null
          longitude?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      devices: {
        Row: {
          battery_level: number | null
          child_id: string | null
          created_at: string | null
          device_id: string
          last_seen: string | null
          latitude: number | null
          longitude: number | null
        }
        Insert: {
          battery_level?: number | null
          child_id?: string | null
          created_at?: string | null
          device_id: string
          last_seen?: string | null
          latitude?: number | null
          longitude?: number | null
        }
        Update: {
          battery_level?: number | null
          child_id?: string | null
          created_at?: string | null
          device_id?: string
          last_seen?: string | null
          latitude?: number | null
          longitude?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      parents: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          accessibility_service_enabled: boolean | null
          alert_on_trigger_words: boolean | null
          alert_on_unknown_contacts: boolean | null
          alert_threshold: number | null
          blocked_apps: Json | null
          child_id: string | null
          created_at: string | null
          custom_trigger_words: Json | null
          daily_screen_time_limit_minutes: number | null
          device_id: string | null
          id: string
          local_llm_enabled: boolean | null
          location_tracking_enabled: boolean | null
          location_update_interval_minutes: number | null
          monitoring_enabled: boolean | null
          notification_listener_enabled: boolean | null
          parent_id: string | null
          redaction_mode: string | null
          remote_llm_enabled: boolean | null
          screen_time_tracking_enabled: boolean | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          accessibility_service_enabled?: boolean | null
          alert_on_trigger_words?: boolean | null
          alert_on_unknown_contacts?: boolean | null
          alert_threshold?: number | null
          blocked_apps?: Json | null
          child_id?: string | null
          created_at?: string | null
          custom_trigger_words?: Json | null
          daily_screen_time_limit_minutes?: number | null
          device_id?: string | null
          id?: string
          local_llm_enabled?: boolean | null
          location_tracking_enabled?: boolean | null
          location_update_interval_minutes?: number | null
          monitoring_enabled?: boolean | null
          notification_listener_enabled?: boolean | null
          parent_id?: string | null
          redaction_mode?: string | null
          remote_llm_enabled?: boolean | null
          screen_time_tracking_enabled?: boolean | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          accessibility_service_enabled?: boolean | null
          alert_on_trigger_words?: boolean | null
          alert_on_unknown_contacts?: boolean | null
          alert_threshold?: number | null
          blocked_apps?: Json | null
          child_id?: string | null
          created_at?: string | null
          custom_trigger_words?: Json | null
          daily_screen_time_limit_minutes?: number | null
          device_id?: string | null
          id?: string
          local_llm_enabled?: boolean | null
          location_tracking_enabled?: boolean | null
          location_update_interval_minutes?: number | null
          monitoring_enabled?: boolean | null
          notification_listener_enabled?: boolean | null
          parent_id?: string | null
          redaction_mode?: string | null
          remote_llm_enabled?: boolean | null
          screen_time_tracking_enabled?: boolean | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "settings_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      training_dataset: {
        Row: {
          age_at_incident: number | null
          ai_verdict: Json | null
          created_at: string
          gender: string | null
          id: string
          raw_text: string
        }
        Insert: {
          age_at_incident?: number | null
          ai_verdict?: Json | null
          created_at?: string
          gender?: string | null
          id?: string
          raw_text: string
        }
        Update: {
          age_at_incident?: number | null
          ai_verdict?: Json | null
          created_at?: string
          gender?: string | null
          id?: string
          raw_text?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_data: { Args: never; Returns: Json }
      connect_child_device: {
        Args: {
          p_device_id: string
          p_pairing_code: string
          p_parent_email: string
        }
        Returns: Json
      }
      create_alert: {
        Args: {
          p_chat_type?: string
          p_contact_hash?: string
          p_device_id: string
          p_message: string
          p_message_count?: number
          p_pii_redacted_count?: number
          p_risk_level: number
          p_sender_display?: string
          p_source: string
        }
        Returns: number
      }
      delete_all_my_data: { Args: never; Returns: Json }
      delete_child_data: { Args: { p_child_id: string }; Returns: Json }
      export_my_data: { Args: never; Returns: Json }
      generate_new_pairing_code: { Args: { p_child_id: string }; Returns: Json }
      generate_pairing_code: { Args: { p_child_id: string }; Returns: string }
      get_device_settings: { Args: { p_device_id: string }; Returns: Json }
      pair_device:
        | {
            Args: { p_device_id: string; p_pairing_code: string }
            Returns: {
              child_id: string
              child_name: string
              error_message: string
              success: boolean
            }[]
          }
        | {
            Args: {
              p_device_id: string
              p_device_model?: string
              p_device_name?: string
              p_pairing_code: string
            }
            Returns: Json
          }
      register_device: {
        Args: {
          p_child_id: string
          p_device_id: string
          p_device_model: string
          p_device_name: string
        }
        Returns: Json
      }
      update_device_location: {
        Args: { p_device_id: string; p_lat: number; p_lon: number }
        Returns: Json
      }
      update_device_settings: {
        Args: { p_device_id: string; p_settings: Json }
        Returns: Json
      }
      update_device_status: {
        Args: {
          p_battery?: number
          p_device_id: string
          p_lat?: number
          p_lon?: number
        }
        Returns: undefined
      }
      upsert_app_usage: {
        Args: {
          p_app_name: string
          p_device_id: string
          p_package_name: string
          p_usage_minutes: number
        }
        Returns: undefined
      }
      verify_parent_code: {
        Args: { p_code: string; p_email: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
