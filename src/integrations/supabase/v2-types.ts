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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      v2_alert_deliveries: {
        Row: {
          attempt_count: number
          attempted_at: string | null
          channel: string
          created_at: string
          delivered_at: string | null
          failure_code: string | null
          guardian_user_id: string
          id: string
          idempotency_key: string
          incident_id: string
          lease_expires_at: string | null
          lease_owner: string | null
          lease_token_hash: string | null
          next_attempt_at: string | null
          provider_message_id: string | null
          status: string
        }
        Insert: {
          attempt_count?: number
          attempted_at?: string | null
          channel: string
          created_at?: string
          delivered_at?: string | null
          failure_code?: string | null
          guardian_user_id: string
          id?: string
          idempotency_key: string
          incident_id: string
          lease_expires_at?: string | null
          lease_owner?: string | null
          lease_token_hash?: string | null
          next_attempt_at?: string | null
          provider_message_id?: string | null
          status?: string
        }
        Update: {
          attempt_count?: number
          attempted_at?: string | null
          channel?: string
          created_at?: string
          delivered_at?: string | null
          failure_code?: string | null
          guardian_user_id?: string
          id?: string
          idempotency_key?: string
          incident_id?: string
          lease_expires_at?: string | null
          lease_owner?: string | null
          lease_token_hash?: string | null
          next_attempt_at?: string | null
          provider_message_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_alert_deliveries_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "v2_safety_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_analyzer_capabilities: {
        Row: {
          capability_name: string
          created_at: string
          expires_at: string
          id: string
          not_before: string
          revoked_at: string | null
          status: string
          token_hash: string
          token_version: number
        }
        Insert: {
          capability_name: string
          created_at?: string
          expires_at: string
          id?: string
          not_before?: string
          revoked_at?: string | null
          status?: string
          token_hash: string
          token_version: number
        }
        Update: {
          capability_name?: string
          created_at?: string
          expires_at?: string
          id?: string
          not_before?: string
          revoked_at?: string | null
          status?: string
          token_hash?: string
          token_version?: number
        }
        Relationships: []
      }
      v2_audit_events: {
        Row: {
          action: string
          actor_type: string
          actor_user_id: string | null
          created_at: string
          id: number
          metadata: Json
          object_id: string | null
          object_type: string
          outcome: string
        }
        Insert: {
          action: string
          actor_type: string
          actor_user_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          object_id?: string | null
          object_type: string
          outcome: string
        }
        Update: {
          action?: string
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          object_id?: string | null
          object_type?: string
          outcome?: string
        }
        Relationships: []
      }
      v2_child_install_sessions: {
        Row: {
          activated_at: string | null
          activation_token_hash: string
          child_id: string
          consumed_at: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          otp_request_count: number
          otp_requested_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activation_token_hash: string
          child_id: string
          consumed_at?: string | null
          created_at?: string
          created_by: string
          expires_at: string
          id: string
          otp_request_count?: number
          otp_requested_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activation_token_hash?: string
          child_id?: string
          consumed_at?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          otp_request_count?: number
          otp_requested_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_child_install_sessions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v2_children"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_children: {
        Row: {
          birth_year: number | null
          created_at: string
          display_name: string
          family_id: string
          gender: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          birth_year?: number | null
          created_at?: string
          display_name: string
          family_id: string
          gender?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          birth_year?: number | null
          created_at?: string
          display_name?: string
          family_id?: string
          gender?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_children_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "v2_families"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_device_commands: {
        Row: {
          claimed_at: string | null
          command_type: string
          completed_at: string | null
          created_at: string
          device_id: string
          expires_at: string
          failure_code: string | null
          id: string
          idempotency_key: string
          not_before: string
          payload: Json
          requested_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          claimed_at?: string | null
          command_type: string
          completed_at?: string | null
          created_at?: string
          device_id: string
          expires_at: string
          failure_code?: string | null
          id?: string
          idempotency_key: string
          not_before?: string
          payload?: Json
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          claimed_at?: string | null
          command_type?: string
          completed_at?: string | null
          created_at?: string
          device_id?: string
          expires_at?: string
          failure_code?: string | null
          id?: string
          idempotency_key?: string
          not_before?: string
          payload?: Json
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_device_commands_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "v2_protected_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_device_credentials: {
        Row: {
          created_at: string
          credential_hash: string
          device_id: string
          expires_at: string
          id: string
          key_version: number
          revoked_at: string | null
          valid_from: string
        }
        Insert: {
          created_at?: string
          credential_hash: string
          device_id: string
          expires_at: string
          id?: string
          key_version: number
          revoked_at?: string | null
          valid_from?: string
        }
        Update: {
          created_at?: string
          credential_hash?: string
          device_id?: string
          expires_at?: string
          id?: string
          key_version?: number
          revoked_at?: string | null
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_device_credentials_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "v2_protected_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_device_health_events: {
        Row: {
          accessibility_enabled: boolean
          affects_current_state: boolean
          app_version: string | null
          battery_level_percent: number | null
          battery_optimization_exempt: boolean
          boot_session_id: string | null
          capabilities: Json
          capture_ready: boolean
          contract_version: number
          degraded_reasons: string[]
          device_id: string
          event_key: string
          expected_interval_seconds: number
          id: string
          notification_listener_enabled: boolean
          observed_at: string
          oem_autostart_state: string
          payload_hash: string | null
          product_ready: boolean | null
          received_at: string
          report_reason: string
          sequence_no: number | null
        }
        Insert: {
          accessibility_enabled: boolean
          affects_current_state?: boolean
          app_version?: string | null
          battery_level_percent?: number | null
          battery_optimization_exempt: boolean
          boot_session_id?: string | null
          capabilities?: Json
          capture_ready: boolean
          contract_version?: number
          degraded_reasons?: string[]
          device_id: string
          event_key: string
          expected_interval_seconds?: number
          id?: string
          notification_listener_enabled: boolean
          observed_at: string
          oem_autostart_state: string
          payload_hash?: string | null
          product_ready?: boolean | null
          received_at?: string
          report_reason?: string
          sequence_no?: number | null
        }
        Update: {
          accessibility_enabled?: boolean
          affects_current_state?: boolean
          app_version?: string | null
          battery_level_percent?: number | null
          battery_optimization_exempt?: boolean
          boot_session_id?: string | null
          capabilities?: Json
          capture_ready?: boolean
          contract_version?: number
          degraded_reasons?: string[]
          device_id?: string
          event_key?: string
          expected_interval_seconds?: number
          id?: string
          notification_listener_enabled?: boolean
          observed_at?: string
          oem_autostart_state?: string
          payload_hash?: string | null
          product_ready?: boolean | null
          received_at?: string
          report_reason?: string
          sequence_no?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_device_health_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "v2_protected_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_device_monitoring_state: {
        Row: {
          created_at: string
          device_id: string
          episode_id: string | null
          expected_interval_seconds: number
          healthy_streak: number
          interrupted_after_at: string | null
          interruption_started_at: string | null
          last_boot_session_id: string | null
          last_event_key: string | null
          last_health_event_id: string | null
          last_observed_at: string | null
          last_received_at: string | null
          last_sequence_no: number | null
          late_after_at: string | null
          monitoring_state: string
          reason_codes: string[]
          state_version: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_id: string
          episode_id?: string | null
          expected_interval_seconds?: number
          healthy_streak?: number
          interrupted_after_at?: string | null
          interruption_started_at?: string | null
          last_boot_session_id?: string | null
          last_event_key?: string | null
          last_health_event_id?: string | null
          last_observed_at?: string | null
          last_received_at?: string | null
          last_sequence_no?: number | null
          late_after_at?: string | null
          monitoring_state?: string
          reason_codes?: string[]
          state_version?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_id?: string
          episode_id?: string | null
          expected_interval_seconds?: number
          healthy_streak?: number
          interrupted_after_at?: string | null
          interruption_started_at?: string | null
          last_boot_session_id?: string | null
          last_event_key?: string | null
          last_health_event_id?: string | null
          last_observed_at?: string | null
          last_received_at?: string | null
          last_sequence_no?: number | null
          late_after_at?: string | null
          monitoring_state?: string
          reason_codes?: string[]
          state_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_device_monitoring_state_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: true
            referencedRelation: "v2_protected_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_device_monitoring_state_last_health_event_id_fkey"
            columns: ["last_health_event_id"]
            isOneToOne: false
            referencedRelation: "v2_device_health_events"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_device_monitoring_transitions: {
        Row: {
          created_at: string
          device_id: string
          episode_id: string | null
          health_event_id: string | null
          id: string
          new_state: string
          occurred_at: string
          previous_state: string | null
          reason_codes: string[]
          source: string
          state_version: number
        }
        Insert: {
          created_at?: string
          device_id: string
          episode_id?: string | null
          health_event_id?: string | null
          id?: string
          new_state: string
          occurred_at?: string
          previous_state?: string | null
          reason_codes?: string[]
          source: string
          state_version: number
        }
        Update: {
          created_at?: string
          device_id?: string
          episode_id?: string | null
          health_event_id?: string | null
          id?: string
          new_state?: string
          occurred_at?: string
          previous_state?: string | null
          reason_codes?: string[]
          source?: string
          state_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "v2_device_monitoring_transitions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "v2_protected_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_device_monitoring_transitions_health_event_id_fkey"
            columns: ["health_event_id"]
            isOneToOne: false
            referencedRelation: "v2_device_health_events"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_families: {
        Row: {
          created_at: string
          display_name: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      v2_guardian_incident_states: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          guardian_user_id: string
          incident_id: string
          saved_at: string | null
          state: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          guardian_user_id: string
          incident_id: string
          saved_at?: string | null
          state?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          guardian_user_id?: string
          incident_id?: string
          saved_at?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_guardian_incident_states_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "v2_safety_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_guardian_memberships: {
        Row: {
          created_at: string
          family_id: string
          guardian_user_id: string
          id: string
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          family_id: string
          guardian_user_id: string
          id?: string
          role: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          family_id?: string
          guardian_user_id?: string
          id?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_guardian_memberships_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "v2_families"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_guardian_profiles: {
        Row: {
          created_at: string
          display_name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      v2_guardian_push_endpoints: {
        Row: {
          auth_secret: string
          created_at: string
          endpoint: string
          endpoint_hash: string
          guardian_user_id: string
          id: string
          installation_id: string
          invalidated_at: string | null
          last_error_code: string | null
          last_seen_at: string
          last_success_at: string | null
          locale: string | null
          p256dh: string
          permission_state: string
          status: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          auth_secret: string
          created_at?: string
          endpoint: string
          endpoint_hash: string
          guardian_user_id: string
          id?: string
          installation_id: string
          invalidated_at?: string | null
          last_error_code?: string | null
          last_seen_at?: string
          last_success_at?: string | null
          locale?: string | null
          p256dh: string
          permission_state?: string
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          auth_secret?: string
          created_at?: string
          endpoint?: string
          endpoint_hash?: string
          guardian_user_id?: string
          id?: string
          installation_id?: string
          invalidated_at?: string | null
          last_error_code?: string | null
          last_seen_at?: string
          last_success_at?: string | null
          locale?: string | null
          p256dh?: string
          permission_state?: string
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      v2_incident_analysis: {
        Row: {
          action_code: string
          analysis_contract_version: number
          analyzed_at: string
          created_at: string
          incident_id: string
          model_name: string
          model_provider: string
          model_version: string
          outcome: string
          prompt_version: string
          reason_code: string
          recommended_action: string | null
          safe_reason: string | null
          safe_summary: string | null
        }
        Insert: {
          action_code: string
          analysis_contract_version: number
          analyzed_at?: string
          created_at?: string
          incident_id: string
          model_name: string
          model_provider: string
          model_version: string
          outcome: string
          prompt_version: string
          reason_code: string
          recommended_action?: string | null
          safe_reason?: string | null
          safe_summary?: string | null
        }
        Update: {
          action_code?: string
          analysis_contract_version?: number
          analyzed_at?: string
          created_at?: string
          incident_id?: string
          model_name?: string
          model_provider?: string
          model_version?: string
          outcome?: string
          prompt_version?: string
          reason_code?: string
          recommended_action?: string | null
          safe_reason?: string | null
          safe_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_incident_analysis_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "v2_safety_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_incident_analysis_details: {
        Row: {
          created_at: string
          evidence_segment_refs: string[]
          expert_category: string | null
          expert_child_role: string
          expert_confidence: number
          expert_pattern: string | null
          expert_severity: string | null
          expert_urgency: string | null
          incident_id: string
          inference_contract_version: number
          policy_channels: string[] | null
          secondary_categories: string[] | null
        }
        Insert: {
          created_at?: string
          evidence_segment_refs: string[]
          expert_category?: string | null
          expert_child_role: string
          expert_confidence: number
          expert_pattern?: string | null
          expert_severity?: string | null
          expert_urgency?: string | null
          incident_id: string
          inference_contract_version?: number
          policy_channels?: string[] | null
          secondary_categories?: string[] | null
        }
        Update: {
          created_at?: string
          evidence_segment_refs?: string[]
          expert_category?: string | null
          expert_child_role?: string
          expert_confidence?: number
          expert_pattern?: string | null
          expert_severity?: string | null
          expert_urgency?: string | null
          incident_id?: string
          inference_contract_version?: number
          policy_channels?: string[] | null
          secondary_categories?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_incident_analysis_details_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "v2_incident_analysis"
            referencedColumns: ["incident_id"]
          },
        ]
      }
      v2_incident_analysis_jobs: {
        Row: {
          attempt_count: number
          completed_at: string | null
          completion_analysis_outcome: string | null
          completion_delivery_count: number | null
          completion_incident_status: string | null
          completion_lease_token_hash: string | null
          completion_request_hash: string | null
          created_at: string
          incident_id: string
          last_error_class: string | null
          last_error_code: string | null
          lease_expires_at: string | null
          lease_owner: string | null
          lease_token_hash: string | null
          max_attempts: number
          next_attempt_at: string
          outage_count: number
          state: string
          terminal_at: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          completion_analysis_outcome?: string | null
          completion_delivery_count?: number | null
          completion_incident_status?: string | null
          completion_lease_token_hash?: string | null
          completion_request_hash?: string | null
          created_at?: string
          incident_id: string
          last_error_class?: string | null
          last_error_code?: string | null
          lease_expires_at?: string | null
          lease_owner?: string | null
          lease_token_hash?: string | null
          max_attempts?: number
          next_attempt_at?: string
          outage_count?: number
          state?: string
          terminal_at?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          completion_analysis_outcome?: string | null
          completion_delivery_count?: number | null
          completion_incident_status?: string | null
          completion_lease_token_hash?: string | null
          completion_request_hash?: string | null
          created_at?: string
          incident_id?: string
          last_error_class?: string | null
          last_error_code?: string | null
          lease_expires_at?: string | null
          lease_owner?: string | null
          lease_token_hash?: string | null
          max_attempts?: number
          next_attempt_at?: string
          outage_count?: number
          state?: string
          terminal_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_incident_analysis_jobs_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "v2_incident_context"
            referencedColumns: ["incident_id"]
          },
        ]
      }
      v2_incident_context: {
        Row: {
          aad_version: number
          created_at: string
          encrypted_payload: string
          encryption_algorithm: string
          expires_at: string
          incident_id: string
          key_version: number
          message_count: number
          privacy_identity_version: number
        }
        Insert: {
          aad_version?: number
          created_at?: string
          encrypted_payload: string
          encryption_algorithm: string
          expires_at: string
          incident_id: string
          key_version: number
          message_count: number
          privacy_identity_version?: number
        }
        Update: {
          aad_version?: number
          created_at?: string
          encrypted_payload?: string
          encryption_algorithm?: string
          expires_at?: string
          incident_id?: string
          key_version?: number
          message_count?: number
          privacy_identity_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "v2_incident_context_encryption_key_fk"
            columns: ["key_version", "encryption_algorithm"]
            isOneToOne: false
            referencedRelation: "v2_incident_encryption_keys"
            referencedColumns: ["key_version", "algorithm"]
          },
          {
            foreignKeyName: "v2_incident_context_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "v2_safety_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_incident_encryption_keys: {
        Row: {
          activates_at: string
          algorithm: string
          created_at: string
          key_version: number
          public_key_pem: string
          retires_at: string | null
          status: string
        }
        Insert: {
          activates_at?: string
          algorithm: string
          created_at?: string
          key_version: number
          public_key_pem: string
          retires_at?: string | null
          status: string
        }
        Update: {
          activates_at?: string
          algorithm?: string
          created_at?: string
          key_version?: number
          public_key_pem?: string
          retires_at?: string | null
          status?: string
        }
        Relationships: []
      }
      v2_monitoring_alert_deliveries: {
        Row: {
          acknowledged_at: string | null
          alert_type: string
          attempted_at: string | null
          created_at: string
          delivered_at: string | null
          failure_code: string | null
          guardian_user_id: string
          id: string
          idempotency_key: string
          opened_at: string | null
          provider_message_id: string | null
          severity: string
          status: string
          transition_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          alert_type: string
          attempted_at?: string | null
          created_at?: string
          delivered_at?: string | null
          failure_code?: string | null
          guardian_user_id: string
          id?: string
          idempotency_key: string
          opened_at?: string | null
          provider_message_id?: string | null
          severity: string
          status?: string
          transition_id: string
        }
        Update: {
          acknowledged_at?: string | null
          alert_type?: string
          attempted_at?: string | null
          created_at?: string
          delivered_at?: string | null
          failure_code?: string | null
          guardian_user_id?: string
          id?: string
          idempotency_key?: string
          opened_at?: string | null
          provider_message_id?: string | null
          severity?: string
          status?: string
          transition_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_monitoring_alert_deliveries_transition_id_fkey"
            columns: ["transition_id"]
            isOneToOne: false
            referencedRelation: "v2_device_monitoring_transitions"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_pairing_sessions: {
        Row: {
          attempts: number
          child_id: string
          code_hash: string
          consumed_at: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          max_attempts: number
        }
        Insert: {
          attempts?: number
          child_id: string
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          max_attempts?: number
        }
        Update: {
          attempts?: number
          child_id?: string
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          max_attempts?: number
        }
        Relationships: [
          {
            foreignKeyName: "v2_pairing_sessions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v2_children"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_parental_app_policies: {
        Row: {
          always_allowed: boolean
          app_name: string | null
          child_id: string
          created_at: string
          daily_limit_minutes: number | null
          id: string
          package_name: string
          policy_status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          always_allowed?: boolean
          app_name?: string | null
          child_id: string
          created_at?: string
          daily_limit_minutes?: number | null
          id?: string
          package_name: string
          policy_status: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          always_allowed?: boolean
          app_name?: string | null
          child_id?: string
          created_at?: string
          daily_limit_minutes?: number | null
          id?: string
          package_name?: string
          policy_status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_parental_app_policies_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v2_children"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_parental_app_usage_daily: {
        Row: {
          app_name: string | null
          device_id: string
          observed_at: string
          package_name: string
          updated_at: string
          usage_date: string
          usage_minutes: number
        }
        Insert: {
          app_name?: string | null
          device_id: string
          observed_at: string
          package_name: string
          updated_at?: string
          usage_date: string
          usage_minutes: number
        }
        Update: {
          app_name?: string | null
          device_id?: string
          observed_at?: string
          package_name?: string
          updated_at?: string
          usage_date?: string
          usage_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "v2_parental_app_usage_daily_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "v2_protected_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_parental_blocked_attempts: {
        Row: {
          app_name: string | null
          attempted_at: string
          device_id: string
          event_key: string
          id: string
          package_name: string
          received_at: string
        }
        Insert: {
          app_name?: string | null
          attempted_at: string
          device_id: string
          event_key: string
          id?: string
          package_name: string
          received_at?: string
        }
        Update: {
          app_name?: string | null
          attempted_at?: string
          device_id?: string
          event_key?: string
          id?: string
          package_name?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_parental_blocked_attempts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "v2_protected_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_parental_bonus_grants: {
        Row: {
          bonus_minutes: number
          child_id: string
          created_at: string
          grant_date: string
          granted_by: string
          id: string
          request_key: string
        }
        Insert: {
          bonus_minutes: number
          child_id: string
          created_at?: string
          grant_date?: string
          granted_by: string
          id?: string
          request_key: string
        }
        Update: {
          bonus_minutes?: number
          child_id?: string
          created_at?: string
          grant_date?: string
          granted_by?: string
          id?: string
          request_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_parental_bonus_grants_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v2_children"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_parental_device_state: {
        Row: {
          device_id: string
          event_key: string
          latitude: number | null
          location_accuracy_meters: number | null
          location_address: string | null
          location_observed_at: string | null
          longitude: number | null
          observed_at: string
          received_at: string
          settings_revision_applied: number
          total_screen_minutes: number | null
          updated_at: string
          usage_date: string | null
        }
        Insert: {
          device_id: string
          event_key: string
          latitude?: number | null
          location_accuracy_meters?: number | null
          location_address?: string | null
          location_observed_at?: string | null
          longitude?: number | null
          observed_at: string
          received_at?: string
          settings_revision_applied?: number
          total_screen_minutes?: number | null
          updated_at?: string
          usage_date?: string | null
        }
        Update: {
          device_id?: string
          event_key?: string
          latitude?: number | null
          location_accuracy_meters?: number | null
          location_address?: string | null
          location_observed_at?: string | null
          longitude?: number | null
          observed_at?: string
          received_at?: string
          settings_revision_applied?: number
          total_screen_minutes?: number | null
          updated_at?: string
          usage_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_parental_device_state_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: true
            referencedRelation: "v2_protected_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_parental_geofence_events: {
        Row: {
          device_id: string
          event_key: string
          geofence_id: string
          id: string
          latitude: number | null
          location_accuracy_meters: number | null
          longitude: number | null
          occurred_at: string
          received_at: string
          transition: string
        }
        Insert: {
          device_id: string
          event_key: string
          geofence_id: string
          id?: string
          latitude?: number | null
          location_accuracy_meters?: number | null
          longitude?: number | null
          occurred_at: string
          received_at?: string
          transition: string
        }
        Update: {
          device_id?: string
          event_key?: string
          geofence_id?: string
          id?: string
          latitude?: number | null
          location_accuracy_meters?: number | null
          longitude?: number | null
          occurred_at?: string
          received_at?: string
          transition?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_parental_geofence_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "v2_protected_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_parental_geofence_events_geofence_id_fkey"
            columns: ["geofence_id"]
            isOneToOne: false
            referencedRelation: "v2_parental_geofences"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_parental_geofences: {
        Row: {
          alert_on_enter: boolean
          alert_on_exit: boolean
          child_id: string
          created_at: string
          days_of_week: number[] | null
          end_time: string | null
          id: string
          is_active: boolean
          label: string | null
          latitude: number
          longitude: number
          place_type: string
          radius_meters: number
          schedule_mode: string
          start_time: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alert_on_enter?: boolean
          alert_on_exit?: boolean
          child_id: string
          created_at?: string
          days_of_week?: number[] | null
          end_time?: string | null
          id: string
          is_active?: boolean
          label?: string | null
          latitude: number
          longitude: number
          place_type?: string
          radius_meters: number
          schedule_mode?: string
          start_time?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alert_on_enter?: boolean
          alert_on_exit?: boolean
          child_id?: string
          created_at?: string
          days_of_week?: number[] | null
          end_time?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          latitude?: number
          longitude?: number
          place_type?: string
          radius_meters?: number
          schedule_mode?: string
          start_time?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_parental_geofences_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v2_children"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_parental_installed_apps: {
        Row: {
          app_name: string | null
          device_id: string
          first_seen_at: string
          is_installed: boolean
          is_system: boolean
          last_seen_at: string
          package_name: string
        }
        Insert: {
          app_name?: string | null
          device_id: string
          first_seen_at?: string
          is_installed?: boolean
          is_system?: boolean
          last_seen_at?: string
          package_name: string
        }
        Update: {
          app_name?: string | null
          device_id?: string
          first_seen_at?: string
          is_installed?: boolean
          is_system?: boolean
          last_seen_at?: string
          package_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_parental_installed_apps_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "v2_protected_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_parental_schedules: {
        Row: {
          child_id: string
          created_at: string
          days_of_week: number[] | null
          end_time: string | null
          id: string
          is_active: boolean
          mode: string
          name: string
          schedule_type: string
          start_time: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          child_id: string
          created_at?: string
          days_of_week?: number[] | null
          end_time?: string | null
          id: string
          is_active?: boolean
          mode?: string
          name: string
          schedule_type: string
          start_time?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          child_id?: string
          created_at?: string
          days_of_week?: number[] | null
          end_time?: string | null
          id?: string
          is_active?: boolean
          mode?: string
          name?: string
          schedule_type?: string
          start_time?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_parental_schedules_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v2_children"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_parental_settings: {
        Row: {
          child_id: string
          created_at: string
          daily_screen_time_limit_minutes: number | null
          exit_debounce_seconds: number
          home_exit_alert_enabled: boolean
          location_tracking_enabled: boolean
          location_update_interval_minutes: number
          lost_mode_enabled: boolean
          lost_mode_message: string | null
          revision: number
          school_exit_alert_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          child_id: string
          created_at?: string
          daily_screen_time_limit_minutes?: number | null
          exit_debounce_seconds?: number
          home_exit_alert_enabled?: boolean
          location_tracking_enabled?: boolean
          location_update_interval_minutes?: number
          lost_mode_enabled?: boolean
          lost_mode_message?: string | null
          revision?: number
          school_exit_alert_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          child_id?: string
          created_at?: string
          daily_screen_time_limit_minutes?: number | null
          exit_debounce_seconds?: number
          home_exit_alert_enabled?: boolean
          location_tracking_enabled?: boolean
          location_update_interval_minutes?: number
          lost_mode_enabled?: boolean
          lost_mode_message?: string | null
          revision?: number
          school_exit_alert_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_parental_settings_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: true
            referencedRelation: "v2_children"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_parental_time_requests: {
        Row: {
          approved_minutes: number | null
          child_id: string
          created_at: string
          device_id: string
          expires_at: string
          id: string
          reason: string | null
          requested_minutes: number
          responded_at: string | null
          responded_by: string | null
          status: string
        }
        Insert: {
          approved_minutes?: number | null
          child_id: string
          created_at?: string
          device_id: string
          expires_at: string
          id: string
          reason?: string | null
          requested_minutes: number
          responded_at?: string | null
          responded_by?: string | null
          status?: string
        }
        Update: {
          approved_minutes?: number | null
          child_id?: string
          created_at?: string
          device_id?: string
          expires_at?: string
          id?: string
          reason?: string | null
          requested_minutes?: number
          responded_at?: string | null
          responded_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_parental_time_requests_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v2_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_parental_time_requests_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "v2_protected_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_protected_devices: {
        Row: {
          app_version: string
          capture_contract_version: number
          child_id: string
          created_at: string
          id: string
          installation_id: string
          last_seen_at: string | null
          manufacturer: string | null
          model: string | null
          platform: string
          registered_at: string
          status: string
          updated_at: string
        }
        Insert: {
          app_version: string
          capture_contract_version?: number
          child_id: string
          created_at?: string
          id?: string
          installation_id: string
          last_seen_at?: string | null
          manufacturer?: string | null
          model?: string | null
          platform?: string
          registered_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          app_version?: string
          capture_contract_version?: number
          child_id?: string
          created_at?: string
          id?: string
          installation_id?: string
          last_seen_at?: string | null
          manufacturer?: string | null
          model?: string | null
          platform?: string
          registered_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_protected_devices_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v2_children"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_push_delivery_endpoint_attempts: {
        Row: {
          attempt_count: number
          created_at: string
          delivery_id: string
          endpoint_id: string
          last_attempt_at: string | null
          last_error_code: string | null
          last_http_status: number | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          delivery_id: string
          endpoint_id: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          last_http_status?: number | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          delivery_id?: string
          endpoint_id?: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          last_http_status?: number | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_push_delivery_endpoint_attempts_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "v2_alert_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_push_delivery_endpoint_attempts_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "v2_guardian_push_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_push_worker_capabilities: {
        Row: {
          created_at: string
          expires_at: string
          label: string
          revoked_at: string | null
          status: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          label: string
          revoked_at?: string | null
          status?: string
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          label?: string
          revoked_at?: string | null
          status?: string
          token_hash?: string
        }
        Relationships: []
      }
      v2_safety_incidents: {
        Row: {
          capture_quality: number
          category: string
          child_id: string
          child_role: string
          client_incident_id: string
          confidence: number
          device_id: string
          id: string
          model_contract_version: number
          occurred_at: string
          privacy_contract_version: number
          received_at: string
          severity: string
          source_platform: string
          status: string
        }
        Insert: {
          capture_quality: number
          category: string
          child_id: string
          child_role: string
          client_incident_id: string
          confidence: number
          device_id: string
          id?: string
          model_contract_version?: number
          occurred_at: string
          privacy_contract_version?: number
          received_at?: string
          severity: string
          source_platform?: string
          status?: string
        }
        Update: {
          capture_quality?: number
          category?: string
          child_id?: string
          child_role?: string
          client_incident_id?: string
          confidence?: number
          device_id?: string
          id?: string
          model_contract_version?: number
          occurred_at?: string
          privacy_contract_version?: number
          received_at?: string
          severity?: string
          source_platform?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_safety_incidents_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v2_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_safety_incidents_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "v2_protected_devices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      v2_action_matches_severity: {
        Args: {
          target_action_code: string
          target_outcome: string
          target_severity: string
        }
        Returns: boolean
      }
      v2_activate_child_install_session_service: {
        Args: { supplied_activation_token_hash: string }
        Returns: {
          expires_at: string
          guardian_user_id: string
          install_session_id: string
          should_send_otp: boolean
        }[]
      }
      v2_analyzer_capability_is_valid: {
        Args: { target_capability_token: string }
        Returns: boolean
      }
      v2_bootstrap_guardian: {
        Args: {
          target_display_name: string
          target_family_id: string
          target_phone: string
          target_request_key: string
        }
        Returns: {
          created: boolean
          family_id: string
        }[]
      }
      v2_bump_parental_revision_service: {
        Args: { target_actor: string; target_child_id: string }
        Returns: number
      }
      v2_claim_device_commands_service: {
        Args: { requested_limit?: number; target_device_id: string }
        Returns: {
          command_type: string
          expires_at: string
          id: string
          payload: Json
        }[]
      }
      v2_claim_incident_analysis_service: {
        Args: {
          target_capability_token: string
          target_lease_seconds: number
          target_worker_id: string
        }
        Returns: {
          aad_version: number
          capture_quality_canonical: string
          category: string
          child_id: string
          child_role: string
          client_incident_id: string
          confidence_canonical: string
          context_expires_at_canonical: string
          device_id: string
          encrypted_payload_base64: string
          encryption_algorithm: string
          incident_id: string
          key_version: number
          lease_expires_at_canonical: string
          lease_token: string
          message_count: number
          model_contract_version: number
          occurred_at_canonical: string
          privacy_contract_version: number
          privacy_identity_version: number
          severity: string
        }[]
      }
      v2_claim_push_delivery_service: {
        Args: {
          target_capability_token: string
          target_lease_seconds?: number
          target_worker_id: string
        }
        Returns: {
          attempt_number: number
          delivery_id: string
          incident_id: string
          lease_token: string
          targets: Json
        }[]
      }
      v2_complete_child_install_service: {
        Args: {
          actor_user_id: string
          credential_expires_at: string
          new_credential_hash: string
          target_app_version: string
          target_capture_contract_version: number
          target_installation_id: string
          target_manufacturer: string
          target_model: string
        }
        Returns: {
          child_id: string
          credential_expiry: string
          credential_key_version: number
          device_id: string
        }[]
      }
      v2_complete_pairing_service: {
        Args: {
          credential_expires_at: string
          new_credential_hash: string
          supplied_code_hash: string
          target_app_version: string
          target_capture_contract_version: number
          target_installation_id: string
          target_manufacturer: string
          target_model: string
          target_pairing_id: string
        }
        Returns: {
          child_id: string
          credential_expiry: string
          credential_key_version: number
          device_id: string
        }[]
      }
      v2_complete_push_delivery_service: {
        Args: {
          target_capability_token: string
          target_delivery_id: string
          target_lease_token: string
          target_results: Json
          target_worker_id: string
        }
        Returns: {
          delivery_status: string
          invalid_target_count: number
          retry_scheduled: boolean
          sent_target_count: number
        }[]
      }
      v2_create_child_install_session_service: {
        Args: {
          actor_user_id: string
          new_activation_token_hash: string
          target_child_id: string
          target_expires_at: string
          target_session_id: string
        }
        Returns: {
          expires_at: string
          install_session_id: string
        }[]
      }
      v2_create_guardian_child:
        | {
            Args: {
              target_birth_year: number
              target_child_id: string
              target_display_name: string
              target_family_id: string
              target_gender: string
              target_request_key: string
            }
            Returns: {
              birth_year: number
              child_id: string
              created: boolean
              display_name: string
              family_id: string
              gender: string
              status: string
            }[]
          }
        | {
            Args: {
              target_birth_year: number
              target_child_id: string
              target_display_name: string
              target_family_id: string
              target_request_key: string
            }
            Returns: {
              birth_year: number
              child_id: string
              created: boolean
              display_name: string
              family_id: string
              status: string
            }[]
          }
      v2_create_pairing_session_service: {
        Args: {
          actor_user_id: string
          new_code_hash: string
          target_child_id: string
          target_expires_at: string
          target_pairing_id: string
        }
        Returns: {
          expires_at: string
          pairing_id: string
        }[]
      }
      v2_create_parental_time_request_service: {
        Args: {
          requested_minutes: number
          target_device_id: string
          target_expires_at: string
          target_reason: string
          target_request_id: string
        }
        Returns: boolean
      }
      v2_delete_expired_incident_context_service: {
        Args: { requested_limit?: number }
        Returns: number
      }
      v2_delete_parental_geofence: {
        Args: {
          target_child_id: string
          target_geofence_id: string
          target_request_key: string
        }
        Returns: number
      }
      v2_delete_parental_schedule: {
        Args: {
          target_child_id: string
          target_request_key: string
          target_schedule_id: string
        }
        Returns: number
      }
      v2_dispatch_expert_analyzer_internal: {
        Args: { target_max_requests?: number }
        Returns: number
      }
      v2_dispatch_push_worker_internal: {
        Args: { target_max_requests?: number }
        Returns: number
      }
      v2_enqueue_monitoring_alerts_service: {
        Args: { target_transition_id: string }
        Returns: undefined
      }
      v2_enqueue_refresh_for_child_service: {
        Args: {
          target_actor: string
          target_child_id: string
          target_request_key: string
          target_revision: number
        }
        Returns: number
      }
      v2_finalize_incident_analysis_internal: {
        Args: {
          target_action_code: string
          target_analysis_contract_version: number
          target_expert_category: string
          target_incident_id: string
          target_model_name: string
          target_model_provider: string
          target_model_version: string
          target_outcome: string
          target_prompt_version: string
          target_reason_code: string
        }
        Returns: {
          analysis_outcome: string
          delivery_count: number
          incident_status: string
        }[]
      }
      v2_finalize_incident_analysis_service: {
        Args: {
          target_action_code: string
          target_capability_token: string
          target_evidence_segment_refs: string[]
          target_expert_category: string
          target_expert_child_role: string
          target_expert_confidence: number
          target_expert_pattern: string
          target_expert_severity: string
          target_expert_urgency: string
          target_incident_id: string
          target_lease_token: string
          target_model_version: string
          target_outcome: string
          target_policy_channels: string[]
          target_reason_code: string
          target_secondary_categories: string[]
          target_worker_id: string
        }
        Returns: {
          analysis_outcome: string
          delivery_count: number
          incident_status: string
        }[]
      }
      v2_finish_device_command_service: {
        Args: {
          target_command_id: string
          target_device_id: string
          target_failure_code?: string
          target_status: string
        }
        Returns: boolean
      }
      v2_get_active_incident_encryption_key_service: {
        Args: never
        Returns: {
          accepts_until: string
          algorithm: string
          key_version: number
          public_key_pem: string
        }[]
      }
      v2_get_guardian_push_state: {
        Args: { target_installation_id: string }
        Returns: {
          endpoint_status: string
          is_subscribed: boolean
          last_seen_at: string
          permission_state: string
        }[]
      }
      v2_grant_parent_bonus_time: {
        Args: {
          requested_minutes: number
          target_child_id: string
          target_request_key: string
        }
        Returns: {
          created: boolean
          grant_id: string
          settings_revision: number
        }[]
      }
      v2_guardian_can_read_confirmed_incident: {
        Args: { target_incident_id: string }
        Returns: boolean
      }
      v2_is_child_guardian: {
        Args: { target_child_id: string }
        Returns: boolean
      }
      v2_is_device_guardian: {
        Args: { target_device_id: string }
        Returns: boolean
      }
      v2_is_family_guardian: {
        Args: { target_family_id: string }
        Returns: boolean
      }
      v2_parent_action_template: {
        Args: { target_action_code: string }
        Returns: string
      }
      v2_parent_reason_template: {
        Args: { target_reason_code: string }
        Returns: string
      }
      v2_parent_summary_template: {
        Args: { target_category: string }
        Returns: string
      }
      v2_parental_settings_snapshot_service: {
        Args: { target_device_id: string }
        Returns: Json
      }
      v2_push_worker_capability_is_valid: {
        Args: { target_capability_token: string }
        Returns: boolean
      }
      v2_reap_incident_analysis_jobs_internal: { Args: never; Returns: number }
      v2_reason_matches_category: {
        Args: {
          target_category: string
          target_outcome: string
          target_reason_code: string
        }
        Returns: boolean
      }
      v2_record_incident_analysis_failure_service: {
        Args: {
          target_capability_token: string
          target_error_code: string
          target_failure_class: string
          target_incident_id: string
          target_lease_token: string
          target_retryable: boolean
          target_worker_id: string
        }
        Returns: {
          attempt_count: number
          job_state: string
        }[]
      }
      v2_register_device_service: {
        Args: {
          actor_user_id: string
          credential_expires_at: string
          new_credential_hash: string
          target_app_version: string
          target_capture_contract_version: number
          target_child_id: string
          target_installation_id: string
          target_manufacturer: string
          target_model: string
        }
        Returns: {
          credential_expiry: string
          credential_key_version: number
          device_id: string
        }[]
      }
      v2_register_guardian_push_endpoint: {
        Args: {
          target_auth_secret: string
          target_endpoint: string
          target_installation_id: string
          target_locale: string
          target_p256dh: string
          target_user_agent: string
        }
        Returns: {
          endpoint_id: string
          endpoint_last_seen_at: string
          endpoint_status: string
        }[]
      }
      v2_report_device_health_service: {
        Args: {
          target_accessibility_enabled: boolean
          target_battery_optimization_exempt: boolean
          target_capture_ready: boolean
          target_degraded_reasons: string[]
          target_device_id: string
          target_event_key: string
          target_notification_listener_enabled: boolean
          target_observed_at: string
          target_oem_autostart_state: string
        }
        Returns: boolean
      }
      v2_report_device_health_v2_service: {
        Args: {
          target_accessibility_enabled: boolean
          target_app_version: string
          target_battery_level_percent: number
          target_battery_optimization_exempt: boolean
          target_boot_session_id: string
          target_capabilities: Json
          target_capture_ready: boolean
          target_contract_version: number
          target_degraded_reasons: string[]
          target_device_id: string
          target_event_key: string
          target_expected_interval_seconds: number
          target_notification_listener_enabled: boolean
          target_observed_at: string
          target_oem_autostart_state: string
          target_product_ready: boolean
          target_report_reason: string
          target_sequence_no: number
        }
        Returns: {
          accepted: boolean
          affects_current_state: boolean
          duplicate: boolean
          monitoring_state: string
          state_version: number
        }[]
      }
      v2_report_geofence_events_service: {
        Args: { target_device_id: string; target_events: Json }
        Returns: number
      }
      v2_report_parental_state_service: {
        Args: {
          target_app_usage: Json
          target_blocked_attempts: Json
          target_device_id: string
          target_event_key: string
          target_installed_apps: Json
          target_latitude: number
          target_location_accuracy_meters: number
          target_location_address: string
          target_location_observed_at: string
          target_longitude: number
          target_observed_at: string
          target_settings_revision: number
          target_total_screen_minutes: number
          target_usage_date: string
        }
        Returns: {
          accepted: boolean
          affects_current_state: boolean
        }[]
      }
      v2_request_parental_command: {
        Args: {
          requested_ttl_seconds?: number
          target_command_type: string
          target_device_id: string
          target_payload: Json
          target_request_key: string
        }
        Returns: {
          command_type: string
          created_at: string
          expires_at: string
          id: string
          status: string
        }[]
      }
      v2_require_parental_request_key_service: {
        Args: { target_request_key: string }
        Returns: undefined
      }
      v2_respond_parental_time_request: {
        Args: {
          target_approved: boolean
          target_approved_minutes: number
          target_request_id: string
          target_request_key: string
        }
        Returns: number
      }
      v2_revoke_guardian_push_endpoint: {
        Args: {
          target_installation_id: string
          target_permission_state?: string
        }
        Returns: boolean
      }
      v2_set_geofence_preferences: {
        Args: {
          target_child_id: string
          target_exit_debounce_seconds: number
          target_home_exit_alert_enabled: boolean
          target_request_key: string
          target_school_exit_alert_enabled: boolean
        }
        Returns: number
      }
      v2_set_guardian_incident_state: {
        Args: {
          target_incident_id: string
          target_request_key: string
          target_state: string
        }
        Returns: {
          acknowledged_at: string
          guardian_user_id: string
          incident_id: string
          saved_at: string
          state: string
          updated_at: string
        }[]
      }
      v2_set_lost_mode: {
        Args: {
          target_child_id: string
          target_enabled: boolean
          target_message: string
          target_request_key: string
        }
        Returns: number
      }
      v2_set_parental_app_policy: {
        Args: {
          target_always_allowed: boolean
          target_app_name: string
          target_child_id: string
          target_daily_limit_minutes: number
          target_package_name: string
          target_policy_status: string
          target_request_key: string
        }
        Returns: number
      }
      v2_set_screen_time_limit: {
        Args: {
          requested_minutes: number
          target_child_id: string
          target_request_key: string
        }
        Returns: number
      }
      v2_submit_safety_incident_service: {
        Args: {
          target_capture_quality: number
          target_category: string
          target_child_role: string
          target_client_incident_id: string
          target_confidence: number
          target_context_expires_at: string
          target_device_id: string
          target_encrypted_payload_base64: string
          target_encryption_algorithm: string
          target_key_version: number
          target_message_count: number
          target_model_contract_version: number
          target_occurred_at: string
          target_privacy_contract_version: number
          target_privacy_identity_version: number
          target_severity: string
        }
        Returns: {
          created: boolean
          incident_id: string
        }[]
      }
      v2_sweep_monitoring_liveness_service: {
        Args: { target_now?: string }
        Returns: number
      }
      v2_update_guardian_profile: {
        Args: {
          target_display_name: string
          target_phone: string
          target_request_key: string
        }
        Returns: {
          display_name: string
          phone: string
          updated_at: string
        }[]
      }
      v2_upsert_parental_geofence: {
        Args: {
          target_alert_on_enter: boolean
          target_alert_on_exit: boolean
          target_child_id: string
          target_days_of_week: number[]
          target_end_time: string
          target_geofence_id: string
          target_is_active: boolean
          target_label: string
          target_latitude: number
          target_longitude: number
          target_place_type: string
          target_radius_meters: number
          target_request_key: string
          target_schedule_mode: string
          target_start_time: string
        }
        Returns: number
      }
      v2_upsert_parental_schedule: {
        Args: {
          target_child_id: string
          target_days_of_week: number[]
          target_end_time: string
          target_is_active: boolean
          target_mode: string
          target_name: string
          target_request_key: string
          target_schedule_id: string
          target_schedule_type: string
          target_start_time: string
        }
        Returns: number
      }
      v2_v3_action_for_inference: {
        Args: {
          target_outcome: string
          target_primary_category: string
          target_severity: string
          target_urgency: string
        }
        Returns: string
      }
      v2_v3_channels_for_inference: {
        Args: {
          target_outcome: string
          target_severity: string
          target_urgency: string
        }
        Returns: string[]
      }
      v2_v3_reason_for_inference: {
        Args: { target_outcome: string; target_primary_category: string }
        Returns: string
      }
      v2_valid_expert_secondary_categories: {
        Args: {
          target_primary_category: string
          target_secondary_categories: string[]
        }
        Returns: boolean
      }
      v2_valid_segment_refs: {
        Args: { target_refs: string[] }
        Returns: boolean
      }
      v2_valid_web_push_endpoint: {
        Args: { target_endpoint: string }
        Returns: boolean
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
