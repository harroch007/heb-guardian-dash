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
      ai_stack_requests: {
        Row: {
          chat_hash: string | null
          chat_type: string
          child_id: string | null
          created_at: string
          device_id: string
          id: string
          stack_size: number
          trigger_reason: string | null
        }
        Insert: {
          chat_hash?: string | null
          chat_type?: string
          child_id?: string | null
          created_at?: string
          device_id: string
          id?: string
          stack_size: number
          trigger_reason?: string | null
        }
        Update: {
          chat_hash?: string | null
          chat_type?: string
          child_id?: string | null
          created_at?: string
          device_id?: string
          id?: string
          stack_size?: number
          trigger_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_stack_requests_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_stack_requests_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "ai_stack_requests_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_daily_report"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "ai_stack_requests_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_daily_report_for_parent"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "ai_stack_requests_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_home_snapshot"
            referencedColumns: ["device_id"]
          },
        ]
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          ai_analysis: Json | null
          ai_classification: Json | null
          ai_confidence: number | null
          ai_context: string | null
          ai_explanation: string | null
          ai_explanation_short: string | null
          ai_meaning: string | null
          ai_patterns: string[] | null
          ai_recommendation: string | null
          ai_recommendation_short: string | null
          ai_risk_score: number | null
          ai_social_context: Json | null
          ai_summary: string | null
          ai_title: string | null
          ai_verdict: string | null
          analyzed_at: string | null
          author_type: string | null
          category: string | null
          chat_name: string | null
          chat_type: string | null
          child_id: string | null
          child_role: string | null
          content: string | null
          created_at: string
          device_id: string | null
          escalate: boolean | null
          expert_type: string | null
          id: number
          is_processed: boolean | null
          message_count: number | null
          parent_message: string | null
          remind_at: string | null
          risk_score: number | null
          saved_at: string | null
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
          ai_context?: string | null
          ai_explanation?: string | null
          ai_explanation_short?: string | null
          ai_meaning?: string | null
          ai_patterns?: string[] | null
          ai_recommendation?: string | null
          ai_recommendation_short?: string | null
          ai_risk_score?: number | null
          ai_social_context?: Json | null
          ai_summary?: string | null
          ai_title?: string | null
          ai_verdict?: string | null
          analyzed_at?: string | null
          author_type?: string | null
          category?: string | null
          chat_name?: string | null
          chat_type?: string | null
          child_id?: string | null
          child_role?: string | null
          content?: string | null
          created_at?: string
          device_id?: string | null
          escalate?: boolean | null
          expert_type?: string | null
          id?: number
          is_processed?: boolean | null
          message_count?: number | null
          parent_message?: string | null
          remind_at?: string | null
          risk_score?: number | null
          saved_at?: string | null
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
          ai_context?: string | null
          ai_explanation?: string | null
          ai_explanation_short?: string | null
          ai_meaning?: string | null
          ai_patterns?: string[] | null
          ai_recommendation?: string | null
          ai_recommendation_short?: string | null
          ai_risk_score?: number | null
          ai_social_context?: Json | null
          ai_summary?: string | null
          ai_title?: string | null
          ai_verdict?: string | null
          analyzed_at?: string | null
          author_type?: string | null
          category?: string | null
          chat_name?: string | null
          chat_type?: string | null
          child_id?: string | null
          child_role?: string | null
          content?: string | null
          created_at?: string
          device_id?: string | null
          escalate?: boolean | null
          expert_type?: string | null
          id?: number
          is_processed?: boolean | null
          message_count?: number | null
          parent_message?: string | null
          remind_at?: string | null
          risk_score?: number | null
          saved_at?: string | null
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
          {
            foreignKeyName: "alerts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_daily_report"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "alerts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_daily_report_for_parent"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "alerts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_home_snapshot"
            referencedColumns: ["device_id"]
          },
        ]
      }
      allowed_emails: {
        Row: {
          added_by: string | null
          created_at: string | null
          email: string
          id: string
          notes: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string | null
          email: string
          id?: string
          notes?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string | null
          email?: string
          id?: string
          notes?: string | null
        }
        Relationships: []
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
          {
            foreignKeyName: "app_usage_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_daily_report"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "app_usage_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_daily_report_for_parent"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "app_usage_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_home_snapshot"
            referencedColumns: ["device_id"]
          },
        ]
      }
      child_daily_insights: {
        Row: {
          child_id: string
          created_at: string | null
          data_quality: string
          day_of_week: number
          headline: string
          id: string
          insight_date: string
          insights: string[]
          is_conclusive: boolean
          severity_band: string
          suggested_action: string | null
        }
        Insert: {
          child_id: string
          created_at?: string | null
          data_quality: string
          day_of_week: number
          headline: string
          id?: string
          insight_date: string
          insights: string[]
          is_conclusive?: boolean
          severity_band: string
          suggested_action?: string | null
        }
        Update: {
          child_id?: string
          created_at?: string | null
          data_quality?: string
          day_of_week?: number
          headline?: string
          id?: string
          insight_date?: string
          insights?: string[]
          is_conclusive?: boolean
          severity_band?: string
          suggested_action?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "child_daily_insights_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
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
      daily_chat_stats: {
        Row: {
          chat_name: string
          chat_type: string
          child_id: string | null
          device_id: string
          id: string
          message_count: number
          stat_date: string
          updated_at: string
        }
        Insert: {
          chat_name: string
          chat_type?: string
          child_id?: string | null
          device_id: string
          id?: string
          message_count?: number
          stat_date: string
          updated_at?: string
        }
        Update: {
          chat_name?: string
          chat_type?: string
          child_id?: string | null
          device_id?: string
          id?: string
          message_count?: number
          stat_date?: string
          updated_at?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "device_commands_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_daily_report"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "device_commands_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_daily_report_for_parent"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "device_commands_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_home_snapshot"
            referencedColumns: ["device_id"]
          },
        ]
      }
      device_daily_health: {
        Row: {
          check_date: string | null
          checks_responded: number | null
          checks_sent: number | null
          created_at: string | null
          device_id: string | null
          id: string
          last_lat: number | null
          last_lon: number | null
          last_response_at: string | null
        }
        Insert: {
          check_date?: string | null
          checks_responded?: number | null
          checks_sent?: number | null
          created_at?: string | null
          device_id?: string | null
          id?: string
          last_lat?: number | null
          last_lon?: number | null
          last_response_at?: string | null
        }
        Update: {
          check_date?: string | null
          checks_responded?: number | null
          checks_sent?: number | null
          created_at?: string | null
          device_id?: string | null
          id?: string
          last_lat?: number | null
          last_lon?: number | null
          last_response_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_daily_health_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "device_daily_health_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_daily_report"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "device_daily_health_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_daily_report_for_parent"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "device_daily_health_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_home_snapshot"
            referencedColumns: ["device_id"]
          },
        ]
      }
      device_daily_metrics: {
        Row: {
          alerts_sent: number
          created_at: string
          device_id: string
          id: string
          messages_scanned: number
          metric_date: string
          stacks_sent_to_ai: number
          updated_at: string
        }
        Insert: {
          alerts_sent?: number
          created_at?: string
          device_id: string
          id?: string
          messages_scanned?: number
          metric_date?: string
          stacks_sent_to_ai?: number
          updated_at?: string
        }
        Update: {
          alerts_sent?: number
          created_at?: string
          device_id?: string
          id?: string
          messages_scanned?: number
          metric_date?: string
          stacks_sent_to_ai?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_daily_metrics_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "device_daily_metrics_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_daily_report"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "device_daily_metrics_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_daily_report_for_parent"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "device_daily_metrics_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_home_snapshot"
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
          {
            foreignKeyName: "device_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_daily_report"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "device_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_daily_report_for_parent"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "device_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_home_snapshot"
            referencedColumns: ["device_id"]
          },
        ]
      }
      devices: {
        Row: {
          address: string | null
          battery_level: number | null
          child_id: string | null
          created_at: string | null
          device_id: string
          first_seen_at: string | null
          last_seen: string | null
          latitude: number | null
          longitude: number | null
        }
        Insert: {
          address?: string | null
          battery_level?: number | null
          child_id?: string | null
          created_at?: string | null
          device_id: string
          first_seen_at?: string | null
          last_seen?: string | null
          latitude?: number | null
          longitude?: number | null
        }
        Update: {
          address?: string | null
          battery_level?: number | null
          child_id?: string | null
          created_at?: string | null
          device_id?: string
          first_seen_at?: string | null
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          parent_id: string
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          parent_id: string
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          parent_id?: string
          updated_at?: string | null
          user_agent?: string | null
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
            foreignKeyName: "settings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_daily_report"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "settings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_daily_report_for_parent"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "settings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_home_snapshot"
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
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waitlist_signups: {
        Row: {
          child_age: number
          created_at: string | null
          device_os: string
          email: string
          id: string
          parent_name: string
          phone: string
          referral_other: string | null
          referral_source: string | null
          region: string | null
          status: string | null
        }
        Insert: {
          child_age: number
          created_at?: string | null
          device_os: string
          email: string
          id?: string
          parent_name: string
          phone: string
          referral_other?: string | null
          referral_source?: string | null
          region?: string | null
          status?: string | null
        }
        Update: {
          child_age?: number
          created_at?: string | null
          device_os?: string
          email?: string
          id?: string
          parent_name?: string
          phone?: string
          referral_other?: string | null
          referral_source?: string | null
          region?: string | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      parent_alerts_effective: {
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
          author_type: string | null
          category: string | null
          chat_name: string | null
          chat_type: string | null
          child_id: string | null
          child_role: string | null
          content: string | null
          created_at: string | null
          device_id: string | null
          effective_threshold: number | null
          escalate: boolean | null
          expert_type: string | null
          id: number | null
          is_in_warmup: boolean | null
          is_processed: boolean | null
          message_count: number | null
          parent_message: string | null
          remind_at: string | null
          risk_score: number | null
          sender: string | null
          sender_display: string | null
          should_alert: boolean | null
          should_store: boolean | null
          source: string | null
          suggested_action: string | null
          warmup_start: string | null
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
          {
            foreignKeyName: "alerts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_daily_report"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "alerts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_daily_report_for_parent"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "alerts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "parent_home_snapshot"
            referencedColumns: ["device_id"]
          },
        ]
      }
      parent_daily_report: {
        Row: {
          checks_responded: number | null
          checks_sent: number | null
          child_id: string | null
          cnt_notify: number | null
          cnt_notify_effective: number | null
          cnt_review: number | null
          cnt_safe: number | null
          device_id: string | null
          effective_threshold: number | null
          is_in_warmup: boolean | null
          last_response_at: string | null
          report_date: string | null
          top_apps: Json | null
          total_usage_minutes: number | null
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
      parent_daily_report_for_parent: {
        Row: {
          checks_responded: number | null
          checks_sent: number | null
          child_id: string | null
          cnt_notify: number | null
          cnt_notify_effective: number | null
          cnt_review: number | null
          cnt_safe: number | null
          device_id: string | null
          effective_threshold: number | null
          is_in_warmup: boolean | null
          last_response_at: string | null
          report_date: string | null
          top_apps: Json | null
          total_usage_minutes: number | null
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
      parent_home_snapshot: {
        Row: {
          address: string | null
          alerts_sent: number | null
          battery_level: number | null
          child_id: string | null
          child_name: string | null
          device_id: string | null
          last_seen: string | null
          max_notify_score: number | null
          messages_scanned: number | null
          notify_effective_today: number | null
          stacks_sent_to_ai: number | null
          top_apps: Json | null
          top_chats: Json | null
          total_usage_minutes: number | null
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
      parent_top_chats_today: {
        Row: {
          device_id: string | null
          stat_date: string | null
          top_chats: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_daily_metrics: {
        Args: {
          p_ai_delta?: number
          p_alerts_delta?: number
          p_device_id: string
          p_messages_delta?: number
          p_metric_date?: string
        }
        Returns: Json
      }
      check_unresponsive_devices: { Args: never; Returns: undefined }
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
          p_author_type?: string
          p_chat_name?: string
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
      create_permission_alert: {
        Args: {
          p_alert_message: string
          p_device_id: string
          p_missing_permissions: string
        }
        Returns: undefined
      }
      delete_all_my_data: { Args: never; Returns: Json }
      delete_child_data: { Args: { p_child_id: string }; Returns: Json }
      export_my_data: { Args: never; Returns: Json }
      generate_new_pairing_code: { Args: { p_child_id: string }; Returns: Json }
      generate_pairing_code: { Args: { p_child_id: string }; Returns: string }
      get_child_daily_metrics: {
        Args: { p_child_id: string; p_date: string }
        Returns: {
          alerts_sent: number
          messages_scanned: number
          metric_date: string
          stacks_sent_to_ai: number
        }[]
      }
      get_child_top_apps: {
        Args: { p_child_id: string; p_date: string; p_limit?: number }
        Returns: {
          app_name: string
          package_name: string
          usage_minutes: number
        }[]
      }
      get_child_top_contacts: {
        Args: { p_child_id: string; p_date: string; p_limit?: number }
        Returns: {
          chat_name: string
          chat_type: string
          message_count: number
        }[]
      }
      get_device_settings: { Args: { p_device_id: string }; Returns: Json }
      get_parent_daily_report_for_parent: {
        Args: { p_report_date: string }
        Returns: {
          checks_responded: number
          checks_sent: number
          child_id: string
          cnt_notify: number
          cnt_notify_effective: number
          cnt_review: number
          cnt_safe: number
          device_id: string
          effective_threshold: number
          is_in_warmup: boolean
          last_response_at: string
          report_date: string
          top_apps: Json
          total_usage_minutes: number
        }[]
      }
      get_parent_daily_report_text: {
        Args: { p_child_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_daily_chat_stat: {
        Args: {
          p_chat_name: string
          p_chat_type: string
          p_child_id: string
          p_delta?: number
          p_device_id: string
          p_stat_date?: string
        }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      is_email_allowed: { Args: { p_email: string }; Returns: boolean }
      pair_device: {
        Args: { p_device_id: string; p_pairing_code: string }
        Returns: {
          child_id: string
          child_name: string
          error_message: string
          success: boolean
        }[]
      }
      send_locate_to_all_devices: { Args: never; Returns: undefined }
      update_device_location: {
        Args: {
          p_address?: string
          p_device_id: string
          p_lat: number
          p_lon: number
        }
        Returns: undefined
      }
      update_device_settings: {
        Args: { p_device_id: string; p_settings: Json }
        Returns: Json
      }
      update_device_status: {
        Args: {
          p_battery: number
          p_device_id: string
          p_lat: number
          p_lon: number
        }
        Returns: undefined
      }
      upsert_app_usage: {
        Args: {
          p_app_name: string
          p_device_id: string
          p_package_name: string
          p_usage_date?: string
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
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
