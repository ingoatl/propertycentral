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
      booking_documents: {
        Row: {
          booking_id: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          document_name: string | null
          document_type: string | null
          embedded_edit_url: string | null
          field_configuration: Json | null
          guest_signed_at: string | null
          guest_signing_url: string | null
          host_signed_at: string | null
          host_signer_id: string | null
          host_signing_url: string | null
          id: string
          is_draft: boolean | null
          property_id: string | null
          recipient_email: string | null
          recipient_name: string | null
          sent_at: string | null
          signed_document_path: string | null
          signwell_document_id: string | null
          status: string | null
          template_id: string | null
        }
        Insert: {
          booking_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          document_name?: string | null
          document_type?: string | null
          embedded_edit_url?: string | null
          field_configuration?: Json | null
          guest_signed_at?: string | null
          guest_signing_url?: string | null
          host_signed_at?: string | null
          host_signer_id?: string | null
          host_signing_url?: string | null
          id?: string
          is_draft?: boolean | null
          property_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          sent_at?: string | null
          signed_document_path?: string | null
          signwell_document_id?: string | null
          status?: string | null
          template_id?: string | null
        }
        Update: {
          booking_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          document_name?: string | null
          document_type?: string | null
          embedded_edit_url?: string | null
          field_configuration?: Json | null
          guest_signed_at?: string | null
          guest_signing_url?: string | null
          host_signed_at?: string | null
          host_signer_id?: string | null
          host_signing_url?: string | null
          id?: string
          is_draft?: boolean | null
          property_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          sent_at?: string | null
          signed_document_path?: string | null
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
          created_at: string | null
          created_by: string | null
          description: string | null
          field_mappings: Json | null
          file_path: string
          id: string
          is_active: boolean | null
          name: string
          signwell_template_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          field_mappings?: Json | null
          file_path: string
          id?: string
          is_active?: boolean | null
          name: string
          signwell_template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          field_mappings?: Json | null
          file_path?: string
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
      email_insights: {
        Row: {
          action_required: boolean | null
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
      gmail_oauth_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          receipt_path: string | null
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
          receipt_path?: string | null
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
          receipt_path?: string | null
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
      partner_properties: {
        Row: {
          address: string | null
          amenities: Json | null
          appliances_included: string[] | null
          bathrooms: number | null
          bedrooms: number | null
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
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          amenities?: Json | null
          appliances_included?: string[] | null
          bathrooms?: number | null
          bedrooms?: number | null
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
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          amenities?: Json | null
          appliances_included?: string[] | null
          bathrooms?: number | null
          bedrooms?: number | null
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
      profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          id: string
          is_admin: boolean
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          is_admin?: boolean
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          is_admin?: boolean
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          created_at: string
          ical_url: string | null
          id: string
          image_path: string | null
          management_fee_percentage: number
          name: string
          nightly_rate: number | null
          order_minimum_fee: number | null
          owner_id: string | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          rental_type: string | null
          user_id: string | null
          visit_price: number
        }
        Insert: {
          address: string
          created_at?: string
          ical_url?: string | null
          id?: string
          image_path?: string | null
          management_fee_percentage?: number
          name: string
          nightly_rate?: number | null
          order_minimum_fee?: number | null
          owner_id?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          rental_type?: string | null
          user_id?: string | null
          visit_price?: number
        }
        Update: {
          address?: string
          created_at?: string
          ical_url?: string | null
          id?: string
          image_path?: string | null
          management_fee_percentage?: number
          name?: string
          nightly_rate?: number | null
          order_minimum_fee?: number | null
          owner_id?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          rental_type?: string | null
          user_id?: string | null
          visit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
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
      property_owners: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          payment_method: string
          phone: string | null
          second_owner_email: string | null
          second_owner_name: string | null
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          payment_method: string
          phone?: string | null
          second_owner_email?: string | null
          second_owner_name?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          payment_method?: string
          phone?: string | null
          second_owner_email?: string | null
          second_owner_name?: string | null
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
    }
    Enums: {
      account_status: "pending" | "approved" | "rejected"
      app_role: "admin" | "user"
      property_type: "Client-Managed" | "Company-Owned" | "Inactive"
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
      property_type: ["Client-Managed", "Company-Owned", "Inactive"],
    },
  },
} as const
