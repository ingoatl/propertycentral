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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accommodation_requests: {
        Row: {
          created_at: string | null
          decision_date: string | null
          decision_made_by: string | null
          decision_reason: string | null
          documentation_path: string | null
          documentation_received: boolean | null
          id: string
          interactive_process_notes: string | null
          notes: string | null
          property_id: string | null
          request_date: string
          request_description: string | null
          request_type: string | null
          status: string | null
          tenant_email: string | null
          tenant_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          decision_date?: string | null
          decision_made_by?: string | null
          decision_reason?: string | null
          documentation_path?: string | null
          documentation_received?: boolean | null
          id?: string
          interactive_process_notes?: string | null
          notes?: string | null
          property_id?: string | null
          request_date: string
          request_description?: string | null
          request_type?: string | null
          status?: string | null
          tenant_email?: string | null
          tenant_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          decision_date?: string | null
          decision_made_by?: string | null
          decision_reason?: string | null
          documentation_path?: string | null
          documentation_received?: boolean | null
          id?: string
          interactive_process_notes?: string | null
          notes?: string | null
          property_id?: string | null
          request_date?: string
          request_description?: string | null
          request_type?: string | null
          status?: string | null
          tenant_email?: string | null
          tenant_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accommodation_requests_decision_made_by_fkey"
            columns: ["decision_made_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accommodation_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accommodation_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_draft_replies: {
        Row: {
          communication_id: string | null
          confidence_score: number | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          dismissed_at: string | null
          draft_content: string
          id: string
          lead_id: string | null
          message_type: string
          owner_id: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          communication_id?: string | null
          confidence_score?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          dismissed_at?: string | null
          draft_content: string
          id?: string
          lead_id?: string | null
          message_type?: string
          owner_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          communication_id?: string | null
          confidence_score?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          dismissed_at?: string | null
          draft_content?: string
          id?: string
          lead_id?: string | null
          message_type?: string
          owner_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_draft_replies_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "lead_communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_draft_replies_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_draft_replies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_response_feedback: {
        Row: {
          context_json: Json | null
          created_at: string | null
          created_by: string | null
          edit_type: string | null
          edited_response: string | null
          id: string
          knowledge_used: Json | null
          original_response: string | null
        }
        Insert: {
          context_json?: Json | null
          created_at?: string | null
          created_by?: string | null
          edit_type?: string | null
          edited_response?: string | null
          id?: string
          knowledge_used?: Json | null
          original_response?: string | null
        }
        Update: {
          context_json?: Json | null
          created_at?: string | null
          created_by?: string | null
          edit_type?: string | null
          edited_response?: string | null
          id?: string
          knowledge_used?: Json | null
          original_response?: string | null
        }
        Relationships: []
      }
      ai_response_quality: {
        Row: {
          communication_id: string | null
          contact_id: string | null
          contact_type: string
          context_summary: Json | null
          created_at: string | null
          edit_distance: number | null
          final_response: string | null
          generated_response: string
          generation_time_ms: number | null
          id: string
          incoming_message: string | null
          knowledge_entries_used: Json | null
          message_type: string
          model_used: string | null
          quality_score: number | null
          questions_answered: Json | null
          questions_detected: Json | null
          sentiment_detected: string | null
          tone_profile_used: Json | null
          user_id: string | null
          validation_issues: Json | null
          was_sent_as_is: boolean | null
        }
        Insert: {
          communication_id?: string | null
          contact_id?: string | null
          contact_type: string
          context_summary?: Json | null
          created_at?: string | null
          edit_distance?: number | null
          final_response?: string | null
          generated_response: string
          generation_time_ms?: number | null
          id?: string
          incoming_message?: string | null
          knowledge_entries_used?: Json | null
          message_type: string
          model_used?: string | null
          quality_score?: number | null
          questions_answered?: Json | null
          questions_detected?: Json | null
          sentiment_detected?: string | null
          tone_profile_used?: Json | null
          user_id?: string | null
          validation_issues?: Json | null
          was_sent_as_is?: boolean | null
        }
        Update: {
          communication_id?: string | null
          contact_id?: string | null
          contact_type?: string
          context_summary?: Json | null
          created_at?: string | null
          edit_distance?: number | null
          final_response?: string | null
          generated_response?: string
          generation_time_ms?: number | null
          id?: string
          incoming_message?: string | null
          knowledge_entries_used?: Json | null
          message_type?: string
          model_used?: string | null
          quality_score?: number | null
          questions_answered?: Json | null
          questions_detected?: Json | null
          sentiment_detected?: string | null
          tone_profile_used?: Json | null
          user_id?: string | null
          validation_issues?: Json | null
          was_sent_as_is?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_response_quality_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "lead_communications"
            referencedColumns: ["id"]
          },
        ]
      }
      appliance_warranties: {
        Row: {
          appliance_type: string
          brand: string | null
          coverage_details: string | null
          created_at: string | null
          created_by: string | null
          deductible: number | null
          id: string
          installation_date: string | null
          max_coverage: number | null
          model_number: string | null
          notes: string | null
          photo_path: string | null
          policy_number: string | null
          property_id: string
          purchase_date: string | null
          receipt_path: string | null
          serial_number: string | null
          updated_at: string | null
          warranty_email: string | null
          warranty_expiration: string | null
          warranty_phone: string | null
          warranty_provider: string | null
          warranty_start_date: string | null
          warranty_type: string | null
        }
        Insert: {
          appliance_type: string
          brand?: string | null
          coverage_details?: string | null
          created_at?: string | null
          created_by?: string | null
          deductible?: number | null
          id?: string
          installation_date?: string | null
          max_coverage?: number | null
          model_number?: string | null
          notes?: string | null
          photo_path?: string | null
          policy_number?: string | null
          property_id: string
          purchase_date?: string | null
          receipt_path?: string | null
          serial_number?: string | null
          updated_at?: string | null
          warranty_email?: string | null
          warranty_expiration?: string | null
          warranty_phone?: string | null
          warranty_provider?: string | null
          warranty_start_date?: string | null
          warranty_type?: string | null
        }
        Update: {
          appliance_type?: string
          brand?: string | null
          coverage_details?: string | null
          created_at?: string | null
          created_by?: string | null
          deductible?: number | null
          id?: string
          installation_date?: string | null
          max_coverage?: number | null
          model_number?: string | null
          notes?: string | null
          photo_path?: string | null
          policy_number?: string | null
          property_id?: string
          purchase_date?: string | null
          receipt_path?: string | null
          serial_number?: string | null
          updated_at?: string | null
          warranty_email?: string | null
          warranty_expiration?: string | null
          warranty_phone?: string | null
          warranty_provider?: string | null
          warranty_start_date?: string | null
          warranty_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appliance_warranties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appliance_warranties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_reschedule_logs: {
        Row: {
          appointment_id: string
          appointment_type: string
          created_at: string
          google_calendar_updated: boolean | null
          id: string
          new_scheduled_at: string
          notification_sent: boolean | null
          notification_sent_at: string | null
          previous_scheduled_at: string
          reason: string | null
          reschedule_notes: string | null
          rescheduled_by: string | null
          rescheduled_by_name: string | null
          rescheduled_by_type: string
        }
        Insert: {
          appointment_id: string
          appointment_type: string
          created_at?: string
          google_calendar_updated?: boolean | null
          id?: string
          new_scheduled_at: string
          notification_sent?: boolean | null
          notification_sent_at?: string | null
          previous_scheduled_at: string
          reason?: string | null
          reschedule_notes?: string | null
          rescheduled_by?: string | null
          rescheduled_by_name?: string | null
          rescheduled_by_type?: string
        }
        Update: {
          appointment_id?: string
          appointment_type?: string
          created_at?: string
          google_calendar_updated?: boolean | null
          id?: string
          new_scheduled_at?: string
          notification_sent?: boolean | null
          notification_sent_at?: string | null
          previous_scheduled_at?: string
          reason?: string | null
          reschedule_notes?: string | null
          rescheduled_by?: string | null
          rescheduled_by_name?: string | null
          rescheduled_by_type?: string
        }
        Relationships: []
      }
      audit_access_log: {
        Row: {
          accessed_at: string | null
          id: string
          ip_address: string | null
          sections_viewed: string[] | null
          token_id: string | null
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string | null
          id?: string
          ip_address?: string | null
          sections_viewed?: string[] | null
          token_id?: string | null
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string | null
          id?: string
          ip_address?: string | null
          sections_viewed?: string[] | null
          token_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_access_log_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "audit_access_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_access_tokens: {
        Row: {
          access_scope: Json | null
          accessed_count: number | null
          accessed_from_ips: string[] | null
          created_at: string | null
          created_by: string | null
          expires_at: string
          id: string
          is_active: boolean | null
          last_accessed_at: string | null
          notes: string | null
          token: string
        }
        Insert: {
          access_scope?: Json | null
          accessed_count?: number | null
          accessed_from_ips?: string[] | null
          created_at?: string | null
          created_by?: string | null
          expires_at: string
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          notes?: string | null
          token?: string
        }
        Update: {
          access_scope?: Json | null
          accessed_count?: number | null
          accessed_from_ips?: string[] | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          notes?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_access_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_slots: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          start_time: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          start_time: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          start_time?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      blocked_dates: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string
          id: string
          reason: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date: string
          id?: string
          reason?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      booking_documents: {
        Row: {
          all_signed_at: string | null
          booking_id: string | null
          completed_at: string | null
          completion_certificate_path: string | null
          contract_type: string | null
          created_at: string | null
          created_by: string | null
          document_name: string | null
          document_type: string | null
          embedded_edit_url: string | null
          field_configuration: Json | null
          google_drive_url: string | null
          guest_signed_at: string | null
          guest_signing_url: string | null
          host_signed_at: string | null
          host_signer_id: string | null
          host_signing_url: string | null
          id: string
          is_draft: boolean | null
          owner_id: string | null
          property_id: string | null
          recipient_email: string | null
          recipient_name: string | null
          sent_at: string | null
          signed_document_path: string | null
          signed_pdf_path: string | null
          signwell_document_id: string | null
          status: string | null
          template_id: string | null
        }
        Insert: {
          all_signed_at?: string | null
          booking_id?: string | null
          completed_at?: string | null
          completion_certificate_path?: string | null
          contract_type?: string | null
          created_at?: string | null
          created_by?: string | null
          document_name?: string | null
          document_type?: string | null
          embedded_edit_url?: string | null
          field_configuration?: Json | null
          google_drive_url?: string | null
          guest_signed_at?: string | null
          guest_signing_url?: string | null
          host_signed_at?: string | null
          host_signer_id?: string | null
          host_signing_url?: string | null
          id?: string
          is_draft?: boolean | null
          owner_id?: string | null
          property_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          sent_at?: string | null
          signed_document_path?: string | null
          signed_pdf_path?: string | null
          signwell_document_id?: string | null
          status?: string | null
          template_id?: string | null
        }
        Update: {
          all_signed_at?: string | null
          booking_id?: string | null
          completed_at?: string | null
          completion_certificate_path?: string | null
          contract_type?: string | null
          created_at?: string | null
          created_by?: string | null
          document_name?: string | null
          document_type?: string | null
          embedded_edit_url?: string | null
          field_configuration?: Json | null
          google_drive_url?: string | null
          guest_signed_at?: string | null
          guest_signing_url?: string | null
          host_signed_at?: string | null
          host_signer_id?: string | null
          host_signing_url?: string | null
          id?: string
          is_draft?: boolean | null
          owner_id?: string | null
          property_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          sent_at?: string | null
          signed_document_path?: string | null
          signed_pdf_path?: string | null
          signwell_document_id?: string | null
          status?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "mid_term_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_reports: {
        Row: {
          description: string
          id: string
          loom_video_url: string | null
          priority: string
          project_id: string | null
          property_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          screenshot_path: string | null
          status: string
          submitted_at: string
          submitted_by: string
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          description: string
          id?: string
          loom_video_url?: string | null
          priority?: string
          project_id?: string | null
          property_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          screenshot_path?: string | null
          status?: string
          submitted_at?: string
          submitted_by: string
          task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          description?: string
          id?: string
          loom_video_url?: string | null
          priority?: string
          project_id?: string | null
          property_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          screenshot_path?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bug_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bug_reports_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bug_reports_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bug_reports_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_sync_queue: {
        Row: {
          created_at: string
          discovery_call_id: string
          error_message: string | null
          id: string
          processed_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          discovery_call_id: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          discovery_call_id?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_sync_queue_discovery_call_id_fkey"
            columns: ["discovery_call_id"]
            isOneToOne: true
            referencedRelation: "discovery_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      charge_line_items: {
        Row: {
          amount: number
          category: string
          charge_id: string | null
          created_at: string | null
          description: string | null
          id: string
          qbo_account_code: string | null
        }
        Insert: {
          amount: number
          category: string
          charge_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          qbo_account_code?: string | null
        }
        Update: {
          amount?: number
          category?: string
          charge_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          qbo_account_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charge_line_items_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "monthly_charges"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_recipients: {
        Row: {
          communication_id: string
          created_at: string | null
          id: string
          is_read: boolean | null
          read_at: string | null
          recipient_type: string
          user_id: string
        }
        Insert: {
          communication_id: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          recipient_type: string
          user_id: string
        }
        Update: {
          communication_id?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          recipient_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_recipients_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "lead_communications"
            referencedColumns: ["id"]
          },
        ]
      }
      company_knowledge_base: {
        Row: {
          category: string
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          keywords: string[] | null
          priority: number | null
          referral_link: string | null
          source: string | null
          subcategory: string | null
          title: string
          updated_at: string | null
          use_in_contexts: string[] | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          priority?: number | null
          referral_link?: string | null
          source?: string | null
          subcategory?: string | null
          title: string
          updated_at?: string | null
          use_in_contexts?: string[] | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          priority?: number | null
          referral_link?: string | null
          source?: string | null
          subcategory?: string | null
          title?: string
          updated_at?: string | null
          use_in_contexts?: string[] | null
        }
        Relationships: []
      }
      compliance_training_log: {
        Row: {
          certificate_path: string | null
          created_at: string | null
          expiration_date: string | null
          hours_completed: number | null
          id: string
          notes: string | null
          passed: boolean | null
          training_date: string
          training_name: string
          training_provider: string | null
          training_type: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          certificate_path?: string | null
          created_at?: string | null
          expiration_date?: string | null
          hours_completed?: number | null
          id?: string
          notes?: string | null
          passed?: boolean | null
          training_date: string
          training_name: string
          training_provider?: string | null
          training_type: string
          user_id?: string | null
          user_name: string
        }
        Update: {
          certificate_path?: string | null
          created_at?: string | null
          expiration_date?: string | null
          hours_completed?: number | null
          id?: string
          notes?: string | null
          passed?: boolean | null
          training_date?: string
          training_name?: string
          training_provider?: string | null
          training_type?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_training_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_intelligence: {
        Row: {
          avg_response_time_hours: number | null
          communication_style: string | null
          contact_id: string
          contact_type: string
          created_at: string | null
          decision_making_speed: string | null
          emotional_baseline: string | null
          id: string
          interests: Json | null
          last_analyzed_at: string | null
          last_sentiment: string | null
          our_promises: Json | null
          pain_points: Json | null
          preferred_channel: string | null
          relationship_stage: string | null
          sentiment_trajectory: string | null
          topic_threads: Json | null
          total_messages_received: number | null
          total_messages_sent: number | null
          unanswered_questions: Json | null
          updated_at: string | null
        }
        Insert: {
          avg_response_time_hours?: number | null
          communication_style?: string | null
          contact_id: string
          contact_type: string
          created_at?: string | null
          decision_making_speed?: string | null
          emotional_baseline?: string | null
          id?: string
          interests?: Json | null
          last_analyzed_at?: string | null
          last_sentiment?: string | null
          our_promises?: Json | null
          pain_points?: Json | null
          preferred_channel?: string | null
          relationship_stage?: string | null
          sentiment_trajectory?: string | null
          topic_threads?: Json | null
          total_messages_received?: number | null
          total_messages_sent?: number | null
          unanswered_questions?: Json | null
          updated_at?: string | null
        }
        Update: {
          avg_response_time_hours?: number | null
          communication_style?: string | null
          contact_id?: string
          contact_type?: string
          created_at?: string | null
          decision_making_speed?: string | null
          emotional_baseline?: string | null
          id?: string
          interests?: Json | null
          last_analyzed_at?: string | null
          last_sentiment?: string | null
          our_promises?: Json | null
          pain_points?: Json | null
          preferred_channel?: string | null
          relationship_stage?: string | null
          sentiment_trajectory?: string | null
          topic_threads?: Json | null
          total_messages_received?: number | null
          total_messages_sent?: number | null
          unanswered_questions?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      conversation_notes: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_ai_generated: boolean | null
          lead_id: string | null
          note: string
          owner_id: string | null
          property_id: string | null
          summary_type: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_ai_generated?: boolean | null
          lead_id?: string | null
          note: string
          owner_id?: string | null
          property_id?: string | null
          summary_type?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_ai_generated?: boolean | null
          lead_id?: string | null
          note?: string
          owner_id?: string | null
          property_id?: string | null
          summary_type?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_notes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_notes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_notes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_status: {
        Row: {
          ai_sentiment: string | null
          ai_summary: string | null
          contact_email: string | null
          contact_id: string | null
          contact_phone: string | null
          contact_type: string
          created_at: string
          id: string
          last_inbound_at: string | null
          last_message_at: string | null
          priority: string
          snoozed_until: string | null
          status: string
          unread_count: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ai_sentiment?: string | null
          ai_summary?: string | null
          contact_email?: string | null
          contact_id?: string | null
          contact_phone?: string | null
          contact_type?: string
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          priority?: string
          snoozed_until?: string | null
          status?: string
          unread_count?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ai_sentiment?: string | null
          ai_summary?: string | null
          contact_email?: string | null
          contact_id?: string | null
          contact_phone?: string | null
          contact_type?: string
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          priority?: string
          snoozed_until?: string | null
          status?: string
          unread_count?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      conversation_summaries: {
        Row: {
          action_items: Json | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          full_summary: string | null
          id: string
          key_points: Json | null
          last_message_at: string | null
          lead_id: string | null
          message_count: number | null
          one_liner: string
          owner_id: string | null
          sentiment: string | null
          updated_at: string
        }
        Insert: {
          action_items?: Json | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          full_summary?: string | null
          id?: string
          key_points?: Json | null
          last_message_at?: string | null
          lead_id?: string | null
          message_count?: number | null
          one_liner: string
          owner_id?: string | null
          sentiment?: string | null
          updated_at?: string
        }
        Update: {
          action_items?: Json | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          full_summary?: string | null
          id?: string
          key_points?: Json | null
          last_message_at?: string | null
          lead_id?: string | null
          message_count?: number | null
          one_liner?: string
          owner_id?: string | null
          sentiment?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_summaries_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_summaries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_performance_entries: {
        Row: {
          created_at: string
          date: string
          entry: string
          id: string
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          entry: string
          id?: string
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          entry?: string
          id?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      discovery_call_reminders: {
        Row: {
          channel: string
          created_at: string | null
          discovery_call_id: string | null
          error_message: string | null
          id: string
          reminder_type: string
          sent_at: string | null
          status: string | null
        }
        Insert: {
          channel: string
          created_at?: string | null
          discovery_call_id?: string | null
          error_message?: string | null
          id?: string
          reminder_type: string
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          discovery_call_id?: string | null
          error_message?: string | null
          id?: string
          reminder_type?: string
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_call_reminders_discovery_call_id_fkey"
            columns: ["discovery_call_id"]
            isOneToOne: false
            referencedRelation: "discovery_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_calls: {
        Row: {
          confirmation_email_sent: boolean | null
          confirmation_sent: boolean | null
          created_at: string | null
          current_situation: string | null
          duration_minutes: number | null
          existing_listing_url: string | null
          google_calendar_event_id: string | null
          google_meet_link: string | null
          id: string
          last_reminder_scheduled_at: string | null
          lead_id: string | null
          meeting_notes: string | null
          meeting_type: string | null
          reminder_1h_sent: boolean | null
          reminder_24h_sent: boolean | null
          reminder_48h_sent: boolean | null
          reminder_sent: boolean | null
          rental_strategy: string | null
          reschedule_count: number | null
          rescheduled_at: string | null
          rescheduled_from: string | null
          scheduled_at: string
          scheduled_by: string | null
          service_interest: string | null
          start_timeline: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          confirmation_email_sent?: boolean | null
          confirmation_sent?: boolean | null
          created_at?: string | null
          current_situation?: string | null
          duration_minutes?: number | null
          existing_listing_url?: string | null
          google_calendar_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          last_reminder_scheduled_at?: string | null
          lead_id?: string | null
          meeting_notes?: string | null
          meeting_type?: string | null
          reminder_1h_sent?: boolean | null
          reminder_24h_sent?: boolean | null
          reminder_48h_sent?: boolean | null
          reminder_sent?: boolean | null
          rental_strategy?: string | null
          reschedule_count?: number | null
          rescheduled_at?: string | null
          rescheduled_from?: string | null
          scheduled_at: string
          scheduled_by?: string | null
          service_interest?: string | null
          start_timeline?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          confirmation_email_sent?: boolean | null
          confirmation_sent?: boolean | null
          created_at?: string | null
          current_situation?: string | null
          duration_minutes?: number | null
          existing_listing_url?: string | null
          google_calendar_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          last_reminder_scheduled_at?: string | null
          lead_id?: string | null
          meeting_notes?: string | null
          meeting_type?: string | null
          reminder_1h_sent?: boolean | null
          reminder_24h_sent?: boolean | null
          reminder_48h_sent?: boolean | null
          reminder_sent?: boolean | null
          rental_strategy?: string | null
          reschedule_count?: number | null
          rescheduled_at?: string | null
          rescheduled_from?: string | null
          scheduled_at?: string
          scheduled_by?: string | null
          service_interest?: string | null
          start_timeline?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      document_audit_log: {
        Row: {
          action: string
          created_at: string | null
          document_id: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          performed_by: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          document_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          performed_by?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          document_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          performed_by?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_audit_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "booking_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          contract_type: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          field_mappings: Json | null
          file_path: string
          google_drive_url: string | null
          id: string
          is_active: boolean | null
          name: string
          signwell_template_id: string | null
          updated_at: string | null
        }
        Insert: {
          contract_type?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          field_mappings?: Json | null
          file_path: string
          google_drive_url?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          signwell_template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          contract_type?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          field_mappings?: Json | null
          file_path?: string
          google_drive_url?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          signwell_template_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_ai_prompts: {
        Row: {
          created_at: string | null
          email_type: string
          id: string
          prompt_content: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email_type: string
          id?: string
          prompt_content: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email_type?: string
          id?: string
          prompt_content?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      email_drafts: {
        Row: {
          ai_generated: boolean | null
          body: string
          contact_context: string | null
          contact_type: string | null
          created_at: string | null
          created_by: string | null
          id: string
          property_id: string | null
          property_name: string | null
          sent_at: string | null
          status: string | null
          subject: string
          to_email: string
          to_name: string | null
          updated_at: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          body: string
          contact_context?: string | null
          contact_type?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          property_id?: string | null
          property_name?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          to_email: string
          to_name?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          body?: string
          contact_context?: string | null
          contact_type?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          property_id?: string | null
          property_name?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          to_email?: string
          to_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_drafts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      email_insights: {
        Row: {
          action_required: boolean | null
          attachments: Json | null
          category: string
          created_at: string
          due_date: string | null
          email_date: string
          expense_amount: number | null
          expense_created: boolean | null
          expense_description: string | null
          expense_detected: boolean | null
          gmail_message_id: string | null
          id: string
          owner_id: string | null
          priority: string | null
          property_id: string | null
          sender_email: string
          sentiment: string | null
          status: string | null
          subject: string
          suggested_actions: string | null
          summary: string
        }
        Insert: {
          action_required?: boolean | null
          attachments?: Json | null
          category: string
          created_at?: string
          due_date?: string | null
          email_date: string
          expense_amount?: number | null
          expense_created?: boolean | null
          expense_description?: string | null
          expense_detected?: boolean | null
          gmail_message_id?: string | null
          id?: string
          owner_id?: string | null
          priority?: string | null
          property_id?: string | null
          sender_email: string
          sentiment?: string | null
          status?: string | null
          subject: string
          suggested_actions?: string | null
          summary: string
        }
        Update: {
          action_required?: boolean | null
          attachments?: Json | null
          category?: string
          created_at?: string
          due_date?: string | null
          email_date?: string
          expense_amount?: number | null
          expense_created?: boolean | null
          expense_description?: string | null
          expense_detected?: boolean | null
          gmail_message_id?: string | null
          id?: string
          owner_id?: string | null
          priority?: string | null
          property_id?: string | null
          sender_email?: string
          sentiment?: string | null
          status?: string | null
          subject?: string
          suggested_actions?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_insights_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_insights_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_insights_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      email_scan_log: {
        Row: {
          emails_processed: number | null
          error_message: string | null
          id: string
          insights_generated: number | null
          scan_date: string
          scan_status: string | null
          total_emails: number | null
        }
        Insert: {
          emails_processed?: number | null
          error_message?: string | null
          id?: string
          insights_generated?: number | null
          scan_date?: string
          scan_status?: string | null
          total_emails?: number | null
        }
        Update: {
          emails_processed?: number | null
          error_message?: string | null
          id?: string
          insights_generated?: number | null
          scan_date?: string
          scan_status?: string | null
          total_emails?: number | null
        }
        Relationships: []
      }
      email_snippets: {
        Row: {
          category: string | null
          content: string
          created_at: string
          id: string
          name: string
          shortcut: string
          updated_at: string
          use_count: number | null
          user_id: string | null
          variables: Json | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          id?: string
          name: string
          shortcut: string
          updated_at?: string
          use_count?: number | null
          user_id?: string | null
          variables?: Json | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          name?: string
          shortcut?: string
          updated_at?: string
          use_count?: number | null
          user_id?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      expense_verifications: {
        Row: {
          created_at: string
          discrepancy_reason: string | null
          email_insight_id: string | null
          expense_id: string | null
          extracted_amount: number | null
          id: string
          order_number: string | null
          property_id: string
          raw_email_data: Json | null
          updated_at: string
          verification_status: string
          verified_amount: number | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          discrepancy_reason?: string | null
          email_insight_id?: string | null
          expense_id?: string | null
          extracted_amount?: number | null
          id?: string
          order_number?: string | null
          property_id: string
          raw_email_data?: Json | null
          updated_at?: string
          verification_status?: string
          verified_amount?: number | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          discrepancy_reason?: string | null
          email_insight_id?: string | null
          expense_id?: string | null
          extracted_amount?: number | null
          id?: string
          order_number?: string | null
          property_id?: string
          raw_email_data?: Json | null
          updated_at?: string
          verification_status?: string
          verified_amount?: number | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_verifications_email_insight_id_fkey"
            columns: ["email_insight_id"]
            isOneToOne: false
            referencedRelation: "email_insights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_verifications_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_verifications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_verifications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          attachment_metadata: Json | null
          billed: boolean | null
          category: string | null
          created_at: string
          date: string
          delivery_address: string | null
          email_insight_id: string | null
          email_screenshot_path: string | null
          exported: boolean | null
          file_path: string | null
          id: string
          is_return: boolean | null
          items_detail: string | null
          line_items: Json | null
          order_date: string | null
          order_number: string | null
          original_receipt_path: string | null
          parent_expense_id: string | null
          property_id: string
          purpose: string | null
          reconciliation_id: string | null
          refund_amount: number | null
          return_reason: string | null
          tracking_number: string | null
          user_id: string | null
          vendor: string | null
        }
        Insert: {
          amount: number
          attachment_metadata?: Json | null
          billed?: boolean | null
          category?: string | null
          created_at?: string
          date: string
          delivery_address?: string | null
          email_insight_id?: string | null
          email_screenshot_path?: string | null
          exported?: boolean | null
          file_path?: string | null
          id?: string
          is_return?: boolean | null
          items_detail?: string | null
          line_items?: Json | null
          order_date?: string | null
          order_number?: string | null
          original_receipt_path?: string | null
          parent_expense_id?: string | null
          property_id: string
          purpose?: string | null
          reconciliation_id?: string | null
          refund_amount?: number | null
          return_reason?: string | null
          tracking_number?: string | null
          user_id?: string | null
          vendor?: string | null
        }
        Update: {
          amount?: number
          attachment_metadata?: Json | null
          billed?: boolean | null
          category?: string | null
          created_at?: string
          date?: string
          delivery_address?: string | null
          email_insight_id?: string | null
          email_screenshot_path?: string | null
          exported?: boolean | null
          file_path?: string | null
          id?: string
          is_return?: boolean | null
          items_detail?: string | null
          line_items?: Json | null
          order_date?: string | null
          order_number?: string | null
          original_receipt_path?: string | null
          parent_expense_id?: string | null
          property_id?: string
          purpose?: string | null
          reconciliation_id?: string | null
          refund_amount?: number | null
          return_reason?: string | null
          tracking_number?: string | null
          user_id?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_email_insight_id_fkey"
            columns: ["email_insight_id"]
            isOneToOne: false
            referencedRelation: "email_insights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_parent_expense_id_fkey"
            columns: ["parent_expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "monthly_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          answered_by: string | null
          asked_by: string
          category: string | null
          created_at: string | null
          email_sent_to_admin: boolean | null
          email_sent_to_user: boolean | null
          id: string
          project_id: string | null
          property_id: string | null
          question: string
          status: string
          task_id: string | null
          updated_at: string | null
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          asked_by: string
          category?: string | null
          created_at?: string | null
          email_sent_to_admin?: boolean | null
          email_sent_to_user?: boolean | null
          id?: string
          project_id?: string | null
          property_id?: string | null
          question: string
          status?: string
          task_id?: string | null
          updated_at?: string | null
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          asked_by?: string
          category?: string | null
          created_at?: string | null
          email_sent_to_admin?: boolean | null
          email_sent_to_user?: boolean | null
          id?: string
          project_id?: string | null
          property_id?: string | null
          question?: string
          status?: string
          task_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faq_questions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faq_questions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faq_questions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faq_questions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_reminders: {
        Row: {
          ai_generated_followup: string | null
          completed_at: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          dismissed_at: string | null
          id: string
          lead_id: string | null
          original_message_id: string | null
          original_sent_at: string | null
          owner_id: string | null
          remind_at: string
          reminder_type: string | null
          status: string | null
          suggested_draft: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ai_generated_followup?: string | null
          completed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          lead_id?: string | null
          original_message_id?: string | null
          original_sent_at?: string | null
          owner_id?: string | null
          remind_at: string
          reminder_type?: string | null
          status?: string | null
          suggested_draft?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ai_generated_followup?: string | null
          completed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          lead_id?: string | null
          original_message_id?: string | null
          original_sent_at?: string | null
          owner_id?: string | null
          remind_at?: string
          reminder_type?: string | null
          status?: string | null
          suggested_draft?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_reminders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_reminders_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      frequently_asked_questions: {
        Row: {
          answer: string
          answered_by: string | null
          asked_by: string | null
          category: string | null
          created_at: string
          id: string
          project_id: string | null
          property_id: string | null
          question: string
          task_id: string | null
          updated_at: string
        }
        Insert: {
          answer: string
          answered_by?: string | null
          asked_by?: string | null
          category?: string | null
          created_at?: string
          id?: string
          project_id?: string | null
          property_id?: string | null
          question: string
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          answer?: string
          answered_by?: string | null
          asked_by?: string | null
          category?: string | null
          created_at?: string
          id?: string
          project_id?: string | null
          property_id?: string | null
          question?: string
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "frequently_asked_questions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequently_asked_questions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequently_asked_questions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequently_asked_questions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      ghl_phone_numbers: {
        Row: {
          capabilities: Json | null
          created_at: string
          friendly_name: string | null
          ghl_phone_id: string
          id: string
          is_active: boolean | null
          location_id: string
          phone_number: string
          synced_at: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          capabilities?: Json | null
          created_at?: string
          friendly_name?: string | null
          ghl_phone_id: string
          id?: string
          is_active?: boolean | null
          location_id: string
          phone_number: string
          synced_at?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          capabilities?: Json | null
          created_at?: string
          friendly_name?: string | null
          ghl_phone_id?: string
          id?: string
          is_active?: boolean | null
          location_id?: string
          phone_number?: string
          synced_at?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gmail_email_status: {
        Row: {
          created_at: string | null
          gmail_message_id: string
          id: string
          priority: string | null
          snoozed_until: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          gmail_message_id: string
          id?: string
          priority?: string | null
          snoozed_until?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          gmail_message_id?: string
          id?: string
          priority?: string | null
          snoozed_until?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      gmail_oauth_tokens: {
        Row: {
          access_token: string
          created_at: string
          email_address: string | null
          expires_at: string
          id: string
          label_name: string | null
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email_address?: string | null
          expires_at: string
          id?: string
          label_name?: string | null
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email_address?: string | null
          expires_at?: string
          id?: string
          label_name?: string | null
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gmail_token_refresh_log: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          new_expires_at: string | null
          old_expires_at: string | null
          refresh_type: string
          success: boolean
          token_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          new_expires_at?: string | null
          old_expires_at?: string | null
          refresh_type: string
          success?: boolean
          token_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          new_expires_at?: string | null
          old_expires_at?: string | null
          refresh_type?: string
          success?: boolean
          token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gmail_token_refresh_log_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "gmail_oauth_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string | null
          expires_at: string
          id: string
          refresh_token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          refresh_token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      google_review_requests: {
        Row: {
          completed_at: string | null
          created_at: string | null
          guest_phone: string
          id: string
          last_nudge_at: string | null
          link_clicked_at: string | null
          link_sent_at: string | null
          nudge_count: number | null
          opted_out: boolean | null
          opted_out_at: string | null
          permission_asked_at: string | null
          permission_granted_at: string | null
          review_id: string | null
          updated_at: string | null
          workflow_status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          guest_phone: string
          id?: string
          last_nudge_at?: string | null
          link_clicked_at?: string | null
          link_sent_at?: string | null
          nudge_count?: number | null
          opted_out?: boolean | null
          opted_out_at?: string | null
          permission_asked_at?: string | null
          permission_granted_at?: string | null
          review_id?: string | null
          updated_at?: string | null
          workflow_status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          guest_phone?: string
          id?: string
          last_nudge_at?: string | null
          link_clicked_at?: string | null
          link_sent_at?: string | null
          nudge_count?: number | null
          opted_out?: boolean | null
          opted_out_at?: string | null
          permission_asked_at?: string | null
          permission_granted_at?: string | null
          review_id?: string | null
          updated_at?: string | null
          workflow_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_review_requests_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "ownerrez_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      holiday_email_logs: {
        Row: {
          created_at: string
          error_message: string | null
          generated_image_url: string | null
          holiday_template_id: string | null
          id: string
          owner_id: string | null
          property_id: string | null
          recipient_email: string
          sent_at: string
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          generated_image_url?: string | null
          holiday_template_id?: string | null
          id?: string
          owner_id?: string | null
          property_id?: string | null
          recipient_email: string
          sent_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          generated_image_url?: string | null
          holiday_template_id?: string | null
          id?: string
          owner_id?: string | null
          property_id?: string | null
          recipient_email?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "holiday_email_logs_holiday_template_id_fkey"
            columns: ["holiday_template_id"]
            isOneToOne: false
            referencedRelation: "holiday_email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holiday_email_logs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holiday_email_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holiday_email_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      holiday_email_queue: {
        Row: {
          created_at: string | null
          error_message: string | null
          generated_image_url: string | null
          id: string
          owner_id: string | null
          pre_generated_image_url: string | null
          property_id: string | null
          recipient_email: string
          recipient_name: string
          scheduled_date: string
          sent_at: string | null
          status: string
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          generated_image_url?: string | null
          id?: string
          owner_id?: string | null
          pre_generated_image_url?: string | null
          property_id?: string | null
          recipient_email: string
          recipient_name: string
          scheduled_date: string
          sent_at?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          generated_image_url?: string | null
          id?: string
          owner_id?: string | null
          pre_generated_image_url?: string | null
          property_id?: string | null
          recipient_email?: string
          recipient_name?: string
          scheduled_date?: string
          sent_at?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holiday_email_queue_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holiday_email_queue_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holiday_email_queue_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holiday_email_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "holiday_email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      holiday_email_templates: {
        Row: {
          created_at: string
          emoji: string | null
          holiday_date: string
          holiday_name: string
          id: string
          image_prompt_template: string
          is_active: boolean
          message_template: string
          recurring: boolean
          subject_template: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          holiday_date: string
          holiday_name: string
          id?: string
          image_prompt_template: string
          is_active?: boolean
          message_template: string
          recurring?: boolean
          subject_template: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          emoji?: string | null
          holiday_date?: string
          holiday_name?: string
          id?: string
          image_prompt_template?: string
          is_active?: boolean
          message_template?: string
          recurring?: boolean
          subject_template?: string
          updated_at?: string
        }
        Relationships: []
      }
      inspection_issues: {
        Row: {
          created_at: string
          detail: string | null
          field_key: string
          id: string
          inspection_id: string | null
          property_id: string
          resolved_at: string | null
          resolved_by: string | null
          responsible_party: string
          severity: string
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          field_key: string
          id?: string
          inspection_id?: string | null
          property_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          responsible_party?: string
          severity?: string
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          field_key?: string
          id?: string
          inspection_id?: string | null
          property_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          responsible_party?: string
          severity?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_issues_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_issues_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_issues_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_photos: {
        Row: {
          caption: string | null
          field_key: string | null
          id: string
          inspection_id: string
          issue_id: string | null
          photo_url: string
          uploaded_at: string
        }
        Insert: {
          caption?: string | null
          field_key?: string | null
          id?: string
          inspection_id: string
          issue_id?: string | null
          photo_url: string
          uploaded_at?: string
        }
        Update: {
          caption?: string | null
          field_key?: string | null
          id?: string
          inspection_id?: string
          issue_id?: string | null
          photo_url?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_photos_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_photos_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "inspection_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_responses: {
        Row: {
          answered_at: string
          field_key: string
          id: string
          inspection_id: string
          section_id: string
          value_bool: boolean | null
          value_text: string | null
        }
        Insert: {
          answered_at?: string
          field_key: string
          id?: string
          inspection_id: string
          section_id: string
          value_bool?: boolean | null
          value_text?: string | null
        }
        Update: {
          answered_at?: string
          field_key?: string
          id?: string
          inspection_id?: string
          section_id?: string
          value_bool?: boolean | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_responses_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          created_at: string
          id: string
          inspection_date: string | null
          inspector_name: string | null
          notes: string | null
          phase: string
          property_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          inspection_date?: string | null
          inspector_name?: string | null
          notes?: string | null
          phase?: string
          property_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          inspection_date?: string | null
          inspector_name?: string | null
          notes?: string | null
          phase?: string
          property_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_certificates: {
        Row: {
          coverage_amount: number | null
          created_at: string | null
          document_path: string | null
          effective_date: string
          expiration_date: string
          id: string
          insurance_type: string
          policy_number: string | null
          property_id: string | null
          provider: string
          updated_at: string | null
        }
        Insert: {
          coverage_amount?: number | null
          created_at?: string | null
          document_path?: string | null
          effective_date: string
          expiration_date: string
          id?: string
          insurance_type: string
          policy_number?: string | null
          property_id?: string | null
          provider: string
          updated_at?: string | null
        }
        Update: {
          coverage_amount?: number | null
          created_at?: string | null
          document_path?: string | null
          effective_date?: string
          expiration_date?: string
          id?: string
          insurance_type?: string
          policy_number?: string | null
          property_id?: string | null
          provider?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurance_certificates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_certificates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          availability: string[] | null
          created_at: string
          detail_oriented_example: string | null
          email: string
          full_name: string
          has_technical_skills: boolean | null
          id: string
          phone: string
          status: string
          updated_at: string
        }
        Insert: {
          availability?: string[] | null
          created_at?: string
          detail_oriented_example?: string | null
          email: string
          full_name: string
          has_technical_skills?: boolean | null
          id?: string
          phone: string
          status?: string
          updated_at?: string
        }
        Update: {
          availability?: string[] | null
          created_at?: string
          detail_oriented_example?: string | null
          email?: string
          full_name?: string
          has_technical_skills?: boolean | null
          id?: string
          phone?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_response_examples: {
        Row: {
          context_type: string | null
          created_at: string | null
          id: string
          ideal_response: string
          knowledge_id: string | null
          question_pattern: string
          rating: number | null
        }
        Insert: {
          context_type?: string | null
          created_at?: string | null
          id?: string
          ideal_response: string
          knowledge_id?: string | null
          question_pattern: string
          rating?: number | null
        }
        Update: {
          context_type?: string | null
          created_at?: string | null
          id?: string
          ideal_response?: string
          knowledge_id?: string | null
          question_pattern?: string
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_response_examples_knowledge_id_fkey"
            columns: ["knowledge_id"]
            isOneToOne: false
            referencedRelation: "company_knowledge_base"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_automations: {
        Row: {
          action_type: string
          ai_enabled: boolean | null
          created_at: string
          delay_minutes: number | null
          id: string
          is_active: boolean | null
          name: string
          template_content: string | null
          template_subject: string | null
          trigger_stage: Database["public"]["Enums"]["lead_stage"]
          updated_at: string
        }
        Insert: {
          action_type: string
          ai_enabled?: boolean | null
          created_at?: string
          delay_minutes?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          template_content?: string | null
          template_subject?: string | null
          trigger_stage: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
        }
        Update: {
          action_type?: string
          ai_enabled?: boolean | null
          created_at?: string
          delay_minutes?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          template_content?: string | null
          template_subject?: string | null
          trigger_stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
        }
        Relationships: []
      }
      lead_communications: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          assigned_user_id: string | null
          body: string
          call_duration: number | null
          call_recording_url: string | null
          cc_user_ids: string[] | null
          clicked_at: string | null
          communication_type: string
          created_at: string
          delivery_status: string | null
          delivery_updated_at: string | null
          direction: string
          error_message: string | null
          external_id: string | null
          ghl_call_id: string | null
          ghl_contact_id: string | null
          ghl_conversation_id: string | null
          ghl_message_id: string | null
          id: string
          is_read: boolean | null
          labels: string[] | null
          last_activity_at: string | null
          lead_id: string | null
          media_urls: string[] | null
          metadata: Json | null
          opened_at: string | null
          owner_id: string | null
          received_on_number: string | null
          recipient_user_id: string | null
          replied_at: string | null
          sent_at: string | null
          sequence_id: string | null
          status: string | null
          step_number: number | null
          subject: string | null
          visibility_users: string[] | null
          work_status: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          assigned_user_id?: string | null
          body: string
          call_duration?: number | null
          call_recording_url?: string | null
          cc_user_ids?: string[] | null
          clicked_at?: string | null
          communication_type: string
          created_at?: string
          delivery_status?: string | null
          delivery_updated_at?: string | null
          direction?: string
          error_message?: string | null
          external_id?: string | null
          ghl_call_id?: string | null
          ghl_contact_id?: string | null
          ghl_conversation_id?: string | null
          ghl_message_id?: string | null
          id?: string
          is_read?: boolean | null
          labels?: string[] | null
          last_activity_at?: string | null
          lead_id?: string | null
          media_urls?: string[] | null
          metadata?: Json | null
          opened_at?: string | null
          owner_id?: string | null
          received_on_number?: string | null
          recipient_user_id?: string | null
          replied_at?: string | null
          sent_at?: string | null
          sequence_id?: string | null
          status?: string | null
          step_number?: number | null
          subject?: string | null
          visibility_users?: string[] | null
          work_status?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          assigned_user_id?: string | null
          body?: string
          call_duration?: number | null
          call_recording_url?: string | null
          cc_user_ids?: string[] | null
          clicked_at?: string | null
          communication_type?: string
          created_at?: string
          delivery_status?: string | null
          delivery_updated_at?: string | null
          direction?: string
          error_message?: string | null
          external_id?: string | null
          ghl_call_id?: string | null
          ghl_contact_id?: string | null
          ghl_conversation_id?: string | null
          ghl_message_id?: string | null
          id?: string
          is_read?: boolean | null
          labels?: string[] | null
          last_activity_at?: string | null
          lead_id?: string | null
          media_urls?: string[] | null
          metadata?: Json | null
          opened_at?: string | null
          owner_id?: string | null
          received_on_number?: string | null
          recipient_user_id?: string | null
          replied_at?: string | null
          sent_at?: string | null
          sequence_id?: string | null
          status?: string | null
          step_number?: number | null
          subject?: string | null
          visibility_users?: string[] | null
          work_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_communications_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_communications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_communications_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_communications_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "lead_follow_up_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_email_templates: {
        Row: {
          ai_enhancement_prompt: string | null
          body_content: string
          created_at: string
          creativity_level: number | null
          header_image_url: string | null
          id: string
          is_active: boolean | null
          protected_sections: Json | null
          signature_type: string
          stage: string
          step_number: number
          subject: string
          template_name: string
          updated_at: string
          use_ai_enhancement: boolean | null
        }
        Insert: {
          ai_enhancement_prompt?: string | null
          body_content: string
          created_at?: string
          creativity_level?: number | null
          header_image_url?: string | null
          id?: string
          is_active?: boolean | null
          protected_sections?: Json | null
          signature_type?: string
          stage: string
          step_number?: number
          subject: string
          template_name: string
          updated_at?: string
          use_ai_enhancement?: boolean | null
        }
        Update: {
          ai_enhancement_prompt?: string | null
          body_content?: string
          created_at?: string
          creativity_level?: number | null
          header_image_url?: string | null
          id?: string
          is_active?: boolean | null
          protected_sections?: Json | null
          signature_type?: string
          stage?: string
          step_number?: number
          subject?: string
          template_name?: string
          updated_at?: string
          use_ai_enhancement?: boolean | null
        }
        Relationships: []
      }
      lead_event_log: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_source: string
          event_type: string
          id: string
          lead_id: string | null
          processed: boolean | null
          stage_changed_to: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_source: string
          event_type: string
          id?: string
          lead_id?: string | null
          processed?: boolean | null
          stage_changed_to?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_source?: string
          event_type?: string
          id?: string
          lead_id?: string | null
          processed?: boolean | null
          stage_changed_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_event_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_follow_up_schedules: {
        Row: {
          attempt_count: number | null
          created_at: string | null
          error_message: string | null
          id: string
          lead_id: string | null
          scheduled_for: string
          sent_at: string | null
          sequence_id: string | null
          status: string | null
          step_id: string | null
          step_number: number | null
          updated_at: string | null
        }
        Insert: {
          attempt_count?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          scheduled_for: string
          sent_at?: string | null
          sequence_id?: string | null
          status?: string | null
          step_id?: string | null
          step_number?: number | null
          updated_at?: string | null
        }
        Update: {
          attempt_count?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          sequence_id?: string | null
          status?: string | null
          step_id?: string | null
          step_number?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_follow_up_schedules_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_follow_up_schedules_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "lead_follow_up_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_follow_up_schedules_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "lead_follow_up_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_follow_up_sequences: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          stop_on_response: boolean | null
          trigger_stage: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          stop_on_response?: boolean | null
          trigger_stage: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          stop_on_response?: boolean | null
          trigger_stage?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lead_follow_up_steps: {
        Row: {
          action_type: string
          ai_personalize: boolean | null
          created_at: string | null
          delay_days: number
          delay_hours: number
          id: string
          send_days: string[] | null
          send_time: string | null
          sequence_id: string | null
          step_number: number
          template_content: string
          template_id: string | null
          template_subject: string | null
        }
        Insert: {
          action_type: string
          ai_personalize?: boolean | null
          created_at?: string | null
          delay_days?: number
          delay_hours?: number
          id?: string
          send_days?: string[] | null
          send_time?: string | null
          sequence_id?: string | null
          step_number: number
          template_content: string
          template_id?: string | null
          template_subject?: string | null
        }
        Update: {
          action_type?: string
          ai_personalize?: boolean | null
          created_at?: string | null
          delay_days?: number
          delay_hours?: number
          id?: string
          send_days?: string[] | null
          send_time?: string | null
          sequence_id?: string | null
          step_number?: number
          template_content?: string
          template_id?: string | null
          template_subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_follow_up_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "lead_follow_up_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_follow_up_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "lead_email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_scheduled_emails: {
        Row: {
          created_at: string | null
          email_type: string
          error_message: string | null
          id: string
          lead_id: string
          metadata: Json | null
          scheduled_for: string
          sent_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email_type: string
          error_message?: string | null
          id?: string
          lead_id: string
          metadata?: Json | null
          scheduled_for: string
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email_type?: string
          error_message?: string | null
          id?: string
          lead_id?: string
          metadata?: Json | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_scheduled_emails_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_timeline: {
        Row: {
          action: string
          created_at: string
          id: string
          lead_id: string
          metadata: Json | null
          new_stage: Database["public"]["Enums"]["lead_stage"] | null
          performed_by_name: string | null
          performed_by_user_id: string | null
          previous_stage: Database["public"]["Enums"]["lead_stage"] | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          lead_id: string
          metadata?: Json | null
          new_stage?: Database["public"]["Enums"]["lead_stage"] | null
          performed_by_name?: string | null
          performed_by_user_id?: string | null
          previous_stage?: Database["public"]["Enums"]["lead_stage"] | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          lead_id?: string
          metadata?: Json | null
          new_stage?: Database["public"]["Enums"]["lead_stage"] | null
          performed_by_name?: string | null
          performed_by_user_id?: string | null
          previous_stage?: Database["public"]["Enums"]["lead_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          active_sequence_id: string | null
          ai_next_action: string | null
          ai_qualification_score: number | null
          ai_summary: string | null
          assigned_to: string | null
          auto_stage_reason: string | null
          calendar_event_id: string | null
          created_at: string
          email: string | null
          follow_up_paused: boolean | null
          ghl_contact_id: string | null
          has_unread_messages: boolean | null
          id: string
          inspection_assigned_to: string | null
          inspection_calendar_event_id: string | null
          inspection_checklist_responses: Json | null
          inspection_date: string | null
          last_contacted_at: string | null
          last_response_at: string | null
          last_stage_auto_update_at: string | null
          lead_number: number
          name: string
          notes: string | null
          onboarding_submission_id: string | null
          opportunity_source: string | null
          opportunity_value: number | null
          owner_id: string | null
          phone: string | null
          project_id: string | null
          property_address: string | null
          property_id: string | null
          property_type: string | null
          signwell_document_id: string | null
          stage: Database["public"]["Enums"]["lead_stage"]
          stage_changed_at: string | null
          stripe_setup_intent_id: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          active_sequence_id?: string | null
          ai_next_action?: string | null
          ai_qualification_score?: number | null
          ai_summary?: string | null
          assigned_to?: string | null
          auto_stage_reason?: string | null
          calendar_event_id?: string | null
          created_at?: string
          email?: string | null
          follow_up_paused?: boolean | null
          ghl_contact_id?: string | null
          has_unread_messages?: boolean | null
          id?: string
          inspection_assigned_to?: string | null
          inspection_calendar_event_id?: string | null
          inspection_checklist_responses?: Json | null
          inspection_date?: string | null
          last_contacted_at?: string | null
          last_response_at?: string | null
          last_stage_auto_update_at?: string | null
          lead_number?: number
          name: string
          notes?: string | null
          onboarding_submission_id?: string | null
          opportunity_source?: string | null
          opportunity_value?: number | null
          owner_id?: string | null
          phone?: string | null
          project_id?: string | null
          property_address?: string | null
          property_id?: string | null
          property_type?: string | null
          signwell_document_id?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          stage_changed_at?: string | null
          stripe_setup_intent_id?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          active_sequence_id?: string | null
          ai_next_action?: string | null
          ai_qualification_score?: number | null
          ai_summary?: string | null
          assigned_to?: string | null
          auto_stage_reason?: string | null
          calendar_event_id?: string | null
          created_at?: string
          email?: string | null
          follow_up_paused?: boolean | null
          ghl_contact_id?: string | null
          has_unread_messages?: boolean | null
          id?: string
          inspection_assigned_to?: string | null
          inspection_calendar_event_id?: string | null
          inspection_checklist_responses?: Json | null
          inspection_date?: string | null
          last_contacted_at?: string | null
          last_response_at?: string | null
          last_stage_auto_update_at?: string | null
          lead_number?: number
          name?: string
          notes?: string | null
          onboarding_submission_id?: string | null
          opportunity_source?: string | null
          opportunity_value?: number | null
          owner_id?: string | null
          phone?: string | null
          project_id?: string | null
          property_address?: string | null
          property_id?: string | null
          property_type?: string | null
          signwell_document_id?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          stage_changed_at?: string | null
          stripe_setup_intent_id?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_active_sequence_id_fkey"
            columns: ["active_sequence_id"]
            isOneToOne: false
            referencedRelation: "lead_follow_up_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_inspection_assigned_to_fkey"
            columns: ["inspection_assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_documents: {
        Row: {
          document_path: string
          document_type: string
          end_date: string | null
          id: string
          notes: string | null
          property_id: string | null
          start_date: string | null
          tenant_name: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          document_path: string
          document_type: string
          end_date?: string | null
          id?: string
          notes?: string | null
          property_id?: string | null
          start_date?: string | null
          tenant_name: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          document_path?: string
          document_type?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          property_id?: string | null
          start_date?: string | null
          tenant_name?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lease_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_templates: {
        Row: {
          available_variables: string[] | null
          created_at: string
          created_by: string | null
          id: string
          platform_name: string
          template_content: string
          updated_at: string
        }
        Insert: {
          available_variables?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          platform_name: string
          template_content: string
          updated_at?: string
        }
        Update: {
          available_variables?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          platform_name?: string
          template_content?: string
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_messages: {
        Row: {
          ai_context: Json | null
          attachments: string[] | null
          created_at: string | null
          id: string
          is_ai_generated: boolean | null
          is_internal: boolean | null
          message_text: string
          read_by_owner: boolean | null
          read_by_owner_at: string | null
          read_by_vendor: boolean | null
          read_by_vendor_at: string | null
          sender_email: string | null
          sender_name: string
          sender_type: Database["public"]["Enums"]["message_sender_type"]
          sender_user_id: string | null
          visible_to_guest: boolean | null
          visible_to_owner: boolean | null
          visible_to_vendor: boolean | null
          work_order_id: string
        }
        Insert: {
          ai_context?: Json | null
          attachments?: string[] | null
          created_at?: string | null
          id?: string
          is_ai_generated?: boolean | null
          is_internal?: boolean | null
          message_text: string
          read_by_owner?: boolean | null
          read_by_owner_at?: string | null
          read_by_vendor?: boolean | null
          read_by_vendor_at?: string | null
          sender_email?: string | null
          sender_name: string
          sender_type: Database["public"]["Enums"]["message_sender_type"]
          sender_user_id?: string | null
          visible_to_guest?: boolean | null
          visible_to_owner?: boolean | null
          visible_to_vendor?: boolean | null
          work_order_id: string
        }
        Update: {
          ai_context?: Json | null
          attachments?: string[] | null
          created_at?: string | null
          id?: string
          is_ai_generated?: boolean | null
          is_internal?: boolean | null
          message_text?: string
          read_by_owner?: boolean | null
          read_by_owner_at?: string | null
          read_by_vendor?: boolean | null
          read_by_vendor_at?: string | null
          sender_email?: string | null
          sender_name?: string
          sender_type?: Database["public"]["Enums"]["message_sender_type"]
          sender_user_id?: string | null
          visible_to_guest?: boolean | null
          visible_to_owner?: boolean | null
          visible_to_vendor?: boolean | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_messages_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_troubleshooting_guides: {
        Row: {
          category: string
          common_causes: string[] | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          issue_type: string
          keywords: string[] | null
          property_id: string | null
          requires_professional: boolean | null
          steps: Json
          success_rate: number | null
          times_used: number | null
          title: string
          typical_cost_range: string | null
          typical_resolution_time: string | null
          updated_at: string | null
          urgency_indicators: string[] | null
        }
        Insert: {
          category: string
          common_causes?: string[] | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          issue_type: string
          keywords?: string[] | null
          property_id?: string | null
          requires_professional?: boolean | null
          steps?: Json
          success_rate?: number | null
          times_used?: number | null
          title: string
          typical_cost_range?: string | null
          typical_resolution_time?: string | null
          updated_at?: string | null
          urgency_indicators?: string[] | null
        }
        Update: {
          category?: string
          common_causes?: string[] | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          issue_type?: string
          keywords?: string[] | null
          property_id?: string | null
          requires_professional?: boolean | null
          steps?: Json
          success_rate?: number | null
          times_used?: number | null
          title?: string
          typical_cost_range?: string | null
          typical_resolution_time?: string | null
          updated_at?: string | null
          urgency_indicators?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_troubleshooting_guides_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_troubleshooting_guides_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      management_agreements: {
        Row: {
          additional_fees: Json | null
          agreement_date: string
          created_at: string | null
          document_path: string | null
          effective_date: string
          google_drive_url: string | null
          id: string
          management_fee_percentage: number | null
          notes: string | null
          order_minimum_fee: number | null
          owner_id: string | null
          property_id: string | null
          signed_by_company: boolean | null
          signed_by_company_at: string | null
          signed_by_owner: boolean | null
          signed_by_owner_at: string | null
          status: string | null
          termination_date: string | null
          termination_reason: string | null
          updated_at: string | null
        }
        Insert: {
          additional_fees?: Json | null
          agreement_date: string
          created_at?: string | null
          document_path?: string | null
          effective_date: string
          google_drive_url?: string | null
          id?: string
          management_fee_percentage?: number | null
          notes?: string | null
          order_minimum_fee?: number | null
          owner_id?: string | null
          property_id?: string | null
          signed_by_company?: boolean | null
          signed_by_company_at?: string | null
          signed_by_owner?: boolean | null
          signed_by_owner_at?: string | null
          status?: string | null
          termination_date?: string | null
          termination_reason?: string | null
          updated_at?: string | null
        }
        Update: {
          additional_fees?: Json | null
          agreement_date?: string
          created_at?: string | null
          document_path?: string | null
          effective_date?: string
          google_drive_url?: string | null
          id?: string
          management_fee_percentage?: number | null
          notes?: string | null
          order_minimum_fee?: number | null
          owner_id?: string | null
          property_id?: string | null
          signed_by_company?: boolean | null
          signed_by_company_at?: string | null
          signed_by_owner?: boolean | null
          signed_by_owner_at?: string | null
          status?: string | null
          termination_date?: string | null
          termination_reason?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "management_agreements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_agreements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_agreements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_recordings: {
        Row: {
          analyzed: boolean | null
          communication_id: string | null
          created_at: string
          discovery_call_id: string | null
          duration_seconds: number | null
          ended_at: string | null
          error_message: string | null
          host_user_id: string | null
          id: string
          lead_id: string | null
          matched_lead_id: string | null
          matched_owner_id: string | null
          meeting_title: string | null
          meeting_url: string | null
          metadata: Json | null
          participants: Json | null
          platform: string | null
          property_id: string | null
          recall_bot_id: string | null
          recall_meeting_id: string | null
          recording_url: string | null
          started_at: string | null
          status: string | null
          transcript: string | null
          transcript_segments: Json | null
          transcript_summary: string | null
          updated_at: string
        }
        Insert: {
          analyzed?: boolean | null
          communication_id?: string | null
          created_at?: string
          discovery_call_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          error_message?: string | null
          host_user_id?: string | null
          id?: string
          lead_id?: string | null
          matched_lead_id?: string | null
          matched_owner_id?: string | null
          meeting_title?: string | null
          meeting_url?: string | null
          metadata?: Json | null
          participants?: Json | null
          platform?: string | null
          property_id?: string | null
          recall_bot_id?: string | null
          recall_meeting_id?: string | null
          recording_url?: string | null
          started_at?: string | null
          status?: string | null
          transcript?: string | null
          transcript_segments?: Json | null
          transcript_summary?: string | null
          updated_at?: string
        }
        Update: {
          analyzed?: boolean | null
          communication_id?: string | null
          created_at?: string
          discovery_call_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          error_message?: string | null
          host_user_id?: string | null
          id?: string
          lead_id?: string | null
          matched_lead_id?: string | null
          matched_owner_id?: string | null
          meeting_title?: string | null
          meeting_url?: string | null
          metadata?: Json | null
          participants?: Json | null
          platform?: string | null
          property_id?: string | null
          recall_bot_id?: string | null
          recall_meeting_id?: string | null
          recording_url?: string | null
          started_at?: string | null
          status?: string | null
          transcript?: string | null
          transcript_segments?: Json | null
          transcript_summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_recordings_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "lead_communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_recordings_discovery_call_id_fkey"
            columns: ["discovery_call_id"]
            isOneToOne: false
            referencedRelation: "discovery_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_recordings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_recordings_matched_lead_id_fkey"
            columns: ["matched_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_recordings_matched_owner_id_fkey"
            columns: ["matched_owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_recordings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_recordings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      mid_term_bookings: {
        Row: {
          created_at: string
          deposit_amount: number | null
          end_date: string
          gift_card_sent: boolean | null
          id: string
          monthly_rent: number
          nightly_rate: number | null
          notes: string | null
          property_id: string
          review_email_sent: boolean | null
          review_email_sent_at: string | null
          review_submitted: boolean | null
          review_submitted_at: string | null
          review_token: string | null
          start_date: string
          status: string
          tenant_email: string | null
          tenant_name: string
          tenant_phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deposit_amount?: number | null
          end_date: string
          gift_card_sent?: boolean | null
          id?: string
          monthly_rent: number
          nightly_rate?: number | null
          notes?: string | null
          property_id: string
          review_email_sent?: boolean | null
          review_email_sent_at?: string | null
          review_submitted?: boolean | null
          review_submitted_at?: string | null
          review_token?: string | null
          start_date: string
          status?: string
          tenant_email?: string | null
          tenant_name: string
          tenant_phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deposit_amount?: number | null
          end_date?: string
          gift_card_sent?: boolean | null
          id?: string
          monthly_rent?: number
          nightly_rate?: number | null
          notes?: string | null
          property_id?: string
          review_email_sent?: boolean | null
          review_email_sent_at?: string | null
          review_submitted?: boolean | null
          review_submitted_at?: string | null
          review_token?: string | null
          start_date?: string
          status?: string
          tenant_email?: string | null
          tenant_name?: string
          tenant_phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mid_term_bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mid_term_bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_charges: {
        Row: {
          category: string | null
          charge_month: string
          charge_status: string
          charged_at: string | null
          created_at: string
          exported: boolean | null
          id: string
          is_multi_line: boolean | null
          owner_id: string
          property_id: string | null
          receipt_path: string | null
          reconciliation_id: string | null
          statement_date: string | null
          statement_notes: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          total_management_fees: number
        }
        Insert: {
          category?: string | null
          charge_month: string
          charge_status?: string
          charged_at?: string | null
          created_at?: string
          exported?: boolean | null
          id?: string
          is_multi_line?: boolean | null
          owner_id: string
          property_id?: string | null
          receipt_path?: string | null
          reconciliation_id?: string | null
          statement_date?: string | null
          statement_notes?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          total_management_fees?: number
        }
        Update: {
          category?: string | null
          charge_month?: string
          charge_status?: string
          charged_at?: string | null
          created_at?: string
          exported?: boolean | null
          id?: string
          is_multi_line?: boolean | null
          owner_id?: string
          property_id?: string | null
          receipt_path?: string | null
          reconciliation_id?: string | null
          statement_date?: string | null
          statement_notes?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          total_management_fees?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_charges_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_charges_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_charges_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_charges_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "monthly_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_reconciliations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          charge_id: string | null
          charged_at: string | null
          created_at: string
          dispute_detected_at: string | null
          dispute_reason: string | null
          due_from_owner: number | null
          id: string
          management_fee: number
          mid_term_revenue: number | null
          net_to_owner: number
          notes: string | null
          order_minimum_fee: number | null
          owner_acknowledged: boolean | null
          owner_disputed: boolean | null
          owner_id: string
          owner_response_deadline: string | null
          payment_reminder_sent_at: string | null
          payout_at: string | null
          payout_reference: string | null
          payout_status: string | null
          payout_to_owner: number | null
          property_id: string
          reconciliation_month: string
          revenue_override: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          short_term_revenue: number | null
          statement_sent_at: string | null
          status: string
          total_expenses: number
          total_revenue: number
          updated_at: string
          visit_fees: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          charge_id?: string | null
          charged_at?: string | null
          created_at?: string
          dispute_detected_at?: string | null
          dispute_reason?: string | null
          due_from_owner?: number | null
          id?: string
          management_fee?: number
          mid_term_revenue?: number | null
          net_to_owner?: number
          notes?: string | null
          order_minimum_fee?: number | null
          owner_acknowledged?: boolean | null
          owner_disputed?: boolean | null
          owner_id: string
          owner_response_deadline?: string | null
          payment_reminder_sent_at?: string | null
          payout_at?: string | null
          payout_reference?: string | null
          payout_status?: string | null
          payout_to_owner?: number | null
          property_id: string
          reconciliation_month: string
          revenue_override?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          short_term_revenue?: number | null
          statement_sent_at?: string | null
          status?: string
          total_expenses?: number
          total_revenue?: number
          updated_at?: string
          visit_fees?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          charge_id?: string | null
          charged_at?: string | null
          created_at?: string
          dispute_detected_at?: string | null
          dispute_reason?: string | null
          due_from_owner?: number | null
          id?: string
          management_fee?: number
          mid_term_revenue?: number | null
          net_to_owner?: number
          notes?: string | null
          order_minimum_fee?: number | null
          owner_acknowledged?: boolean | null
          owner_disputed?: boolean | null
          owner_id?: string
          owner_response_deadline?: string | null
          payment_reminder_sent_at?: string | null
          payout_at?: string | null
          payout_reference?: string | null
          payout_status?: string | null
          payout_to_owner?: number | null
          property_id?: string
          reconciliation_month?: string
          revenue_override?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          short_term_revenue?: number | null
          statement_sent_at?: string | null
          status?: string
          total_expenses?: number
          total_revenue?: number
          updated_at?: string
          visit_fees?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_reconciliations_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "monthly_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_reconciliations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_reconciliations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_reconciliations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          task_id: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          task_id: string
          user_id?: string | null
          user_name: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_projects: {
        Row: {
          created_at: string
          id: string
          owner_name: string
          partner_property_id: string | null
          progress: number | null
          property_address: string
          property_id: string | null
          status: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          owner_name: string
          partner_property_id?: string | null
          progress?: number | null
          property_address: string
          property_id?: string | null
          status?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          owner_name?: string
          partner_property_id?: string | null
          progress?: number | null
          property_address?: string
          property_id?: string | null
          status?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_projects_partner_property_id_fkey"
            columns: ["partner_property_id"]
            isOneToOne: false
            referencedRelation: "partner_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_projects_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_projects_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_sops: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          loom_video_url: string | null
          phase_number: number | null
          project_id: string | null
          task_id: string | null
          task_title: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          loom_video_url?: string | null
          phase_number?: number | null
          project_id?: string | null
          task_id?: string | null
          task_title?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          loom_video_url?: string | null
          phase_number?: number | null
          project_id?: string | null
          task_id?: string | null
          task_title?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_sops_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_sops_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_tasks: {
        Row: {
          assigned_role_id: string | null
          assigned_to: string | null
          assigned_to_uuid: string | null
          completed_by: string | null
          completed_date: string | null
          created_at: string
          description: string | null
          due_date: string | null
          field_type: string
          field_value: string | null
          file_path: string | null
          id: string
          max_reschedule_weeks: number | null
          notes: string | null
          original_due_date: string | null
          phase_number: number
          phase_title: string
          project_id: string
          requires_proof: boolean | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_role_id?: string | null
          assigned_to?: string | null
          assigned_to_uuid?: string | null
          completed_by?: string | null
          completed_date?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          field_type?: string
          field_value?: string | null
          file_path?: string | null
          id?: string
          max_reschedule_weeks?: number | null
          notes?: string | null
          original_due_date?: string | null
          phase_number: number
          phase_title: string
          project_id: string
          requires_proof?: boolean | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_role_id?: string | null
          assigned_to?: string | null
          assigned_to_uuid?: string | null
          completed_by?: string | null
          completed_date?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          field_type?: string
          field_value?: string | null
          file_path?: string | null
          id?: string
          max_reschedule_weeks?: number | null
          notes?: string | null
          original_due_date?: string | null
          phase_number?: number
          phase_title?: string
          project_id?: string
          requires_proof?: boolean | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_tasks_assigned_role_id_fkey"
            columns: ["assigned_role_id"]
            isOneToOne: false
            referencedRelation: "team_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_assigned_to_uuid_fkey"
            columns: ["assigned_to_uuid"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_approvals: {
        Row: {
          amount_requiring_approval: number
          approval_threshold: number
          approved_amount: number | null
          auto_approved_reason: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          owner_id: string
          owner_notes: string | null
          property_id: string
          reason_for_approval: string | null
          reminder_count: number | null
          reminder_sent_at: string | null
          requested_at: string | null
          requested_by: string | null
          responded_at: string | null
          status: Database["public"]["Enums"]["approval_status"] | null
          updated_at: string | null
          work_order_id: string
        }
        Insert: {
          amount_requiring_approval: number
          approval_threshold: number
          approved_amount?: number | null
          auto_approved_reason?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          owner_id: string
          owner_notes?: string | null
          property_id: string
          reason_for_approval?: string | null
          reminder_count?: number | null
          reminder_sent_at?: string | null
          requested_at?: string | null
          requested_by?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["approval_status"] | null
          updated_at?: string | null
          work_order_id: string
        }
        Update: {
          amount_requiring_approval?: number
          approval_threshold?: number
          approved_amount?: number | null
          auto_approved_reason?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          owner_id?: string
          owner_notes?: string | null
          property_id?: string
          reason_for_approval?: string | null
          reminder_count?: number | null
          reminder_sent_at?: string | null
          requested_at?: string | null
          requested_by?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["approval_status"] | null
          updated_at?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_approvals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_approvals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_approvals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_approvals_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_context_cache: {
        Row: {
          context_data: Json
          created_at: string
          expires_at: string
          generated_at: string
          id: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          context_data: Json
          created_at?: string
          expires_at?: string
          generated_at?: string
          id?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          context_data?: Json
          created_at?: string
          expires_at?: string
          generated_at?: string
          id?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_context_cache_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_conversation_actions: {
        Row: {
          action_type: string
          assigned_to: string | null
          category: string | null
          completed_at: string | null
          completed_by: string | null
          content: Json | null
          conversation_id: string | null
          created_at: string
          description: string | null
          id: string
          linked_faq_id: string | null
          linked_task_id: string | null
          priority: string | null
          property_field: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          action_type: string
          assigned_to?: string | null
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          content?: Json | null
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          linked_faq_id?: string | null
          linked_task_id?: string | null
          priority?: string | null
          property_field?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          assigned_to?: string | null
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          content?: Json | null
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          linked_faq_id?: string | null
          linked_task_id?: string | null
          priority?: string | null
          property_field?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_conversation_actions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "owner_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_conversation_actions_linked_faq_id_fkey"
            columns: ["linked_faq_id"]
            isOneToOne: false
            referencedRelation: "frequently_asked_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_conversation_actions_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_conversation_documents: {
        Row: {
          ai_analysis: Json | null
          ai_extracted_content: string | null
          conversation_id: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
        }
        Insert: {
          ai_analysis?: Json | null
          ai_extracted_content?: string | null
          conversation_id?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
        }
        Update: {
          ai_analysis?: Json | null
          ai_extracted_content?: string | null
          conversation_id?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_conversation_documents_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "owner_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_conversations: {
        Row: {
          ai_summary: string | null
          conversation_date: string | null
          created_at: string
          created_by: string | null
          extracted_items: Json | null
          id: string
          participants: string | null
          property_id: string | null
          status: string
          title: string
          transcript_file_path: string | null
          transcript_text: string | null
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          conversation_date?: string | null
          created_at?: string
          created_by?: string | null
          extracted_items?: Json | null
          id?: string
          participants?: string | null
          property_id?: string | null
          status?: string
          title: string
          transcript_file_path?: string | null
          transcript_text?: string | null
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          conversation_date?: string | null
          created_at?: string
          created_by?: string | null
          extracted_items?: Json | null
          id?: string
          participants?: string | null
          property_id?: string | null
          status?: string
          title?: string
          transcript_file_path?: string | null
          transcript_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_conversations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_conversations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_distributions: {
        Row: {
          amount: number
          created_at: string | null
          distribution_date: string
          id: string
          owner_id: string | null
          payment_method: string | null
          property_id: string | null
          reconciliation_id: string | null
          reference_number: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          distribution_date: string
          id?: string
          owner_id?: string | null
          payment_method?: string | null
          property_id?: string | null
          reconciliation_id?: string | null
          reference_number?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          distribution_date?: string
          id?: string
          owner_id?: string | null
          payment_method?: string | null
          property_id?: string | null
          reconciliation_id?: string | null
          reference_number?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_distributions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_distributions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_distributions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_distributions_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "monthly_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_notifications: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message: string
          notification_channel: string
          notification_type: string
          owner_id: string
          positive_event_id: string | null
          property_id: string | null
          sent_at: string | null
          status: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message: string
          notification_channel?: string
          notification_type: string
          owner_id: string
          positive_event_id?: string | null
          property_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message?: string
          notification_channel?: string
          notification_type?: string
          owner_id?: string
          positive_event_id?: string | null
          property_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_notifications_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_notifications_positive_event_id_fkey"
            columns: ["positive_event_id"]
            isOneToOne: false
            referencedRelation: "positive_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_notifications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_notifications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_onboarding_submissions: {
        Row: {
          airbnb_link: string | null
          airbnb_revenue_export_url: string | null
          alarm_code: string | null
          average_booking_window: number | null
          average_daily_rate: number | null
          average_monthly_revenue: number | null
          backup_cleaner: string | null
          backup_key_location: string | null
          breaker_panel_location: string | null
          camera_locations: string | null
          camera_login_credentials: string | null
          camera_login_website: string | null
          cleaner_payment: string | null
          cleaner_quality: string | null
          cleaner_satisfaction: string | null
          competitor_insights: string | null
          created_at: string
          emergency_contact_24_7: string | null
          entity_documents_url: string | null
          entity_ownership: string | null
          error_message: string | null
          existing_photos_link: string | null
          expense_report_url: string | null
          file_urls: Json | null
          fire_extinguisher_locations: string | null
          garage_code: string | null
          gas_shutoff_location: string | null
          gate_code: string | null
          government_id_url: string | null
          guest_avatar: string | null
          guide_book_url: string | null
          has_cameras: boolean | null
          has_hoa: boolean | null
          has_security_system: boolean | null
          has_thermostat: boolean | null
          hoa_contact_name: string | null
          hoa_contact_phone: string | null
          hoa_rules_url: string | null
          house_manual_url: string | null
          house_quirks: string | null
          hvac_service: string | null
          id: string
          insurance_corporate_contacts: string | null
          insurance_policy_number: string | null
          insurance_provider: string | null
          known_maintenance_issues: string | null
          last_year_revenue: number | null
          laundry_notes: string | null
          lawncare_provider: string | null
          lockbox_code: string | null
          maids_closet_code: string | null
          maintenance_contact: string | null
          max_vehicles: number | null
          mortgage_statement_url: string | null
          occupancy_rate: number | null
          other_listing_links: string | null
          owner_email: string
          owner_id: string | null
          owner_name: string
          owner_phone: string | null
          ownerrez_revenue_export_url: string | null
          parking_instructions: string | null
          parking_map_url: string | null
          peak_season: string | null
          peak_season_adr: number | null
          permit_number: string | null
          pest_control_provider: string | null
          pet_deposit: number | null
          pet_size_restrictions: string | null
          pets_allowed: boolean | null
          pool_hot_tub_info: string | null
          pricing_revenue_goals: string | null
          primary_cleaner: string | null
          processed_at: string | null
          project_id: string | null
          property_address: string
          property_deed_url: string | null
          property_id: string | null
          property_tax_statement_url: string | null
          recent_renovations: string | null
          revenue_statement_url: string | null
          security_brand: string | null
          sensitive_neighbor_notes: string | null
          septic_company: string | null
          septic_last_pumped: string | null
          smart_lock_brand: string | null
          smart_lock_code: string | null
          smoke_co_detector_status: string | null
          status: string
          str_permit_status: string | null
          supply_closet_location: string | null
          thermostat_login: string | null
          trash_bin_location: string | null
          trash_pickup_day: string | null
          unique_selling_points: string | null
          updated_at: string
          utilities: Json | null
          vrbo_link: string | null
          vrbo_revenue_export_url: string | null
          wastewater_system: string | null
          water_shutoff_location: string | null
          wifi_password: string | null
          wifi_ssid: string | null
        }
        Insert: {
          airbnb_link?: string | null
          airbnb_revenue_export_url?: string | null
          alarm_code?: string | null
          average_booking_window?: number | null
          average_daily_rate?: number | null
          average_monthly_revenue?: number | null
          backup_cleaner?: string | null
          backup_key_location?: string | null
          breaker_panel_location?: string | null
          camera_locations?: string | null
          camera_login_credentials?: string | null
          camera_login_website?: string | null
          cleaner_payment?: string | null
          cleaner_quality?: string | null
          cleaner_satisfaction?: string | null
          competitor_insights?: string | null
          created_at?: string
          emergency_contact_24_7?: string | null
          entity_documents_url?: string | null
          entity_ownership?: string | null
          error_message?: string | null
          existing_photos_link?: string | null
          expense_report_url?: string | null
          file_urls?: Json | null
          fire_extinguisher_locations?: string | null
          garage_code?: string | null
          gas_shutoff_location?: string | null
          gate_code?: string | null
          government_id_url?: string | null
          guest_avatar?: string | null
          guide_book_url?: string | null
          has_cameras?: boolean | null
          has_hoa?: boolean | null
          has_security_system?: boolean | null
          has_thermostat?: boolean | null
          hoa_contact_name?: string | null
          hoa_contact_phone?: string | null
          hoa_rules_url?: string | null
          house_manual_url?: string | null
          house_quirks?: string | null
          hvac_service?: string | null
          id?: string
          insurance_corporate_contacts?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          known_maintenance_issues?: string | null
          last_year_revenue?: number | null
          laundry_notes?: string | null
          lawncare_provider?: string | null
          lockbox_code?: string | null
          maids_closet_code?: string | null
          maintenance_contact?: string | null
          max_vehicles?: number | null
          mortgage_statement_url?: string | null
          occupancy_rate?: number | null
          other_listing_links?: string | null
          owner_email: string
          owner_id?: string | null
          owner_name: string
          owner_phone?: string | null
          ownerrez_revenue_export_url?: string | null
          parking_instructions?: string | null
          parking_map_url?: string | null
          peak_season?: string | null
          peak_season_adr?: number | null
          permit_number?: string | null
          pest_control_provider?: string | null
          pet_deposit?: number | null
          pet_size_restrictions?: string | null
          pets_allowed?: boolean | null
          pool_hot_tub_info?: string | null
          pricing_revenue_goals?: string | null
          primary_cleaner?: string | null
          processed_at?: string | null
          project_id?: string | null
          property_address: string
          property_deed_url?: string | null
          property_id?: string | null
          property_tax_statement_url?: string | null
          recent_renovations?: string | null
          revenue_statement_url?: string | null
          security_brand?: string | null
          sensitive_neighbor_notes?: string | null
          septic_company?: string | null
          septic_last_pumped?: string | null
          smart_lock_brand?: string | null
          smart_lock_code?: string | null
          smoke_co_detector_status?: string | null
          status?: string
          str_permit_status?: string | null
          supply_closet_location?: string | null
          thermostat_login?: string | null
          trash_bin_location?: string | null
          trash_pickup_day?: string | null
          unique_selling_points?: string | null
          updated_at?: string
          utilities?: Json | null
          vrbo_link?: string | null
          vrbo_revenue_export_url?: string | null
          wastewater_system?: string | null
          water_shutoff_location?: string | null
          wifi_password?: string | null
          wifi_ssid?: string | null
        }
        Update: {
          airbnb_link?: string | null
          airbnb_revenue_export_url?: string | null
          alarm_code?: string | null
          average_booking_window?: number | null
          average_daily_rate?: number | null
          average_monthly_revenue?: number | null
          backup_cleaner?: string | null
          backup_key_location?: string | null
          breaker_panel_location?: string | null
          camera_locations?: string | null
          camera_login_credentials?: string | null
          camera_login_website?: string | null
          cleaner_payment?: string | null
          cleaner_quality?: string | null
          cleaner_satisfaction?: string | null
          competitor_insights?: string | null
          created_at?: string
          emergency_contact_24_7?: string | null
          entity_documents_url?: string | null
          entity_ownership?: string | null
          error_message?: string | null
          existing_photos_link?: string | null
          expense_report_url?: string | null
          file_urls?: Json | null
          fire_extinguisher_locations?: string | null
          garage_code?: string | null
          gas_shutoff_location?: string | null
          gate_code?: string | null
          government_id_url?: string | null
          guest_avatar?: string | null
          guide_book_url?: string | null
          has_cameras?: boolean | null
          has_hoa?: boolean | null
          has_security_system?: boolean | null
          has_thermostat?: boolean | null
          hoa_contact_name?: string | null
          hoa_contact_phone?: string | null
          hoa_rules_url?: string | null
          house_manual_url?: string | null
          house_quirks?: string | null
          hvac_service?: string | null
          id?: string
          insurance_corporate_contacts?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          known_maintenance_issues?: string | null
          last_year_revenue?: number | null
          laundry_notes?: string | null
          lawncare_provider?: string | null
          lockbox_code?: string | null
          maids_closet_code?: string | null
          maintenance_contact?: string | null
          max_vehicles?: number | null
          mortgage_statement_url?: string | null
          occupancy_rate?: number | null
          other_listing_links?: string | null
          owner_email?: string
          owner_id?: string | null
          owner_name?: string
          owner_phone?: string | null
          ownerrez_revenue_export_url?: string | null
          parking_instructions?: string | null
          parking_map_url?: string | null
          peak_season?: string | null
          peak_season_adr?: number | null
          permit_number?: string | null
          pest_control_provider?: string | null
          pet_deposit?: number | null
          pet_size_restrictions?: string | null
          pets_allowed?: boolean | null
          pool_hot_tub_info?: string | null
          pricing_revenue_goals?: string | null
          primary_cleaner?: string | null
          processed_at?: string | null
          project_id?: string | null
          property_address?: string
          property_deed_url?: string | null
          property_id?: string | null
          property_tax_statement_url?: string | null
          recent_renovations?: string | null
          revenue_statement_url?: string | null
          security_brand?: string | null
          sensitive_neighbor_notes?: string | null
          septic_company?: string | null
          septic_last_pumped?: string | null
          smart_lock_brand?: string | null
          smart_lock_code?: string | null
          smoke_co_detector_status?: string | null
          status?: string
          str_permit_status?: string | null
          supply_closet_location?: string | null
          thermostat_login?: string | null
          trash_bin_location?: string | null
          trash_pickup_day?: string | null
          unique_selling_points?: string | null
          updated_at?: string
          utilities?: Json | null
          vrbo_link?: string | null
          vrbo_revenue_export_url?: string | null
          wastewater_system?: string | null
          water_shutoff_location?: string | null
          wifi_password?: string | null
          wifi_ssid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_onboarding_submissions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_onboarding_submissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_onboarding_submissions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_onboarding_submissions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_portal_access: {
        Row: {
          created_at: string | null
          default_view: string | null
          email: string
          id: string
          last_login_at: string | null
          login_count: number | null
          magic_link_expires_at: string | null
          magic_link_token: string | null
          notification_level: string | null
          notify_approval_needed: boolean | null
          notify_monthly_report: boolean | null
          notify_work_completed: boolean | null
          notify_work_requested: boolean | null
          notify_work_scheduled: boolean | null
          owner_id: string
          prefer_sms: boolean | null
          sms_phone: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_view?: string | null
          email: string
          id?: string
          last_login_at?: string | null
          login_count?: number | null
          magic_link_expires_at?: string | null
          magic_link_token?: string | null
          notification_level?: string | null
          notify_approval_needed?: boolean | null
          notify_monthly_report?: boolean | null
          notify_work_completed?: boolean | null
          notify_work_requested?: boolean | null
          notify_work_scheduled?: boolean | null
          owner_id: string
          prefer_sms?: boolean | null
          sms_phone?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_view?: string | null
          email?: string
          id?: string
          last_login_at?: string | null
          login_count?: number | null
          magic_link_expires_at?: string | null
          magic_link_token?: string | null
          notification_level?: string | null
          notify_approval_needed?: boolean | null
          notify_monthly_report?: boolean | null
          notify_work_completed?: boolean | null
          notify_work_requested?: boolean | null
          notify_work_scheduled?: boolean | null
          owner_id?: string
          prefer_sms?: boolean | null
          sms_phone?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_portal_access_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_portal_sessions: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          ip_address: string | null
          is_admin_preview: boolean | null
          owner_id: string
          property_id: string | null
          property_name: string | null
          token: string
          used_at: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          ip_address?: string | null
          is_admin_preview?: boolean | null
          owner_id: string
          property_id?: string | null
          property_name?: string | null
          token: string
          used_at?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          is_admin_preview?: boolean | null
          owner_id?: string
          property_id?: string | null
          property_name?: string | null
          token?: string
          used_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_portal_sessions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_statement_archive: {
        Row: {
          created_at: string | null
          id: string
          is_revision: boolean | null
          line_items_snapshot: Json
          management_fee: number
          net_owner_result: number
          owner_id: string
          property_id: string
          recipient_emails: string[]
          reconciliation_id: string | null
          revision_number: number | null
          sent_at: string | null
          sent_by: string | null
          statement_date: string
          statement_html: string
          statement_month: string
          statement_number: string
          statement_pdf_path: string | null
          total_expenses: number
          total_revenue: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_revision?: boolean | null
          line_items_snapshot: Json
          management_fee: number
          net_owner_result: number
          owner_id: string
          property_id: string
          recipient_emails: string[]
          reconciliation_id?: string | null
          revision_number?: number | null
          sent_at?: string | null
          sent_by?: string | null
          statement_date: string
          statement_html: string
          statement_month: string
          statement_number: string
          statement_pdf_path?: string | null
          total_expenses: number
          total_revenue: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_revision?: boolean | null
          line_items_snapshot?: Json
          management_fee?: number
          net_owner_result?: number
          owner_id?: string
          property_id?: string
          recipient_emails?: string[]
          reconciliation_id?: string | null
          revision_number?: number | null
          sent_at?: string | null
          sent_by?: string | null
          statement_date?: string
          statement_html?: string
          statement_month?: string
          statement_number?: string
          statement_pdf_path?: string | null
          total_expenses?: number
          total_revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "owner_statement_archive_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "monthly_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      ownerrez_bookings: {
        Row: {
          accommodation_revenue: number | null
          booking_id: string | null
          booking_status: string | null
          check_in: string | null
          check_out: string | null
          cleaning_fee: number | null
          created_at: string
          guest_name: string | null
          id: string
          management_fee: number
          other_fees: number | null
          ownerrez_listing_id: string
          ownerrez_listing_name: string
          pet_fee: number | null
          promotions_discount: number | null
          property_id: string | null
          sync_date: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          accommodation_revenue?: number | null
          booking_id?: string | null
          booking_status?: string | null
          check_in?: string | null
          check_out?: string | null
          cleaning_fee?: number | null
          created_at?: string
          guest_name?: string | null
          id?: string
          management_fee?: number
          other_fees?: number | null
          ownerrez_listing_id: string
          ownerrez_listing_name: string
          pet_fee?: number | null
          promotions_discount?: number | null
          property_id?: string | null
          sync_date?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          accommodation_revenue?: number | null
          booking_id?: string | null
          booking_status?: string | null
          check_in?: string | null
          check_out?: string | null
          cleaning_fee?: number | null
          created_at?: string
          guest_name?: string | null
          id?: string
          management_fee?: number
          other_fees?: number | null
          ownerrez_listing_id?: string
          ownerrez_listing_name?: string
          pet_fee?: number | null
          promotions_discount?: number | null
          property_id?: string | null
          sync_date?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ownerrez_bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ownerrez_bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      ownerrez_reviews: {
        Row: {
          booking_id: string
          created_at: string | null
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          ownerrez_review_id: string | null
          property_id: string | null
          review_date: string | null
          review_source: string | null
          review_text: string | null
          star_rating: number | null
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          ownerrez_review_id?: string | null
          property_id?: string | null
          review_date?: string | null
          review_source?: string | null
          review_text?: string | null
          star_rating?: number | null
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          ownerrez_review_id?: string | null
          property_id?: string | null
          review_date?: string | null
          review_source?: string | null
          review_text?: string | null
          star_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ownerrez_reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ownerrez_reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_properties: {
        Row: {
          address: string | null
          amenities: Json | null
          appliances_included: string[] | null
          bathrooms: number | null
          bedrooms: number | null
          calculated_listing_price: number | null
          category: string
          city: string | null
          cleaning_fee: number | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          existing_listing_url: string | null
          featured_image_url: string | null
          gallery_images: string[] | null
          ical_url: string | null
          id: string
          is_public: boolean | null
          max_guests: number | null
          monthly_price: number | null
          parking_spaces: number | null
          parking_type: string | null
          pet_policy: string | null
          pet_policy_details: string | null
          property_description: string | null
          property_title: string | null
          property_type: string | null
          security_deposit: number | null
          services_included: string[] | null
          slug: string | null
          source_id: string
          source_system: string
          square_footage: number | null
          state: string | null
          status: string | null
          stories: number | null
          synced_at: string | null
          updated_at: string | null
          utilities_included: string[] | null
          virtual_tour_url: string | null
          year_built: number | null
          zillow_last_fetched: string | null
          zillow_rent_zestimate: number | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          amenities?: Json | null
          appliances_included?: string[] | null
          bathrooms?: number | null
          bedrooms?: number | null
          calculated_listing_price?: number | null
          category?: string
          city?: string | null
          cleaning_fee?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          existing_listing_url?: string | null
          featured_image_url?: string | null
          gallery_images?: string[] | null
          ical_url?: string | null
          id?: string
          is_public?: boolean | null
          max_guests?: number | null
          monthly_price?: number | null
          parking_spaces?: number | null
          parking_type?: string | null
          pet_policy?: string | null
          pet_policy_details?: string | null
          property_description?: string | null
          property_title?: string | null
          property_type?: string | null
          security_deposit?: number | null
          services_included?: string[] | null
          slug?: string | null
          source_id: string
          source_system?: string
          square_footage?: number | null
          state?: string | null
          status?: string | null
          stories?: number | null
          synced_at?: string | null
          updated_at?: string | null
          utilities_included?: string[] | null
          virtual_tour_url?: string | null
          year_built?: number | null
          zillow_last_fetched?: string | null
          zillow_rent_zestimate?: number | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          amenities?: Json | null
          appliances_included?: string[] | null
          bathrooms?: number | null
          bedrooms?: number | null
          calculated_listing_price?: number | null
          category?: string
          city?: string | null
          cleaning_fee?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          existing_listing_url?: string | null
          featured_image_url?: string | null
          gallery_images?: string[] | null
          ical_url?: string | null
          id?: string
          is_public?: boolean | null
          max_guests?: number | null
          monthly_price?: number | null
          parking_spaces?: number | null
          parking_type?: string | null
          pet_policy?: string | null
          pet_policy_details?: string | null
          property_description?: string | null
          property_title?: string | null
          property_type?: string | null
          security_deposit?: number | null
          services_included?: string[] | null
          slug?: string | null
          source_id?: string
          source_system?: string
          square_footage?: number | null
          state?: string | null
          status?: string | null
          stories?: number | null
          synced_at?: string | null
          updated_at?: string | null
          utilities_included?: string[] | null
          virtual_tour_url?: string | null
          year_built?: number | null
          zillow_last_fetched?: string | null
          zillow_rent_zestimate?: number | null
          zip_code?: string | null
        }
        Relationships: []
      }
      partner_sync_log: {
        Row: {
          completed_at: string | null
          created_at: string
          error_details: Json | null
          id: string
          properties_failed: number
          properties_synced: number
          source_system: string
          started_at: string
          sync_status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_details?: Json | null
          id?: string
          properties_failed?: number
          properties_synced?: number
          source_system: string
          started_at?: string
          sync_status?: string
          sync_type?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_details?: Json | null
          id?: string
          properties_failed?: number
          properties_synced?: number
          source_system?: string
          started_at?: string
          sync_status?: string
          sync_type?: string
        }
        Relationships: []
      }
      payment_setup_requests: {
        Row: {
          completed_at: string | null
          created_at: string | null
          final_reminder_sent_at: string | null
          id: string
          initial_sent_at: string
          owner_id: string
          reminder_1_sent_at: string | null
          reminder_2_sent_at: string | null
          status: string
          stripe_session_url: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          final_reminder_sent_at?: string | null
          id?: string
          initial_sent_at?: string
          owner_id: string
          reminder_1_sent_at?: string | null
          reminder_2_sent_at?: string | null
          status?: string
          stripe_session_url?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          final_reminder_sent_at?: string | null
          id?: string
          initial_sent_at?: string
          owner_id?: string
          reminder_1_sent_at?: string | null
          reminder_2_sent_at?: string | null
          status?: string
          stripe_session_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_setup_requests_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_actions: {
        Row: {
          action_type: string
          approved_at: string | null
          approved_by: string | null
          channel: string | null
          communication_id: string | null
          created_at: string | null
          description: string | null
          detected_intent: string | null
          dismissed_reason: string | null
          id: string
          lead_id: string | null
          owner_id: string | null
          property_id: string | null
          sentiment_score: number | null
          status: string | null
          suggested_response: string | null
          title: string
          updated_at: string | null
          urgency: string | null
        }
        Insert: {
          action_type: string
          approved_at?: string | null
          approved_by?: string | null
          channel?: string | null
          communication_id?: string | null
          created_at?: string | null
          description?: string | null
          detected_intent?: string | null
          dismissed_reason?: string | null
          id?: string
          lead_id?: string | null
          owner_id?: string | null
          property_id?: string | null
          sentiment_score?: number | null
          status?: string | null
          suggested_response?: string | null
          title: string
          updated_at?: string | null
          urgency?: string | null
        }
        Update: {
          action_type?: string
          approved_at?: string | null
          approved_by?: string | null
          channel?: string | null
          communication_id?: string | null
          created_at?: string | null
          description?: string | null
          detected_intent?: string | null
          dismissed_reason?: string | null
          id?: string
          lead_id?: string | null
          owner_id?: string | null
          property_id?: string | null
          sentiment_score?: number | null
          status?: string | null
          suggested_response?: string | null
          title?: string
          updated_at?: string | null
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_actions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_actions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_actions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_actions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_call_recaps: {
        Row: {
          action_items: Json | null
          assigned_to_user_id: string | null
          call_date: string
          call_duration: number | null
          caller_user_id: string | null
          communication_id: string | null
          created_at: string
          dismissed_reason: string | null
          email_body: string
          id: string
          key_topics: Json | null
          lead_id: string | null
          owner_id: string | null
          property_id: string | null
          recipient_email: string | null
          recipient_name: string
          recipient_phone: string | null
          recipient_type: string
          sent_at: string | null
          sent_by: string | null
          sentiment: string | null
          status: string
          subject: string
          transcript_summary: string | null
          updated_at: string
        }
        Insert: {
          action_items?: Json | null
          assigned_to_user_id?: string | null
          call_date: string
          call_duration?: number | null
          caller_user_id?: string | null
          communication_id?: string | null
          created_at?: string
          dismissed_reason?: string | null
          email_body: string
          id?: string
          key_topics?: Json | null
          lead_id?: string | null
          owner_id?: string | null
          property_id?: string | null
          recipient_email?: string | null
          recipient_name: string
          recipient_phone?: string | null
          recipient_type?: string
          sent_at?: string | null
          sent_by?: string | null
          sentiment?: string | null
          status?: string
          subject: string
          transcript_summary?: string | null
          updated_at?: string
        }
        Update: {
          action_items?: Json | null
          assigned_to_user_id?: string | null
          call_date?: string
          call_duration?: number | null
          caller_user_id?: string | null
          communication_id?: string | null
          created_at?: string
          dismissed_reason?: string | null
          email_body?: string
          id?: string
          key_topics?: Json | null
          lead_id?: string | null
          owner_id?: string | null
          property_id?: string | null
          recipient_email?: string | null
          recipient_name?: string
          recipient_phone?: string | null
          recipient_type?: string
          sent_at?: string | null
          sent_by?: string | null
          sentiment?: string | null
          status?: string
          subject?: string
          transcript_summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_call_recaps_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "lead_communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_call_recaps_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_call_recaps_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_call_recaps_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_call_recaps_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_task_confirmations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assigned_to_user_id: string | null
          caller_user_id: string | null
          created_at: string | null
          created_task_id: string | null
          expires_at: string | null
          ghl_call_id: string | null
          id: string
          owner_id: string | null
          phase_suggestion: number | null
          priority: string | null
          property_id: string | null
          rejection_reason: string | null
          source_id: string | null
          source_quote: string | null
          source_type: string
          status: string | null
          task_category: string | null
          task_description: string | null
          task_title: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_to_user_id?: string | null
          caller_user_id?: string | null
          created_at?: string | null
          created_task_id?: string | null
          expires_at?: string | null
          ghl_call_id?: string | null
          id?: string
          owner_id?: string | null
          phase_suggestion?: number | null
          priority?: string | null
          property_id?: string | null
          rejection_reason?: string | null
          source_id?: string | null
          source_quote?: string | null
          source_type: string
          status?: string | null
          task_category?: string | null
          task_description?: string | null
          task_title: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_to_user_id?: string | null
          caller_user_id?: string | null
          created_at?: string | null
          created_task_id?: string | null
          expires_at?: string | null
          ghl_call_id?: string | null
          id?: string
          owner_id?: string | null
          phase_suggestion?: number | null
          priority?: string | null
          property_id?: string | null
          rejection_reason?: string | null
          source_id?: string | null
          source_quote?: string | null
          source_type?: string
          status?: string | null
          task_category?: string | null
          task_description?: string | null
          task_title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_task_confirmations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_task_confirmations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_task_confirmations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      permit_reminders: {
        Row: {
          created_at: string
          document_id: string
          id: string
          permit_expiration_date: string
          permit_number: string | null
          property_id: string
          reminder_email_to: string | null
          reminder_sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          permit_expiration_date: string
          permit_number?: string | null
          property_id: string
          reminder_email_to?: string | null
          reminder_sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          permit_expiration_date?: string
          permit_number?: string | null
          property_id?: string
          reminder_email_to?: string | null
          reminder_sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permit_reminders_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "property_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permit_reminders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permit_reminders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      phase_role_assignments: {
        Row: {
          created_at: string
          id: string
          phase_number: number
          phase_title: string
          role_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          phase_number: number
          phase_title: string
          role_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          phase_number?: number
          phase_title?: string
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phase_role_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "team_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_lookups: {
        Row: {
          caller_name: string | null
          carrier: string | null
          created_at: string
          e164_phone: string | null
          id: string
          line_type: string | null
          looked_up_at: string | null
          phone: string
          raw_response: Json | null
          valid: boolean | null
        }
        Insert: {
          caller_name?: string | null
          carrier?: string | null
          created_at?: string
          e164_phone?: string | null
          id?: string
          line_type?: string | null
          looked_up_at?: string | null
          phone: string
          raw_response?: Json | null
          valid?: boolean | null
        }
        Update: {
          caller_name?: string | null
          carrier?: string | null
          created_at?: string
          e164_phone?: string | null
          id?: string
          line_type?: string | null
          looked_up_at?: string | null
          phone?: string
          raw_response?: Json | null
          valid?: boolean | null
        }
        Relationships: []
      }
      platform_listings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          last_updated: string | null
          listing_url: string | null
          platform_name: string
          property_id: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_updated?: string | null
          listing_url?: string | null
          platform_name: string
          property_id: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_updated?: string | null
          listing_url?: string | null
          platform_name?: string
          property_id?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_listings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_listings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      positive_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_description: string | null
          event_title: string
          event_type: string
          id: string
          occurred_at: string
          owner_id: string | null
          property_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_description?: string | null
          event_title: string
          event_type: string
          id?: string
          occurred_at?: string
          owner_id?: string | null
          property_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_description?: string | null
          event_title?: string
          event_type?: string
          id?: string
          occurred_at?: string
          owner_id?: string | null
          property_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "positive_events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positive_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positive_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          assigned_phone_number: string | null
          avatar_url: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          is_admin: boolean
          job_title: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          assigned_phone_number?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          is_admin?: boolean
          job_title?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          assigned_phone_number?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          is_admin?: boolean
          job_title?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          billing_status: string | null
          contract_document_id: string | null
          contract_signed_at: string | null
          created_at: string
          first_listing_live_at: string | null
          first_minimum_charged_at: string | null
          ical_url: string | null
          id: string
          image_path: string | null
          management_fee_percentage: number
          name: string
          nightly_rate: number | null
          offboarded_at: string | null
          offboarding_notes: string | null
          offboarding_reason: string | null
          onboarding_fee_amount: number | null
          onboarding_fee_charged_at: string | null
          order_minimum_fee: number | null
          owner_id: string | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          rental_type: string | null
          user_id: string | null
          visit_price: number
        }
        Insert: {
          address: string
          billing_status?: string | null
          contract_document_id?: string | null
          contract_signed_at?: string | null
          created_at?: string
          first_listing_live_at?: string | null
          first_minimum_charged_at?: string | null
          ical_url?: string | null
          id?: string
          image_path?: string | null
          management_fee_percentage?: number
          name: string
          nightly_rate?: number | null
          offboarded_at?: string | null
          offboarding_notes?: string | null
          offboarding_reason?: string | null
          onboarding_fee_amount?: number | null
          onboarding_fee_charged_at?: string | null
          order_minimum_fee?: number | null
          owner_id?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          rental_type?: string | null
          user_id?: string | null
          visit_price?: number
        }
        Update: {
          address?: string
          billing_status?: string | null
          contract_document_id?: string | null
          contract_signed_at?: string | null
          created_at?: string
          first_listing_live_at?: string | null
          first_minimum_charged_at?: string | null
          ical_url?: string | null
          id?: string
          image_path?: string | null
          management_fee_percentage?: number
          name?: string
          nightly_rate?: number | null
          offboarded_at?: string | null
          offboarding_notes?: string | null
          offboarding_reason?: string | null
          onboarding_fee_amount?: number | null
          onboarding_fee_charged_at?: string | null
          order_minimum_fee?: number | null
          owner_id?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          rental_type?: string | null
          user_id?: string | null
          visit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "properties_contract_document_id_fkey"
            columns: ["contract_document_id"]
            isOneToOne: false
            referencedRelation: "booking_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      property_appliances: {
        Row: {
          appliance_type: string
          brand: string | null
          created_at: string
          id: string
          location: string | null
          model: string | null
          notes: string | null
          property_id: string
          serial_number: string | null
          updated_at: string
          warranty_info: string | null
          year: number | null
        }
        Insert: {
          appliance_type: string
          brand?: string | null
          created_at?: string
          id?: string
          location?: string | null
          model?: string | null
          notes?: string | null
          property_id: string
          serial_number?: string | null
          updated_at?: string
          warranty_info?: string | null
          year?: number | null
        }
        Update: {
          appliance_type?: string
          brand?: string | null
          created_at?: string
          id?: string
          location?: string | null
          model?: string | null
          notes?: string | null
          property_id?: string
          serial_number?: string | null
          updated_at?: string
          warranty_info?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "property_appliances_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_appliances_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_contact_info: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          property_id: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          property_id: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          property_id?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_contact_info_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_contact_info_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_credentials: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          password: string | null
          property_id: string
          service_name: string
          updated_at: string
          url: string | null
          username: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          password?: string | null
          property_id: string
          service_name: string
          updated_at?: string
          url?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          password?: string | null
          property_id?: string
          service_name?: string
          updated_at?: string
          url?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_credentials_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_credentials_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_details: {
        Row: {
          ada_compliant: boolean | null
          basement: boolean | null
          bathrooms: number | null
          bedrooms: number | null
          brand_name: string | null
          created_at: string
          fenced_yard: string | null
          id: string
          parking_spaces: string | null
          parking_type: string | null
          property_id: string
          property_type_detail: string | null
          sqft: number | null
          stories: string | null
          updated_at: string
        }
        Insert: {
          ada_compliant?: boolean | null
          basement?: boolean | null
          bathrooms?: number | null
          bedrooms?: number | null
          brand_name?: string | null
          created_at?: string
          fenced_yard?: string | null
          id?: string
          parking_spaces?: string | null
          parking_type?: string | null
          property_id: string
          property_type_detail?: string | null
          sqft?: number | null
          stories?: string | null
          updated_at?: string
        }
        Update: {
          ada_compliant?: boolean | null
          basement?: boolean | null
          bathrooms?: number | null
          bedrooms?: number | null
          brand_name?: string | null
          created_at?: string
          fenced_yard?: string | null
          id?: string
          parking_spaces?: string | null
          parking_type?: string | null
          property_id?: string
          property_type_detail?: string | null
          sqft?: number | null
          stories?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_details_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_details_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_documents: {
        Row: {
          ai_extracted_data: Json | null
          created_at: string
          description: string | null
          document_type: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          permit_expiration_date: string | null
          permit_reminder_sent: boolean | null
          project_id: string | null
          property_id: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          ai_extracted_data?: Json | null
          created_at?: string
          description?: string | null
          document_type?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          permit_expiration_date?: string | null
          permit_reminder_sent?: boolean | null
          project_id?: string | null
          property_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          ai_extracted_data?: Json | null
          created_at?: string
          description?: string | null
          document_type?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          permit_expiration_date?: string | null
          permit_reminder_sent?: boolean | null
          project_id?: string | null
          property_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_financial_data: {
        Row: {
          airbnb_revenue_export_url: string | null
          average_booking_window: number | null
          average_daily_rate: number | null
          average_monthly_revenue: number | null
          competitor_insights: string | null
          created_at: string
          expense_report_url: string | null
          id: string
          last_year_revenue: number | null
          occupancy_rate: number | null
          ownerrez_revenue_export_url: string | null
          peak_season: string | null
          peak_season_adr: number | null
          pricing_revenue_goals: string | null
          property_id: string
          revenue_statement_url: string | null
          submission_id: string | null
          updated_at: string
          vrbo_revenue_export_url: string | null
        }
        Insert: {
          airbnb_revenue_export_url?: string | null
          average_booking_window?: number | null
          average_daily_rate?: number | null
          average_monthly_revenue?: number | null
          competitor_insights?: string | null
          created_at?: string
          expense_report_url?: string | null
          id?: string
          last_year_revenue?: number | null
          occupancy_rate?: number | null
          ownerrez_revenue_export_url?: string | null
          peak_season?: string | null
          peak_season_adr?: number | null
          pricing_revenue_goals?: string | null
          property_id: string
          revenue_statement_url?: string | null
          submission_id?: string | null
          updated_at?: string
          vrbo_revenue_export_url?: string | null
        }
        Update: {
          airbnb_revenue_export_url?: string | null
          average_booking_window?: number | null
          average_daily_rate?: number | null
          average_monthly_revenue?: number | null
          competitor_insights?: string | null
          created_at?: string
          expense_report_url?: string | null
          id?: string
          last_year_revenue?: number | null
          occupancy_rate?: number | null
          ownerrez_revenue_export_url?: string | null
          peak_season?: string | null
          peak_season_adr?: number | null
          pricing_revenue_goals?: string | null
          property_id?: string
          revenue_statement_url?: string | null
          submission_id?: string | null
          updated_at?: string
          vrbo_revenue_export_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_financial_data_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_financial_data_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_financial_data_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "owner_onboarding_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      property_intel_items: {
        Row: {
          category: string
          content: Json | null
          created_at: string
          description: string | null
          id: string
          is_visible: boolean | null
          property_id: string
          source_id: string | null
          source_type: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          content?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_visible?: boolean | null
          property_id: string
          source_id?: string | null
          source_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_visible?: boolean | null
          property_id?: string
          source_id?: string | null
          source_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_intel_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_intel_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_maintenance_book: {
        Row: {
          access_instructions: string | null
          alarm_code: string | null
          appliance_spend_limit: number | null
          auto_approve_preferred_vendors: boolean | null
          cleaning_spend_limit: number | null
          created_at: string | null
          electrical_spend_limit: number | null
          emergency_authorization_limit: number | null
          exterior_spend_limit: number | null
          gate_code: string | null
          general_spend_limit: number | null
          hvac_spend_limit: number | null
          id: string
          lockbox_code: string | null
          maintenance_notes: string | null
          owner_prefers_lowest_bid: boolean | null
          plumbing_spend_limit: number | null
          preferred_contact_method: string | null
          property_id: string
          require_multiple_quotes_above: number | null
          require_owner_approval_above: number | null
          special_instructions: string | null
          updated_at: string | null
          vendor_access_code: string | null
        }
        Insert: {
          access_instructions?: string | null
          alarm_code?: string | null
          appliance_spend_limit?: number | null
          auto_approve_preferred_vendors?: boolean | null
          cleaning_spend_limit?: number | null
          created_at?: string | null
          electrical_spend_limit?: number | null
          emergency_authorization_limit?: number | null
          exterior_spend_limit?: number | null
          gate_code?: string | null
          general_spend_limit?: number | null
          hvac_spend_limit?: number | null
          id?: string
          lockbox_code?: string | null
          maintenance_notes?: string | null
          owner_prefers_lowest_bid?: boolean | null
          plumbing_spend_limit?: number | null
          preferred_contact_method?: string | null
          property_id: string
          require_multiple_quotes_above?: number | null
          require_owner_approval_above?: number | null
          special_instructions?: string | null
          updated_at?: string | null
          vendor_access_code?: string | null
        }
        Update: {
          access_instructions?: string | null
          alarm_code?: string | null
          appliance_spend_limit?: number | null
          auto_approve_preferred_vendors?: boolean | null
          cleaning_spend_limit?: number | null
          created_at?: string | null
          electrical_spend_limit?: number | null
          emergency_authorization_limit?: number | null
          exterior_spend_limit?: number | null
          gate_code?: string | null
          general_spend_limit?: number | null
          hvac_spend_limit?: number | null
          id?: string
          lockbox_code?: string | null
          maintenance_notes?: string | null
          owner_prefers_lowest_bid?: boolean | null
          plumbing_spend_limit?: number | null
          preferred_contact_method?: string | null
          property_id?: string
          require_multiple_quotes_above?: number | null
          require_owner_approval_above?: number | null
          special_instructions?: string | null
          updated_at?: string | null
          vendor_access_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_maintenance_book_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_maintenance_book_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_owners: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string
          has_payment_method: boolean | null
          id: string
          name: string
          payment_method: string
          payout_bank_account_id: string | null
          payout_method: string | null
          phone: string | null
          second_owner_email: string | null
          second_owner_name: string | null
          service_type: string
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email: string
          has_payment_method?: boolean | null
          id?: string
          name: string
          payment_method: string
          payout_bank_account_id?: string | null
          payout_method?: string | null
          phone?: string | null
          second_owner_email?: string | null
          second_owner_name?: string | null
          service_type?: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string
          has_payment_method?: boolean | null
          id?: string
          name?: string
          payment_method?: string
          payout_bank_account_id?: string | null
          payout_method?: string | null
          phone?: string | null
          second_owner_email?: string | null
          second_owner_name?: string | null
          service_type?: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      property_policies: {
        Row: {
          created_at: string
          id: string
          lease_term: string | null
          max_pet_weight: number | null
          max_pets: number | null
          notice_to_vacate: string | null
          pet_rules: string | null
          pets_allowed: boolean | null
          property_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lease_term?: string | null
          max_pet_weight?: number | null
          max_pets?: number | null
          notice_to_vacate?: string | null
          pet_rules?: string | null
          pets_allowed?: boolean | null
          property_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lease_term?: string | null
          max_pet_weight?: number | null
          max_pets?: number | null
          notice_to_vacate?: string | null
          pet_rules?: string | null
          pets_allowed?: boolean | null
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_policies_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_policies_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_pricing_history: {
        Row: {
          admin_fee: number | null
          cleaning_fee: number | null
          created_at: string
          effective_date: string
          end_date: string | null
          id: string
          is_current: boolean | null
          monthly_cleaning_fee: number | null
          monthly_pet_rent: number | null
          monthly_rent: number | null
          nightly_rate: number | null
          pet_fee: number | null
          property_id: string
          security_deposit: number | null
          updated_by: string | null
          utility_cap: number | null
        }
        Insert: {
          admin_fee?: number | null
          cleaning_fee?: number | null
          created_at?: string
          effective_date?: string
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          monthly_cleaning_fee?: number | null
          monthly_pet_rent?: number | null
          monthly_rent?: number | null
          nightly_rate?: number | null
          pet_fee?: number | null
          property_id: string
          security_deposit?: number | null
          updated_by?: string | null
          utility_cap?: number | null
        }
        Update: {
          admin_fee?: number | null
          cleaning_fee?: number | null
          created_at?: string
          effective_date?: string
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          monthly_cleaning_fee?: number | null
          monthly_pet_rent?: number | null
          monthly_rent?: number | null
          nightly_rate?: number | null
          pet_fee?: number | null
          property_id?: string
          security_deposit?: number | null
          updated_by?: string | null
          utility_cap?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "property_pricing_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_pricing_history_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_schools: {
        Row: {
          created_at: string
          elementary_school: string | null
          high_school: string | null
          id: string
          middle_school: string | null
          property_id: string
          school_district: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          elementary_school?: string | null
          high_school?: string | null
          id?: string
          middle_school?: string | null
          property_id: string
          school_district?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          elementary_school?: string | null
          high_school?: string | null
          id?: string
          middle_school?: string | null
          property_id?: string
          school_district?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_schools_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_schools_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_setup_tasks: {
        Row: {
          category: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          id: string
          lead_id: string | null
          notes: string | null
          priority: string | null
          property_id: string | null
          status: string | null
          task_type: string
          title: string
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          priority?: string | null
          property_id?: string | null
          status?: string | null
          task_type: string
          title: string
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          priority?: string | null
          property_id?: string | null
          status?: string | null
          task_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_setup_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_setup_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_setup_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_vendor_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string | null
          id: string
          is_primary: boolean | null
          monthly_cost: number | null
          notes: string | null
          property_id: string
          specialty: string
          spend_limit: number | null
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          monthly_cost?: number | null
          notes?: string | null
          property_id: string
          specialty: string
          spend_limit?: number | null
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          monthly_cost?: number | null
          notes?: string | null
          property_id?: string
          specialty?: string
          spend_limit?: number | null
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_vendor_assignments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_vendor_assignments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_vendor_assignments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string | null
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string | null
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reconciliation_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          item_id: string | null
          new_values: Json | null
          notes: string | null
          previous_values: Json | null
          reconciliation_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          item_id?: string | null
          new_values?: Json | null
          notes?: string | null
          previous_values?: Json | null
          reconciliation_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          item_id?: string | null
          new_values?: Json | null
          notes?: string | null
          previous_values?: Json | null
          reconciliation_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_audit_log_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "monthly_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_line_items: {
        Row: {
          added_by: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          category: string | null
          created_at: string
          date: string
          description: string
          excluded: boolean | null
          exclusion_reason: string | null
          fee_type: string | null
          id: string
          item_id: string
          item_type: string
          notes: string | null
          reconciliation_id: string
          source: string | null
          verified: boolean | null
        }
        Insert: {
          added_by?: string | null
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          created_at?: string
          date: string
          description: string
          excluded?: boolean | null
          exclusion_reason?: string | null
          fee_type?: string | null
          id?: string
          item_id: string
          item_type: string
          notes?: string | null
          reconciliation_id: string
          source?: string | null
          verified?: boolean | null
        }
        Update: {
          added_by?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          created_at?: string
          date?: string
          description?: string
          excluded?: boolean | null
          exclusion_reason?: string | null
          fee_type?: string | null
          id?: string
          item_id?: string
          item_type?: string
          notes?: string | null
          reconciliation_id?: string
          source?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_line_items_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "monthly_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_communications: {
        Row: {
          ai_category: string | null
          ai_extracted_amounts: Json | null
          ai_extracted_contacts: Json | null
          ai_extracted_dates: Json | null
          ai_summary: string | null
          id: string
          is_pinned: boolean
          lead_id: string | null
          message_content: string
          message_date: string
          message_id: string
          message_snippet: string | null
          message_subject: string | null
          message_type: string
          owner_id: string | null
          property_id: string | null
          save_reason: string
          saved_at: string
          saved_by: string
          sender_email: string | null
          sender_name: string
          sender_phone: string | null
          tags: string[] | null
          thread_id: string | null
          updated_at: string
          user_comment: string | null
        }
        Insert: {
          ai_category?: string | null
          ai_extracted_amounts?: Json | null
          ai_extracted_contacts?: Json | null
          ai_extracted_dates?: Json | null
          ai_summary?: string | null
          id?: string
          is_pinned?: boolean
          lead_id?: string | null
          message_content: string
          message_date: string
          message_id: string
          message_snippet?: string | null
          message_subject?: string | null
          message_type: string
          owner_id?: string | null
          property_id?: string | null
          save_reason: string
          saved_at?: string
          saved_by: string
          sender_email?: string | null
          sender_name: string
          sender_phone?: string | null
          tags?: string[] | null
          thread_id?: string | null
          updated_at?: string
          user_comment?: string | null
        }
        Update: {
          ai_category?: string | null
          ai_extracted_amounts?: Json | null
          ai_extracted_contacts?: Json | null
          ai_extracted_dates?: Json | null
          ai_summary?: string | null
          id?: string
          is_pinned?: boolean
          lead_id?: string | null
          message_content?: string
          message_date?: string
          message_id?: string
          message_snippet?: string | null
          message_subject?: string | null
          message_type?: string
          owner_id?: string | null
          property_id?: string | null
          save_reason?: string
          saved_at?: string
          saved_by?: string
          sender_email?: string | null
          sender_name?: string
          sender_phone?: string | null
          tags?: string[] | null
          thread_id?: string | null
          updated_at?: string
          user_comment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_communications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_communications_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_communications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_communications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_communications_audit: {
        Row: {
          action: string
          action_at: string
          action_by: string
          id: string
          new_values: Json | null
          previous_values: Json | null
          saved_communication_id: string
        }
        Insert: {
          action: string
          action_at?: string
          action_by: string
          id?: string
          new_values?: Json | null
          previous_values?: Json | null
          saved_communication_id: string
        }
        Update: {
          action?: string
          action_at?: string
          action_by?: string
          id?: string
          new_values?: Json | null
          previous_values?: Json | null
          saved_communication_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_communications_audit_saved_communication_id_fkey"
            columns: ["saved_communication_id"]
            isOneToOne: false
            referencedRelation: "saved_communications"
            referencedColumns: ["id"]
          },
        ]
      }
      security_deposit_returns: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          notes: string | null
          original_charge_id: string | null
          owner_id: string
          return_date: string
          return_method: string | null
          returned_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          notes?: string | null
          original_charge_id?: string | null
          owner_id: string
          return_date?: string
          return_method?: string | null
          returned_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          original_charge_id?: string | null
          owner_id?: string
          return_date?: string
          return_method?: string | null
          returned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_deposit_returns_original_charge_id_fkey"
            columns: ["original_charge_id"]
            isOneToOne: false
            referencedRelation: "monthly_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_deposit_returns_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      signing_tokens: {
        Row: {
          created_at: string
          document_id: string
          expires_at: string
          field_values: Json | null
          id: string
          ip_address: string | null
          signature_data: string | null
          signed_at: string | null
          signer_email: string
          signer_name: string
          signer_type: string
          signing_order: number
          token: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          document_id: string
          expires_at: string
          field_values?: Json | null
          id?: string
          ip_address?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signer_email: string
          signer_name: string
          signer_type: string
          signing_order?: number
          token: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string
          expires_at?: string
          field_values?: Json | null
          id?: string
          ip_address?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signer_email?: string
          signer_name?: string
          signer_type?: string
          signing_order?: number
          token?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signing_tokens_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "booking_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_channel_config: {
        Row: {
          allowed_roles: string[] | null
          channel_name: string
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          allowed_roles?: string[] | null
          channel_name: string
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          allowed_roles?: string[] | null
          channel_name?: string
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      slack_messages: {
        Row: {
          channel: string
          created_at: string | null
          error_message: string | null
          id: string
          lead_id: string | null
          message: string
          owner_id: string | null
          property_id: string | null
          sender_name: string | null
          sent_by: string | null
          slack_message_id: string | null
          status: string | null
          template_used: string | null
        }
        Insert: {
          channel: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          message: string
          owner_id?: string | null
          property_id?: string | null
          sender_name?: string | null
          sent_by?: string | null
          slack_message_id?: string | null
          status?: string | null
          template_used?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          message?: string
          owner_id?: string | null
          property_id?: string | null
          sender_name?: string | null
          sent_by?: string | null
          slack_message_id?: string | null
          status?: string | null
          template_used?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slack_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slack_messages_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slack_messages_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slack_messages_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_log: {
        Row: {
          created_at: string | null
          delivery_status: string | null
          delivery_status_updated_at: string | null
          error_code: number | null
          error_message: string | null
          ghl_message_id: string | null
          id: string
          message_body: string | null
          message_type: string | null
          phone_number: string
          request_id: string | null
          status: string | null
          twilio_message_sid: string | null
          twilio_sid: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_status?: string | null
          delivery_status_updated_at?: string | null
          error_code?: number | null
          error_message?: string | null
          ghl_message_id?: string | null
          id?: string
          message_body?: string | null
          message_type?: string | null
          phone_number: string
          request_id?: string | null
          status?: string | null
          twilio_message_sid?: string | null
          twilio_sid?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_status?: string | null
          delivery_status_updated_at?: string | null
          error_code?: number | null
          error_message?: string | null
          ghl_message_id?: string | null
          id?: string
          message_body?: string | null
          message_type?: string | null
          phone_number?: string
          request_id?: string | null
          status?: string | null
          twilio_message_sid?: string | null
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_log_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "google_review_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_reschedule_logs: {
        Row: {
          created_at: string
          days_delayed: number
          id: string
          new_due_date: string
          previous_due_date: string
          project_id: string
          reason: string
          rescheduled_at: string
          rescheduled_by: string | null
          rescheduled_by_name: string
          task_id: string
        }
        Insert: {
          created_at?: string
          days_delayed: number
          id?: string
          new_due_date: string
          previous_due_date: string
          project_id: string
          reason: string
          rescheduled_at?: string
          rescheduled_by?: string | null
          rescheduled_by_name: string
          task_id: string
        }
        Update: {
          created_at?: string
          days_delayed?: number
          id?: string
          new_due_date?: string
          previous_due_date?: string
          project_id?: string
          reason?: string
          rescheduled_at?: string
          rescheduled_by?: string | null
          rescheduled_by_name?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_reschedule_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_reschedule_logs_rescheduled_by_fkey"
            columns: ["rescheduled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_reschedule_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          created_at: string
          default_role_id: string | null
          field_type: string
          id: string
          phase_number: number
          task_title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_role_id?: string | null
          field_type: string
          id?: string
          phase_number: number
          task_title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_role_id?: string | null
          field_type?: string
          id?: string
          phase_number?: number
          task_title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_default_role_id_fkey"
            columns: ["default_role_id"]
            isOneToOne: false
            referencedRelation: "team_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_channel_members: {
        Row: {
          channel_id: string
          id: string
          joined_at: string | null
          last_read_at: string | null
          notifications_muted: boolean | null
          role: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          notifications_muted?: boolean | null
          role?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          notifications_muted?: boolean | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "team_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      team_channels: {
        Row: {
          allowed_roles: string[] | null
          channel_type: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          display_name: string
          id: string
          is_archived: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          allowed_roles?: string[] | null
          channel_type?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_archived?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          allowed_roles?: string[] | null
          channel_type?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_archived?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      team_hub_invites: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          invite_token: string | null
          invitee_email: string
          inviter_id: string | null
          status: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          invite_token?: string | null
          invitee_email: string
          inviter_id?: string | null
          status?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          invite_token?: string | null
          invitee_email?: string
          inviter_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      team_messages: {
        Row: {
          attachments: Json | null
          channel_id: string
          content: string
          created_at: string | null
          edited_at: string | null
          file_name: string | null
          file_url: string | null
          id: string
          is_edited: boolean | null
          is_pinned: boolean | null
          lead_id: string | null
          mentions: string[] | null
          message_type: string | null
          owner_id: string | null
          parent_message_id: string | null
          property_id: string | null
          reactions: Json | null
          sender_id: string
          work_order_id: string | null
        }
        Insert: {
          attachments?: Json | null
          channel_id: string
          content: string
          created_at?: string | null
          edited_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_edited?: boolean | null
          is_pinned?: boolean | null
          lead_id?: string | null
          mentions?: string[] | null
          message_type?: string | null
          owner_id?: string | null
          parent_message_id?: string | null
          property_id?: string | null
          reactions?: Json | null
          sender_id: string
          work_order_id?: string | null
        }
        Update: {
          attachments?: Json | null
          channel_id?: string
          content?: string
          created_at?: string | null
          edited_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_edited?: boolean | null
          is_pinned?: boolean | null
          lead_id?: string | null
          mentions?: string[] | null
          message_type?: string | null
          owner_id?: string | null
          parent_message_id?: string | null
          property_id?: string | null
          reactions?: Json | null
          sender_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "team_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "team_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      team_notification_preferences: {
        Row: {
          created_at: string | null
          id: string
          muted_channels: string[] | null
          notification_sound: boolean | null
          push_all_messages: boolean | null
          push_dms_only: boolean | null
          push_enabled: boolean | null
          push_mentions_only: boolean | null
          quiet_hours_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          show_desktop_notifications: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          muted_channels?: string[] | null
          notification_sound?: boolean | null
          push_all_messages?: boolean | null
          push_dms_only?: boolean | null
          push_enabled?: boolean | null
          push_mentions_only?: boolean | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          show_desktop_notifications?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          muted_channels?: string[] | null
          notification_sound?: boolean | null
          push_all_messages?: boolean | null
          push_dms_only?: boolean | null
          push_enabled?: boolean | null
          push_mentions_only?: boolean | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          show_desktop_notifications?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      team_notifications: {
        Row: {
          channel_id: string | null
          communication_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string | null
          message_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          channel_id?: string | null
          communication_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          message_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          channel_id?: string | null
          communication_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          message_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_notifications_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "lead_communications"
            referencedColumns: ["id"]
          },
        ]
      }
      team_presence: {
        Row: {
          current_channel_id: string | null
          focus_mode_until: string | null
          id: string
          last_seen_at: string | null
          status: string | null
          status_emoji: string | null
          status_text: string | null
          user_id: string
        }
        Insert: {
          current_channel_id?: string | null
          focus_mode_until?: string | null
          id?: string
          last_seen_at?: string | null
          status?: string | null
          status_emoji?: string | null
          status_text?: string | null
          user_id: string
        }
        Update: {
          current_channel_id?: string | null
          focus_mode_until?: string | null
          id?: string
          last_seen_at?: string | null
          status?: string | null
          status_emoji?: string | null
          status_text?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_presence_current_channel_id_fkey"
            columns: ["current_channel_id"]
            isOneToOne: false
            referencedRelation: "team_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      team_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          role_name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          role_name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          role_name?: string
        }
        Relationships: []
      }
      team_routing: {
        Row: {
          created_at: string | null
          display_name: string
          dtmf_digit: string | null
          forward_to_browser: boolean | null
          forward_to_number: string | null
          ghl_number: string
          id: string
          is_active: boolean | null
          updated_at: string | null
          user_id: string | null
          voicemail_enabled: boolean | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          dtmf_digit?: string | null
          forward_to_browser?: boolean | null
          forward_to_number?: string | null
          ghl_number: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          voicemail_enabled?: boolean | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          dtmf_digit?: string | null
          forward_to_browser?: boolean | null
          forward_to_number?: string | null
          ghl_number?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          voicemail_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "team_routing_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_applications: {
        Row: {
          applicant_email: string | null
          applicant_name: string
          applicant_phone: string | null
          application_date: string
          background_check_passed: boolean | null
          created_at: string | null
          credit_check_passed: boolean | null
          decision_date: string | null
          decision_made_by: string | null
          decision_reason: string | null
          denial_letter_sent: boolean | null
          denial_letter_sent_at: string | null
          id: string
          income_requirement_met: boolean | null
          income_verified: boolean | null
          notes: string | null
          property_id: string | null
          references_checked: boolean | null
          rental_history_verified: boolean | null
          screening_criteria_used: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          applicant_email?: string | null
          applicant_name: string
          applicant_phone?: string | null
          application_date: string
          background_check_passed?: boolean | null
          created_at?: string | null
          credit_check_passed?: boolean | null
          decision_date?: string | null
          decision_made_by?: string | null
          decision_reason?: string | null
          denial_letter_sent?: boolean | null
          denial_letter_sent_at?: string | null
          id?: string
          income_requirement_met?: boolean | null
          income_verified?: boolean | null
          notes?: string | null
          property_id?: string | null
          references_checked?: boolean | null
          rental_history_verified?: boolean | null
          screening_criteria_used?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          applicant_email?: string | null
          applicant_name?: string
          applicant_phone?: string | null
          application_date?: string
          background_check_passed?: boolean | null
          created_at?: string | null
          credit_check_passed?: boolean | null
          decision_date?: string | null
          decision_made_by?: string | null
          decision_reason?: string | null
          denial_letter_sent?: boolean | null
          denial_letter_sent_at?: string | null
          id?: string
          income_requirement_met?: boolean | null
          income_verified?: boolean | null
          notes?: string | null
          property_id?: string | null
          references_checked?: boolean | null
          rental_history_verified?: boolean | null
          screening_criteria_used?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_applications_decision_made_by_fkey"
            columns: ["decision_made_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_applications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_applications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_payments: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          email_insight_id: string | null
          entered_by: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          property_id: string
          reference_number: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string
          email_insight_id?: string | null
          entered_by?: string | null
          id?: string
          notes?: string | null
          payment_date: string
          payment_method?: string | null
          property_id: string
          reference_number?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          email_insight_id?: string | null
          entered_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          property_id?: string
          reference_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "mid_term_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_payments_email_insight_id_fkey"
            columns: ["email_insight_id"]
            isOneToOne: false
            referencedRelation: "email_insights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_payments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_payments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      trust_account_reconciliations: {
        Row: {
          bank_statement_date: string
          created_at: string | null
          difference: number | null
          document_path: string | null
          id: string
          is_reconciled: boolean | null
          ledger_balance: number
          notes: string | null
          reconciled_by: string | null
          reconciliation_date: string
          statement_balance: number
          updated_at: string | null
        }
        Insert: {
          bank_statement_date: string
          created_at?: string | null
          difference?: number | null
          document_path?: string | null
          id?: string
          is_reconciled?: boolean | null
          ledger_balance: number
          notes?: string | null
          reconciled_by?: string | null
          reconciliation_date: string
          statement_balance: number
          updated_at?: string | null
        }
        Update: {
          bank_statement_date?: string
          created_at?: string | null
          difference?: number | null
          document_path?: string | null
          id?: string
          is_reconciled?: boolean | null
          ledger_balance?: number
          notes?: string | null
          reconciled_by?: string | null
          reconciliation_date?: string
          statement_balance?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trust_account_reconciliations_reconciled_by_fkey"
            columns: ["reconciled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_calendar_settings: {
        Row: {
          calendar_email: string | null
          created_at: string | null
          default_calendar_id: string | null
          google_calendar_connected: boolean | null
          id: string
          pipedream_external_id: string | null
          receives_discovery_calls: boolean | null
          receives_inspections: boolean | null
          receives_team_meetings: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          calendar_email?: string | null
          created_at?: string | null
          default_calendar_id?: string | null
          google_calendar_connected?: boolean | null
          id?: string
          pipedream_external_id?: string | null
          receives_discovery_calls?: boolean | null
          receives_inspections?: boolean | null
          receives_team_meetings?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          calendar_email?: string | null
          created_at?: string | null
          default_calendar_id?: string | null
          google_calendar_connected?: boolean | null
          id?: string
          pipedream_external_id?: string | null
          receives_discovery_calls?: boolean | null
          receives_inspections?: boolean | null
          receives_team_meetings?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_gmail_labels: {
        Row: {
          created_at: string | null
          email_address: string | null
          gmail_label_id: string | null
          id: string
          is_active: boolean | null
          label_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_address?: string | null
          gmail_label_id?: string | null
          id?: string
          is_active?: boolean | null
          label_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_address?: string | null
          gmail_label_id?: string | null
          id?: string
          is_active?: boolean | null
          label_name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_phone_assignments: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          phone_number: string
          phone_type: string
          purpose: string | null
          telnyx_connection_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          phone_number: string
          phone_type?: string
          purpose?: string | null
          telnyx_connection_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          phone_number?: string
          phone_type?: string
          purpose?: string | null
          telnyx_connection_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_phone_calls: {
        Row: {
          created_at: string
          direction: string
          duration_seconds: number | null
          ended_at: string | null
          external_id: string | null
          from_number: string
          id: string
          phone_assignment_id: string | null
          property_id: string | null
          recording_url: string | null
          started_at: string
          status: string | null
          to_number: string
          transcription: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          direction: string
          duration_seconds?: number | null
          ended_at?: string | null
          external_id?: string | null
          from_number: string
          id?: string
          phone_assignment_id?: string | null
          property_id?: string | null
          recording_url?: string | null
          started_at?: string
          status?: string | null
          to_number: string
          transcription?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          external_id?: string | null
          from_number?: string
          id?: string
          phone_assignment_id?: string | null
          property_id?: string | null
          recording_url?: string | null
          started_at?: string
          status?: string | null
          to_number?: string
          transcription?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_phone_calls_phone_assignment_id_fkey"
            columns: ["phone_assignment_id"]
            isOneToOne: false
            referencedRelation: "user_phone_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_phone_calls_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_phone_calls_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_phone_messages: {
        Row: {
          body: string | null
          created_at: string
          direction: string
          external_id: string | null
          from_number: string
          id: string
          is_resolved: boolean | null
          media_urls: Json | null
          notes: string | null
          phone_assignment_id: string | null
          property_id: string | null
          read_at: string | null
          status: string | null
          to_number: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          direction: string
          external_id?: string | null
          from_number: string
          id?: string
          is_resolved?: boolean | null
          media_urls?: Json | null
          notes?: string | null
          phone_assignment_id?: string | null
          property_id?: string | null
          read_at?: string | null
          status?: string | null
          to_number: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          direction?: string
          external_id?: string | null
          from_number?: string
          id?: string
          is_resolved?: boolean | null
          media_urls?: Json | null
          notes?: string | null
          phone_assignment_id?: string | null
          property_id?: string | null
          read_at?: string | null
          status?: string | null
          to_number?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_phone_messages_phone_assignment_id_fkey"
            columns: ["phone_assignment_id"]
            isOneToOne: false
            referencedRelation: "user_phone_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_phone_messages_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_phone_messages_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
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
      user_team_roles: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean | null
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_team_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "team_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_team_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tone_profiles: {
        Row: {
          analyzed_email_count: number | null
          analyzed_sms_count: number | null
          avg_sentence_length: number | null
          avoided_phrases: Json | null
          channel: string
          common_closings: Json | null
          common_greetings: Json | null
          created_at: string
          emoji_usage: string | null
          exclamation_frequency: string | null
          formality_level: string | null
          id: string
          last_analyzed_at: string | null
          paragraph_style: string | null
          punctuation_style: string | null
          question_frequency: string | null
          sample_messages: Json | null
          signature_phrases: Json | null
          tone_summary: string | null
          typical_email_length: number | null
          typical_sms_length: number | null
          updated_at: string
          user_id: string | null
          uses_contractions: boolean | null
          writing_dna: Json | null
        }
        Insert: {
          analyzed_email_count?: number | null
          analyzed_sms_count?: number | null
          avg_sentence_length?: number | null
          avoided_phrases?: Json | null
          channel?: string
          common_closings?: Json | null
          common_greetings?: Json | null
          created_at?: string
          emoji_usage?: string | null
          exclamation_frequency?: string | null
          formality_level?: string | null
          id?: string
          last_analyzed_at?: string | null
          paragraph_style?: string | null
          punctuation_style?: string | null
          question_frequency?: string | null
          sample_messages?: Json | null
          signature_phrases?: Json | null
          tone_summary?: string | null
          typical_email_length?: number | null
          typical_sms_length?: number | null
          updated_at?: string
          user_id?: string | null
          uses_contractions?: boolean | null
          writing_dna?: Json | null
        }
        Update: {
          analyzed_email_count?: number | null
          analyzed_sms_count?: number | null
          avg_sentence_length?: number | null
          avoided_phrases?: Json | null
          channel?: string
          common_closings?: Json | null
          common_greetings?: Json | null
          created_at?: string
          emoji_usage?: string | null
          exclamation_frequency?: string | null
          formality_level?: string | null
          id?: string
          last_analyzed_at?: string | null
          paragraph_style?: string | null
          punctuation_style?: string | null
          question_frequency?: string | null
          sample_messages?: Json | null
          signature_phrases?: Json | null
          tone_summary?: string | null
          typical_email_length?: number | null
          typical_sms_length?: number | null
          updated_at?: string
          user_id?: string | null
          uses_contractions?: boolean | null
          writing_dna?: Json | null
        }
        Relationships: []
      }
      utility_accounts: {
        Row: {
          account_number: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          property_id: string | null
          provider: string | null
          updated_at: string | null
          utility_type: string
        }
        Insert: {
          account_number?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          property_id?: string | null
          provider?: string | null
          updated_at?: string | null
          utility_type: string
        }
        Update: {
          account_number?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          property_id?: string | null
          provider?: string | null
          updated_at?: string | null
          utility_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "utility_accounts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_accounts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      utility_anomaly_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          email_sent: boolean | null
          email_sent_at: string | null
          id: string
          is_resolved: boolean | null
          message: string
          percentage_change: number | null
          property_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string | null
          utility_reading_id: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          is_resolved?: boolean | null
          message: string
          percentage_change?: number | null
          property_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          utility_reading_id?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          is_resolved?: boolean | null
          message?: string
          percentage_change?: number | null
          property_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          utility_reading_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "utility_anomaly_alerts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_anomaly_alerts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_anomaly_alerts_utility_reading_id_fkey"
            columns: ["utility_reading_id"]
            isOneToOne: false
            referencedRelation: "utility_readings"
            referencedColumns: ["id"]
          },
        ]
      }
      utility_provider_recommendations: {
        Row: {
          actioned_at: string | null
          actioned_by: string | null
          created_at: string | null
          current_avg_cost: number | null
          current_provider: string | null
          estimated_savings: number
          id: string
          property_id: string | null
          reason: string | null
          recommended_provider: string
          savings_percentage: number | null
          status: string | null
          updated_at: string | null
          utility_type: string
        }
        Insert: {
          actioned_at?: string | null
          actioned_by?: string | null
          created_at?: string | null
          current_avg_cost?: number | null
          current_provider?: string | null
          estimated_savings: number
          id?: string
          property_id?: string | null
          reason?: string | null
          recommended_provider: string
          savings_percentage?: number | null
          status?: string | null
          updated_at?: string | null
          utility_type: string
        }
        Update: {
          actioned_at?: string | null
          actioned_by?: string | null
          created_at?: string | null
          current_avg_cost?: number | null
          current_provider?: string | null
          estimated_savings?: number
          id?: string
          property_id?: string | null
          reason?: string | null
          recommended_provider?: string
          savings_percentage?: number | null
          status?: string | null
          updated_at?: string | null
          utility_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "utility_provider_recommendations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_provider_recommendations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      utility_readings: {
        Row: {
          account_number: string | null
          amount_due: number
          anomaly_percentage: number | null
          anomaly_reason: string | null
          bill_date: string
          created_at: string | null
          due_date: string | null
          email_insight_id: string | null
          gmail_message_id: string | null
          id: string
          is_anomaly: boolean | null
          match_method: string | null
          previous_amount: number | null
          previous_usage: number | null
          property_id: string | null
          provider: string | null
          raw_email_data: Json | null
          service_address: string | null
          service_period_end: string | null
          service_period_start: string | null
          updated_at: string | null
          usage_amount: number | null
          usage_unit: string | null
          utility_type: string
        }
        Insert: {
          account_number?: string | null
          amount_due: number
          anomaly_percentage?: number | null
          anomaly_reason?: string | null
          bill_date: string
          created_at?: string | null
          due_date?: string | null
          email_insight_id?: string | null
          gmail_message_id?: string | null
          id?: string
          is_anomaly?: boolean | null
          match_method?: string | null
          previous_amount?: number | null
          previous_usage?: number | null
          property_id?: string | null
          provider?: string | null
          raw_email_data?: Json | null
          service_address?: string | null
          service_period_end?: string | null
          service_period_start?: string | null
          updated_at?: string | null
          usage_amount?: number | null
          usage_unit?: string | null
          utility_type: string
        }
        Update: {
          account_number?: string | null
          amount_due?: number
          anomaly_percentage?: number | null
          anomaly_reason?: string | null
          bill_date?: string
          created_at?: string | null
          due_date?: string | null
          email_insight_id?: string | null
          gmail_message_id?: string | null
          id?: string
          is_anomaly?: boolean | null
          match_method?: string | null
          previous_amount?: number | null
          previous_usage?: number | null
          property_id?: string | null
          provider?: string | null
          raw_email_data?: Json | null
          service_address?: string | null
          service_period_end?: string | null
          service_period_start?: string | null
          updated_at?: string | null
          usage_amount?: number | null
          usage_unit?: string | null
          utility_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "utility_readings_email_insight_id_fkey"
            columns: ["email_insight_id"]
            isOneToOne: false
            referencedRelation: "email_insights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_readings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_readings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_service_requests: {
        Row: {
          assignment_id: string | null
          confirmed_at: string | null
          created_at: string | null
          created_by: string | null
          email_sent_at: string | null
          id: string
          pause_end_date: string | null
          pause_start_date: string | null
          property_id: string | null
          reason: string | null
          reference_number: string | null
          request_type: string
          status: string | null
          updated_at: string | null
          vendor_id: string | null
          vendor_response: string | null
        }
        Insert: {
          assignment_id?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          email_sent_at?: string | null
          id?: string
          pause_end_date?: string | null
          pause_start_date?: string | null
          property_id?: string | null
          reason?: string | null
          reference_number?: string | null
          request_type: string
          status?: string | null
          updated_at?: string | null
          vendor_id?: string | null
          vendor_response?: string | null
        }
        Update: {
          assignment_id?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          email_sent_at?: string | null
          id?: string
          pause_end_date?: string | null
          pause_start_date?: string | null
          property_id?: string | null
          reason?: string | null
          reference_number?: string | null
          request_type?: string
          status?: string | null
          updated_at?: string | null
          vendor_id?: string | null
          vendor_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_service_requests_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "property_vendor_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_service_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_service_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_service_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          average_rating: number | null
          average_response_time_hours: number | null
          billcom_invite_sent_at: string | null
          billcom_synced_at: string | null
          billcom_vendor_id: string | null
          company_name: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          emergency_available: boolean | null
          emergency_rate: number | null
          hourly_rate: number | null
          id: string
          insurance_expiration: string | null
          insurance_verified: boolean | null
          license_number: string | null
          name: string
          notes: string | null
          phone: string | null
          preferred_payment_method: string | null
          service_area: string[] | null
          specialty: string[]
          status: Database["public"]["Enums"]["vendor_status"] | null
          total_jobs_completed: number | null
          updated_at: string | null
          w9_on_file: boolean | null
        }
        Insert: {
          average_rating?: number | null
          average_response_time_hours?: number | null
          billcom_invite_sent_at?: string | null
          billcom_synced_at?: string | null
          billcom_vendor_id?: string | null
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          emergency_available?: boolean | null
          emergency_rate?: number | null
          hourly_rate?: number | null
          id?: string
          insurance_expiration?: string | null
          insurance_verified?: boolean | null
          license_number?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          preferred_payment_method?: string | null
          service_area?: string[] | null
          specialty?: string[]
          status?: Database["public"]["Enums"]["vendor_status"] | null
          total_jobs_completed?: number | null
          updated_at?: string | null
          w9_on_file?: boolean | null
        }
        Update: {
          average_rating?: number | null
          average_response_time_hours?: number | null
          billcom_invite_sent_at?: string | null
          billcom_synced_at?: string | null
          billcom_vendor_id?: string | null
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          emergency_available?: boolean | null
          emergency_rate?: number | null
          hourly_rate?: number | null
          id?: string
          insurance_expiration?: string | null
          insurance_verified?: boolean | null
          license_number?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          preferred_payment_method?: string | null
          service_area?: string[] | null
          specialty?: string[]
          status?: Database["public"]["Enums"]["vendor_status"] | null
          total_jobs_completed?: number | null
          updated_at?: string | null
          w9_on_file?: boolean | null
        }
        Relationships: []
      }
      visits: {
        Row: {
          billed: boolean | null
          created_at: string
          date: string
          hours: number | null
          id: string
          notes: string | null
          price: number
          property_id: string
          receipt_path: string | null
          reconciliation_id: string | null
          time: string
          user_id: string | null
          visited_by: string | null
        }
        Insert: {
          billed?: boolean | null
          created_at?: string
          date: string
          hours?: number | null
          id?: string
          notes?: string | null
          price: number
          property_id: string
          receipt_path?: string | null
          reconciliation_id?: string | null
          time: string
          user_id?: string | null
          visited_by?: string | null
        }
        Update: {
          billed?: boolean | null
          created_at?: string
          date?: string
          hours?: number | null
          id?: string
          notes?: string | null
          price?: number
          property_id?: string
          receipt_path?: string | null
          reconciliation_id?: string | null
          time?: string
          user_id?: string | null
          visited_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "monthly_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      voicemail_messages: {
        Row: {
          audio_source: string
          audio_url: string | null
          callback_clicked: boolean | null
          created_at: string | null
          duration_seconds: number | null
          id: string
          lead_id: string | null
          media_type: string | null
          message_text: string
          opened_at: string | null
          owner_id: string | null
          play_count: number | null
          played_at: string | null
          recipient_name: string | null
          recipient_phone: string
          reply_audio_url: string | null
          reply_clicked: boolean | null
          reply_duration_seconds: number | null
          reply_recorded_at: string | null
          reply_transcript: string | null
          sender_name: string | null
          sender_user_id: string | null
          sms_message_sid: string | null
          sms_sent_at: string | null
          status: string | null
          thumbnail_url: string | null
          token: string
          total_listen_time: number | null
          updated_at: string | null
          video_url: string | null
          voice_id: string | null
        }
        Insert: {
          audio_source?: string
          audio_url?: string | null
          callback_clicked?: boolean | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          lead_id?: string | null
          media_type?: string | null
          message_text: string
          opened_at?: string | null
          owner_id?: string | null
          play_count?: number | null
          played_at?: string | null
          recipient_name?: string | null
          recipient_phone: string
          reply_audio_url?: string | null
          reply_clicked?: boolean | null
          reply_duration_seconds?: number | null
          reply_recorded_at?: string | null
          reply_transcript?: string | null
          sender_name?: string | null
          sender_user_id?: string | null
          sms_message_sid?: string | null
          sms_sent_at?: string | null
          status?: string | null
          thumbnail_url?: string | null
          token?: string
          total_listen_time?: number | null
          updated_at?: string | null
          video_url?: string | null
          voice_id?: string | null
        }
        Update: {
          audio_source?: string
          audio_url?: string | null
          callback_clicked?: boolean | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          lead_id?: string | null
          media_type?: string | null
          message_text?: string
          opened_at?: string | null
          owner_id?: string | null
          play_count?: number | null
          played_at?: string | null
          recipient_name?: string | null
          recipient_phone?: string
          reply_audio_url?: string | null
          reply_clicked?: boolean | null
          reply_duration_seconds?: number | null
          reply_recorded_at?: string | null
          reply_transcript?: string | null
          sender_name?: string | null
          sender_user_id?: string | null
          sms_message_sid?: string | null
          sms_sent_at?: string | null
          status?: string | null
          thumbnail_url?: string | null
          token?: string
          total_listen_time?: number | null
          updated_at?: string | null
          video_url?: string | null
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voicemail_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voicemail_messages_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      watchdog_logs: {
        Row: {
          check_type: string
          created_at: string | null
          details: Json | null
          emails_scanned: number | null
          id: string
          issues_found: string[] | null
          owner_emails_detected: number | null
          run_at: string | null
          status: string
          tasks_confirmed: number | null
          tasks_extracted: number | null
        }
        Insert: {
          check_type: string
          created_at?: string | null
          details?: Json | null
          emails_scanned?: number | null
          id?: string
          issues_found?: string[] | null
          owner_emails_detected?: number | null
          run_at?: string | null
          status: string
          tasks_confirmed?: number | null
          tasks_extracted?: number | null
        }
        Update: {
          check_type?: string
          created_at?: string | null
          details?: Json | null
          emails_scanned?: number | null
          id?: string
          issues_found?: string[] | null
          owner_emails_detected?: number | null
          run_at?: string | null
          status?: string
          tasks_confirmed?: number | null
          tasks_extracted?: number | null
        }
        Relationships: []
      }
      work_order_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          photo_type: string | null
          photo_url: string
          uploaded_by: string
          uploaded_by_type: string | null
          work_order_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          photo_type?: string | null
          photo_url: string
          uploaded_by: string
          uploaded_by_type?: string | null
          work_order_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          photo_type?: string | null
          photo_url?: string
          uploaded_by?: string
          uploaded_by_type?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_photos_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_timeline: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          is_internal: boolean | null
          new_status: Database["public"]["Enums"]["work_order_status"] | null
          performed_by_name: string | null
          performed_by_type:
            | Database["public"]["Enums"]["message_sender_type"]
            | null
          performed_by_user_id: string | null
          previous_status:
            | Database["public"]["Enums"]["work_order_status"]
            | null
          work_order_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          is_internal?: boolean | null
          new_status?: Database["public"]["Enums"]["work_order_status"] | null
          performed_by_name?: string | null
          performed_by_type?:
            | Database["public"]["Enums"]["message_sender_type"]
            | null
          performed_by_user_id?: string | null
          previous_status?:
            | Database["public"]["Enums"]["work_order_status"]
            | null
          work_order_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          is_internal?: boolean | null
          new_status?: Database["public"]["Enums"]["work_order_status"] | null
          performed_by_name?: string | null
          performed_by_type?:
            | Database["public"]["Enums"]["message_sender_type"]
            | null
          performed_by_user_id?: string | null
          previous_status?:
            | Database["public"]["Enums"]["work_order_status"]
            | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_timeline_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          access_instructions: string | null
          actual_cost: number | null
          after_photos: string[] | null
          ai_confidence_score: number | null
          ai_estimated_cost_high: number | null
          ai_estimated_cost_low: number | null
          ai_suggested_category: string | null
          ai_suggested_vendor_id: string | null
          ai_triage_summary: string | null
          ai_troubleshooting_steps: Json | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_vendor_id: string | null
          before_photos: string[] | null
          billcom_bill_id: string | null
          billcom_invoice_url: string | null
          billcom_payment_status: string | null
          cancelled_at: string | null
          cancelled_reason: string | null
          category: string
          completed_at: string | null
          completion_verified: boolean | null
          created_at: string | null
          created_by: string | null
          description: string
          estimated_cost: number | null
          expense_id: string | null
          guest_notified: boolean | null
          guest_notified_at: string | null
          id: string
          inspection_issue_id: string | null
          invoice_path: string | null
          owner_approval_reminder_count: number | null
          owner_approval_requested_at: string | null
          owner_approval_token: string | null
          owner_approved: boolean | null
          owner_approved_at: string | null
          owner_approved_by: string | null
          owner_notified: boolean | null
          owner_notified_at: string | null
          parent_work_order_id: string | null
          parking_instructions: string | null
          pets_on_property: string | null
          property_id: string
          quote_labor_hours: number | null
          quote_materials: string | null
          quote_scope: string | null
          quoted_cost: number | null
          reported_by: string | null
          reported_by_email: string | null
          reported_by_phone: string | null
          reported_by_user_id: string | null
          requires_vendor: boolean | null
          safety_notes: string | null
          scheduled_date: string | null
          scheduled_time_end: string | null
          scheduled_time_start: string | null
          scheduled_time_window: string | null
          source: string | null
          status: Database["public"]["Enums"]["work_order_status"] | null
          tenant_contact_name: string | null
          tenant_contact_phone: string | null
          title: string
          troubleshooting_resolved: boolean | null
          updated_at: string | null
          urgency: Database["public"]["Enums"]["work_order_urgency"] | null
          utility_shutoff_notes: string | null
          vendor_accepted: boolean | null
          vendor_accepted_at: string | null
          vendor_access_code: string | null
          vendor_access_token: string | null
          vendor_access_token_expires_at: string | null
          vendor_declined_reason: string | null
          vendor_notes: string | null
          verification_notes: string | null
          verified_at: string | null
          verified_by: string | null
          video_url: string | null
          voice_message_transcript: string | null
          voice_message_url: string | null
          warranty_id: string | null
          work_order_number: number
        }
        Insert: {
          access_instructions?: string | null
          actual_cost?: number | null
          after_photos?: string[] | null
          ai_confidence_score?: number | null
          ai_estimated_cost_high?: number | null
          ai_estimated_cost_low?: number | null
          ai_suggested_category?: string | null
          ai_suggested_vendor_id?: string | null
          ai_triage_summary?: string | null
          ai_troubleshooting_steps?: Json | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_vendor_id?: string | null
          before_photos?: string[] | null
          billcom_bill_id?: string | null
          billcom_invoice_url?: string | null
          billcom_payment_status?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          category: string
          completed_at?: string | null
          completion_verified?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description: string
          estimated_cost?: number | null
          expense_id?: string | null
          guest_notified?: boolean | null
          guest_notified_at?: string | null
          id?: string
          inspection_issue_id?: string | null
          invoice_path?: string | null
          owner_approval_reminder_count?: number | null
          owner_approval_requested_at?: string | null
          owner_approval_token?: string | null
          owner_approved?: boolean | null
          owner_approved_at?: string | null
          owner_approved_by?: string | null
          owner_notified?: boolean | null
          owner_notified_at?: string | null
          parent_work_order_id?: string | null
          parking_instructions?: string | null
          pets_on_property?: string | null
          property_id: string
          quote_labor_hours?: number | null
          quote_materials?: string | null
          quote_scope?: string | null
          quoted_cost?: number | null
          reported_by?: string | null
          reported_by_email?: string | null
          reported_by_phone?: string | null
          reported_by_user_id?: string | null
          requires_vendor?: boolean | null
          safety_notes?: string | null
          scheduled_date?: string | null
          scheduled_time_end?: string | null
          scheduled_time_start?: string | null
          scheduled_time_window?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["work_order_status"] | null
          tenant_contact_name?: string | null
          tenant_contact_phone?: string | null
          title: string
          troubleshooting_resolved?: boolean | null
          updated_at?: string | null
          urgency?: Database["public"]["Enums"]["work_order_urgency"] | null
          utility_shutoff_notes?: string | null
          vendor_accepted?: boolean | null
          vendor_accepted_at?: string | null
          vendor_access_code?: string | null
          vendor_access_token?: string | null
          vendor_access_token_expires_at?: string | null
          vendor_declined_reason?: string | null
          vendor_notes?: string | null
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
          video_url?: string | null
          voice_message_transcript?: string | null
          voice_message_url?: string | null
          warranty_id?: string | null
          work_order_number?: number
        }
        Update: {
          access_instructions?: string | null
          actual_cost?: number | null
          after_photos?: string[] | null
          ai_confidence_score?: number | null
          ai_estimated_cost_high?: number | null
          ai_estimated_cost_low?: number | null
          ai_suggested_category?: string | null
          ai_suggested_vendor_id?: string | null
          ai_triage_summary?: string | null
          ai_troubleshooting_steps?: Json | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_vendor_id?: string | null
          before_photos?: string[] | null
          billcom_bill_id?: string | null
          billcom_invoice_url?: string | null
          billcom_payment_status?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          category?: string
          completed_at?: string | null
          completion_verified?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          estimated_cost?: number | null
          expense_id?: string | null
          guest_notified?: boolean | null
          guest_notified_at?: string | null
          id?: string
          inspection_issue_id?: string | null
          invoice_path?: string | null
          owner_approval_reminder_count?: number | null
          owner_approval_requested_at?: string | null
          owner_approval_token?: string | null
          owner_approved?: boolean | null
          owner_approved_at?: string | null
          owner_approved_by?: string | null
          owner_notified?: boolean | null
          owner_notified_at?: string | null
          parent_work_order_id?: string | null
          parking_instructions?: string | null
          pets_on_property?: string | null
          property_id?: string
          quote_labor_hours?: number | null
          quote_materials?: string | null
          quote_scope?: string | null
          quoted_cost?: number | null
          reported_by?: string | null
          reported_by_email?: string | null
          reported_by_phone?: string | null
          reported_by_user_id?: string | null
          requires_vendor?: boolean | null
          safety_notes?: string | null
          scheduled_date?: string | null
          scheduled_time_end?: string | null
          scheduled_time_start?: string | null
          scheduled_time_window?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["work_order_status"] | null
          tenant_contact_name?: string | null
          tenant_contact_phone?: string | null
          title?: string
          troubleshooting_resolved?: boolean | null
          updated_at?: string | null
          urgency?: Database["public"]["Enums"]["work_order_urgency"] | null
          utility_shutoff_notes?: string | null
          vendor_accepted?: boolean | null
          vendor_accepted_at?: string | null
          vendor_access_code?: string | null
          vendor_access_token?: string | null
          vendor_access_token_expires_at?: string | null
          vendor_declined_reason?: string | null
          vendor_notes?: string | null
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
          video_url?: string | null
          voice_message_transcript?: string | null
          voice_message_url?: string | null
          warranty_id?: string | null
          work_order_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_ai_suggested_vendor_id_fkey"
            columns: ["ai_suggested_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_assigned_vendor_id_fkey"
            columns: ["assigned_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_inspection_issue_id_fkey"
            columns: ["inspection_issue_id"]
            isOneToOne: false
            referencedRelation: "inspection_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_parent_work_order_id_fkey"
            columns: ["parent_work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "comprehensive_property_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "appliance_warranties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      comprehensive_property_data: {
        Row: {
          ada_compliant: boolean | null
          address: string | null
          admin_fee: number | null
          basement: boolean | null
          bathrooms: number | null
          bedrooms: number | null
          brand_name: string | null
          cleaning_fee: number | null
          contact_email: string | null
          contact_phone: string | null
          elementary_school: string | null
          fenced_yard: string | null
          high_school: string | null
          id: string | null
          image_path: string | null
          lease_term: string | null
          max_pet_weight: number | null
          max_pets: number | null
          middle_school: string | null
          monthly_cleaning_fee: number | null
          monthly_pet_rent: number | null
          monthly_rent: number | null
          name: string | null
          nightly_rate: number | null
          notice_to_vacate: string | null
          parking_spaces: string | null
          parking_type: string | null
          pet_fee: number | null
          pet_rules: string | null
          pets_allowed: boolean | null
          pricing_effective_date: string | null
          property_created_at: string | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          property_type_detail: string | null
          rental_type: string | null
          school_district: string | null
          security_deposit: number | null
          sqft: number | null
          stories: string | null
          utility_cap: number | null
          visit_price: number | null
          website_url: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_listing_export_data: {
        Args: { p_property_id: string }
        Returns: Json
      }
      get_property_platforms: {
        Args: { p_property_id: string }
        Returns: {
          is_active: boolean
          listing_url: string
          platform_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_duplicate_expense: {
        Args: {
          p_amount: number
          p_date: string
          p_order_number: string
          p_property_id: string
          p_purpose: string
        }
        Returns: boolean
      }
      refresh_all_holiday_email_queues: { Args: never; Returns: undefined }
    }
    Enums: {
      account_status: "pending" | "approved" | "rejected"
      app_role: "admin" | "user"
      approval_status:
        | "pending"
        | "approved"
        | "declined"
        | "auto_approved"
        | "expired"
      lead_source:
        | "calendar_booking"
        | "referral"
        | "website"
        | "phone_call"
        | "email"
        | "other"
      lead_stage:
        | "new_lead"
        | "unreached"
        | "call_scheduled"
        | "call_attended"
        | "send_contract"
        | "contract_out"
        | "contract_signed"
        | "welcome_email_w9"
        | "ach_form_signed"
        | "onboarding_form_requested"
        | "insurance_requested"
        | "inspection_scheduled"
        | "ops_handoff"
      message_sender_type: "owner" | "pm" | "vendor" | "guest" | "ai" | "system"
      property_type: "Client-Managed" | "Company-Owned" | "Inactive"
      vendor_status: "active" | "inactive" | "preferred" | "blocked"
      work_order_status:
        | "new"
        | "triaging"
        | "awaiting_approval"
        | "approved"
        | "dispatched"
        | "scheduled"
        | "in_progress"
        | "pending_verification"
        | "completed"
        | "cancelled"
        | "on_hold"
      work_order_urgency: "low" | "normal" | "high" | "emergency"
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
      account_status: ["pending", "approved", "rejected"],
      app_role: ["admin", "user"],
      approval_status: [
        "pending",
        "approved",
        "declined",
        "auto_approved",
        "expired",
      ],
      lead_source: [
        "calendar_booking",
        "referral",
        "website",
        "phone_call",
        "email",
        "other",
      ],
      lead_stage: [
        "new_lead",
        "unreached",
        "call_scheduled",
        "call_attended",
        "send_contract",
        "contract_out",
        "contract_signed",
        "welcome_email_w9",
        "ach_form_signed",
        "onboarding_form_requested",
        "insurance_requested",
        "inspection_scheduled",
        "ops_handoff",
      ],
      message_sender_type: ["owner", "pm", "vendor", "guest", "ai", "system"],
      property_type: ["Client-Managed", "Company-Owned", "Inactive"],
      vendor_status: ["active", "inactive", "preferred", "blocked"],
      work_order_status: [
        "new",
        "triaging",
        "awaiting_approval",
        "approved",
        "dispatched",
        "scheduled",
        "in_progress",
        "pending_verification",
        "completed",
        "cancelled",
        "on_hold",
      ],
      work_order_urgency: ["low", "normal", "high", "emergency"],
    },
  },
} as const
