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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      bris_api_keys: {
        Row: {
          dn_code: string
          encrypt_key: string
          endpoint_name: string
          file_name: string | null
          id: number
          is_active: boolean | null
          p_key: string
          updated_at: string | null
          v_key: string
        }
        Insert: {
          dn_code: string
          encrypt_key: string
          endpoint_name: string
          file_name?: string | null
          id?: number
          is_active?: boolean | null
          p_key: string
          updated_at?: string | null
          v_key: string
        }
        Update: {
          dn_code?: string
          encrypt_key?: string
          endpoint_name?: string
          file_name?: string | null
          id?: number
          is_active?: boolean | null
          p_key?: string
          updated_at?: string | null
          v_key?: string
        }
        Relationships: []
      }
      class_groups: {
        Row: {
          capacity: number | null
          created_at: string | null
          id: string
          name: string
          notes: string | null
          session_id: string
          survey_url_token: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          session_id: string
          survey_url_token?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          session_id?: string
          survey_url_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_groups_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string | null
          description: string | null
          education_type: string | null
          id: string
          name: string
          project_id: string
          target_audience: string | null
          total_hours: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          education_type?: string | null
          id?: string
          name: string
          project_id: string
          target_audience?: string | null
          total_hours?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          education_type?: string | null
          id?: string
          name?: string
          project_id?: string
          target_audience?: string | null
          total_hours?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_bris_raw_pages: {
        Row: {
          bris_url: string
          fetch_params: Json
          fetched_at: string
          fetched_by: string | null
          id: string
          page_kind: string
          raw_bytes_sha1: string
          raw_html: string | null
          sync_id: string | null
        }
        Insert: {
          bris_url: string
          fetch_params?: Json
          fetched_at?: string
          fetched_by?: string | null
          id?: string
          page_kind: string
          raw_bytes_sha1: string
          raw_html?: string | null
          sync_id?: string | null
        }
        Update: {
          bris_url?: string
          fetch_params?: Json
          fetched_at?: string
          fetched_by?: string | null
          id?: string
          page_kind?: string
          raw_bytes_sha1?: string
          raw_html?: string | null
          sync_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_bris_raw_pages_sync_id_fkey"
            columns: ["sync_id"]
            isOneToOne: false
            referencedRelation: "cs_sync_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_bris_raw_records: {
        Row: {
          bris_place_id: string | null
          business_id: string | null
          content_hash: string
          customer_id: string | null
          extracted_at: string
          id: string
          page_id: string
          payload: Json
          project_id: string | null
          record_index: number | null
          record_kind: string
        }
        Insert: {
          bris_place_id?: string | null
          business_id?: string | null
          content_hash: string
          customer_id?: string | null
          extracted_at?: string
          id?: string
          page_id: string
          payload: Json
          project_id?: string | null
          record_index?: number | null
          record_kind: string
        }
        Update: {
          bris_place_id?: string | null
          business_id?: string | null
          content_hash?: string
          customer_id?: string | null
          extracted_at?: string
          id?: string
          page_id?: string
          payload?: Json
          project_id?: string | null
          record_index?: number | null
          record_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "cs_bris_raw_records_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "cs_bris_raw_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_business_places: {
        Row: {
          address: string | null
          bris_place_id: string | null
          company_id: string
          created_at: string | null
          id: string
          place_id: string | null
          place_name: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          bris_place_id?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          place_id?: string | null
          place_name: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          bris_place_id?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          place_id?: string | null
          place_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_business_places_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "cs_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_business_places_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_cs_target_candidates"
            referencedColumns: ["company_uuid"]
          },
        ]
      }
      cs_companies: {
        Row: {
          biz_reg_no: string | null
          company_id: string | null
          company_name: string
          created_at: string | null
          id: string
          industry: string | null
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          biz_reg_no?: string | null
          company_id?: string | null
          company_name: string
          created_at?: string | null
          id?: string
          industry?: string | null
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          biz_reg_no?: string | null
          company_id?: string | null
          company_name?: string
          created_at?: string | null
          id?: string
          industry?: string | null
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cs_contacts: {
        Row: {
          contact_name: string
          created_at: string | null
          customer_id: string | null
          department: string | null
          email: string | null
          id: string
          is_active: boolean | null
          last_survey_date: string | null
          mobile: string | null
          phone: string | null
          place_id: string | null
          position: string | null
          source_raw_record_id: string | null
          survey_count_6m: number | null
          updated_at: string | null
        }
        Insert: {
          contact_name: string
          created_at?: string | null
          customer_id?: string | null
          department?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          last_survey_date?: string | null
          mobile?: string | null
          phone?: string | null
          place_id?: string | null
          position?: string | null
          source_raw_record_id?: string | null
          survey_count_6m?: number | null
          updated_at?: string | null
        }
        Update: {
          contact_name?: string
          created_at?: string | null
          customer_id?: string | null
          department?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          last_survey_date?: string | null
          mobile?: string | null
          phone?: string | null
          place_id?: string | null
          position?: string | null
          source_raw_record_id?: string | null
          survey_count_6m?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_contacts_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "cs_business_places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_contacts_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "v_cs_target_candidates"
            referencedColumns: ["place_id"]
          },
          {
            foreignKeyName: "cs_contacts_source_raw_record_id_fkey"
            columns: ["source_raw_record_id"]
            isOneToOne: false
            referencedRelation: "cs_bris_raw_records"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_courses: {
        Row: {
          bris_synced_at: string | null
          business_id: string | null
          contact_id: string | null
          course_name: string
          created_at: string | null
          echo_exclude_reason: string | null
          echo_id: string | null
          echo_status: string | null
          education_type: string | null
          end_date: string | null
          headcount: number | null
          id: string
          is_completed: boolean | null
          is_last_in_project: boolean | null
          last_content_hash: string | null
          program_name: string | null
          project_id: string
          revenue: number | null
          session_number: number | null
          sort_order: number | null
          source_raw_record_id: string | null
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          bris_synced_at?: string | null
          business_id?: string | null
          contact_id?: string | null
          course_name: string
          created_at?: string | null
          echo_exclude_reason?: string | null
          echo_id?: string | null
          echo_status?: string | null
          education_type?: string | null
          end_date?: string | null
          headcount?: number | null
          id?: string
          is_completed?: boolean | null
          is_last_in_project?: boolean | null
          last_content_hash?: string | null
          program_name?: string | null
          project_id: string
          revenue?: number | null
          session_number?: number | null
          sort_order?: number | null
          source_raw_record_id?: string | null
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          bris_synced_at?: string | null
          business_id?: string | null
          contact_id?: string | null
          course_name?: string
          created_at?: string | null
          echo_exclude_reason?: string | null
          echo_id?: string | null
          echo_status?: string | null
          education_type?: string | null
          end_date?: string | null
          headcount?: number | null
          id?: string
          is_completed?: boolean | null
          is_last_in_project?: boolean | null
          last_content_hash?: string | null
          program_name?: string | null
          project_id?: string
          revenue?: number | null
          session_number?: number | null
          sort_order?: number | null
          source_raw_record_id?: string | null
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_courses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "cs_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_courses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_cs_target_candidates"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "cs_courses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cs_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_courses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_cs_project_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_courses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_cs_target_candidates"
            referencedColumns: ["project_uuid"]
          },
          {
            foreignKeyName: "cs_courses_source_raw_record_id_fkey"
            columns: ["source_raw_record_id"]
            isOneToOne: false
            referencedRelation: "cs_bris_raw_records"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_dispatch_records: {
        Row: {
          batch_id: string
          channel: string
          created_at: string | null
          error_message: string | null
          id: string
          opened_at: string | null
          recipient_email: string | null
          recipient_name: string | null
          recipient_phone: string | null
          retry_count: number | null
          sent_at: string | null
          status: string | null
          survey_url: string | null
          target_id: string
        }
        Insert: {
          batch_id: string
          channel?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          opened_at?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string | null
          survey_url?: string | null
          target_id: string
        }
        Update: {
          batch_id?: string
          channel?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          opened_at?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string | null
          survey_url?: string | null
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cs_dispatch_records_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "cs_target_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_dispatch_records_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_cs_batch_dashboard"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "cs_dispatch_records_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_cs_dispatch_summary"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "cs_dispatch_records_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "cs_survey_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_dispatch_records_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "v_cs_target_detail"
            referencedColumns: ["target_id"]
          },
        ]
      }
      cs_external_send_history: {
        Row: {
          company_name: string | null
          contact_name: string | null
          course_name: string | null
          file_name: string | null
          id: string
          imported_at: string | null
          phone_e164: string
          sent_at: string
          source: string | null
        }
        Insert: {
          company_name?: string | null
          contact_name?: string | null
          course_name?: string | null
          file_name?: string | null
          id?: string
          imported_at?: string | null
          phone_e164: string
          sent_at: string
          source?: string | null
        }
        Update: {
          company_name?: string | null
          contact_name?: string | null
          course_name?: string | null
          file_name?: string | null
          id?: string
          imported_at?: string | null
          phone_e164?: string
          sent_at?: string
          source?: string | null
        }
        Relationships: []
      }
      cs_import_errors: {
        Row: {
          bris_code: string | null
          created_at: string
          id: string
          missing_fields: string[]
          raw_record_id: string | null
          raw_row: Json
          reason: string | null
          sync_id: string | null
        }
        Insert: {
          bris_code?: string | null
          created_at?: string
          id?: string
          missing_fields?: string[]
          raw_record_id?: string | null
          raw_row: Json
          reason?: string | null
          sync_id?: string | null
        }
        Update: {
          bris_code?: string | null
          created_at?: string
          id?: string
          missing_fields?: string[]
          raw_record_id?: string | null
          raw_row?: Json
          reason?: string | null
          sync_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_import_errors_raw_record_id_fkey"
            columns: ["raw_record_id"]
            isOneToOne: false
            referencedRelation: "cs_bris_raw_records"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_project_members: {
        Row: {
          created_at: string | null
          id: string
          member_name: string
          project_id: string
          role: string
          team: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          member_name: string
          project_id: string
          role: string
          team?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          member_name?: string
          project_id?: string
          role?: string
          team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cs_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_cs_project_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_cs_target_candidates"
            referencedColumns: ["project_uuid"]
          },
        ]
      }
      cs_projects: {
        Row: {
          am_name: string | null
          am_team: string | null
          bris_code: string | null
          bris_synced_at: string | null
          closed_at: string | null
          course_count: number | null
          created_at: string | null
          deadline_date: string | null
          echo_enabled: boolean | null
          echo_exclude_reason: string | null
          execution_team: string | null
          id: string
          last_content_hash: string | null
          order_date: string | null
          project_id: string | null
          project_name: string
          project_type: string | null
          registration_date: string | null
          source_raw_record_id: string | null
          status: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          am_name?: string | null
          am_team?: string | null
          bris_code?: string | null
          bris_synced_at?: string | null
          closed_at?: string | null
          course_count?: number | null
          created_at?: string | null
          deadline_date?: string | null
          echo_enabled?: boolean | null
          echo_exclude_reason?: string | null
          execution_team?: string | null
          id?: string
          last_content_hash?: string | null
          order_date?: string | null
          project_id?: string | null
          project_name: string
          project_type?: string | null
          registration_date?: string | null
          source_raw_record_id?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          am_name?: string | null
          am_team?: string | null
          bris_code?: string | null
          bris_synced_at?: string | null
          closed_at?: string | null
          course_count?: number | null
          created_at?: string | null
          deadline_date?: string | null
          echo_enabled?: boolean | null
          echo_exclude_reason?: string | null
          execution_team?: string | null
          id?: string
          last_content_hash?: string | null
          order_date?: string | null
          project_id?: string | null
          project_name?: string
          project_type?: string | null
          registration_date?: string | null
          source_raw_record_id?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_projects_source_raw_record_id_fkey"
            columns: ["source_raw_record_id"]
            isOneToOne: false
            referencedRelation: "cs_bris_raw_records"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_survey_participation: {
        Row: {
          contact_id: string
          created_at: string | null
          id: string
          notes: string | null
          project_id: string | null
          responded_at: string | null
          response_status: string | null
          satisfaction_score: number | null
          survey_date: string
          survey_type: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          responded_at?: string | null
          response_status?: string | null
          satisfaction_score?: number | null
          survey_date: string
          survey_type?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          responded_at?: string | null
          response_status?: string | null
          satisfaction_score?: number | null
          survey_date?: string
          survey_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_survey_participation_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "cs_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_survey_participation_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_cs_target_candidates"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "cs_survey_participation_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cs_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_survey_participation_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_cs_project_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_survey_participation_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_cs_target_candidates"
            referencedColumns: ["project_uuid"]
          },
        ]
      }
      cs_survey_questions: {
        Row: {
          created_at: string | null
          id: string
          is_required: boolean | null
          mapping_status: string | null
          metadata: Json | null
          notes: string | null
          page_type: string
          question_no: string
          question_text: string
          question_type: string
          response_options: string | null
          result_column: string
          section_label: string | null
          skip_logic: Json | null
          sort_order: number
          template_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          mapping_status?: string | null
          metadata?: Json | null
          notes?: string | null
          page_type?: string
          question_no: string
          question_text: string
          question_type?: string
          response_options?: string | null
          result_column?: string
          section_label?: string | null
          skip_logic?: Json | null
          sort_order?: number
          template_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          mapping_status?: string | null
          metadata?: Json | null
          notes?: string | null
          page_type?: string
          question_no?: string
          question_text?: string
          question_type?: string
          response_options?: string | null
          result_column?: string
          section_label?: string | null
          skip_logic?: Json | null
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cs_survey_questions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "cs_survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_survey_results: {
        Row: {
          completed_at: string | null
          contact_id: string
          created_at: string | null
          dispatch_id: string | null
          id: string
          overall_score: number | null
          project_id: string | null
          response_data: Json | null
          started_at: string | null
          target_id: string
        }
        Insert: {
          completed_at?: string | null
          contact_id: string
          created_at?: string | null
          dispatch_id?: string | null
          id?: string
          overall_score?: number | null
          project_id?: string | null
          response_data?: Json | null
          started_at?: string | null
          target_id: string
        }
        Update: {
          completed_at?: string | null
          contact_id?: string
          created_at?: string | null
          dispatch_id?: string | null
          id?: string
          overall_score?: number | null
          project_id?: string | null
          response_data?: Json | null
          started_at?: string | null
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cs_survey_results_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "cs_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_survey_results_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_cs_target_candidates"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "cs_survey_results_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "cs_dispatch_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_survey_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cs_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_survey_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_cs_project_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_survey_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_cs_target_candidates"
            referencedColumns: ["project_uuid"]
          },
          {
            foreignKeyName: "cs_survey_results_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "cs_survey_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_survey_results_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "v_cs_target_detail"
            referencedColumns: ["target_id"]
          },
        ]
      }
      cs_survey_targets: {
        Row: {
          batch_id: string
          contact_id: string
          context_snapshot: Json | null
          course_id: string | null
          created_at: string | null
          current_step: number | null
          dispatch_channel: string | null
          dispatch_error: string | null
          dispatched_at: string | null
          distribution_id: string | null
          exclusion_reason: string | null
          id: string
          is_eligible: boolean | null
          project_id: string
          status: string | null
          step1_checked_at: string | null
          step1_course_completed: boolean | null
          step1_note: string | null
          step2_checked_at: string | null
          step2_last_course_confirmed: boolean | null
          step2_last_course_date: string | null
          step2_note: string | null
          step3_checked_at: string | null
          step3_closed_date: string | null
          step3_note: string | null
          step3_project_closed: boolean | null
          step4_checked_at: string | null
          step4_history_checked: boolean | null
          step4_last_survey_date: string | null
          step4_note: string | null
          step4_within_6months: boolean | null
          step5_confirmed: boolean | null
          step5_confirmed_at: string | null
          step5_confirmed_by: string | null
          survey_token: string | null
          survey_url: string | null
          updated_at: string | null
        }
        Insert: {
          batch_id: string
          contact_id: string
          context_snapshot?: Json | null
          course_id?: string | null
          created_at?: string | null
          current_step?: number | null
          dispatch_channel?: string | null
          dispatch_error?: string | null
          dispatched_at?: string | null
          distribution_id?: string | null
          exclusion_reason?: string | null
          id?: string
          is_eligible?: boolean | null
          project_id: string
          status?: string | null
          step1_checked_at?: string | null
          step1_course_completed?: boolean | null
          step1_note?: string | null
          step2_checked_at?: string | null
          step2_last_course_confirmed?: boolean | null
          step2_last_course_date?: string | null
          step2_note?: string | null
          step3_checked_at?: string | null
          step3_closed_date?: string | null
          step3_note?: string | null
          step3_project_closed?: boolean | null
          step4_checked_at?: string | null
          step4_history_checked?: boolean | null
          step4_last_survey_date?: string | null
          step4_note?: string | null
          step4_within_6months?: boolean | null
          step5_confirmed?: boolean | null
          step5_confirmed_at?: string | null
          step5_confirmed_by?: string | null
          survey_token?: string | null
          survey_url?: string | null
          updated_at?: string | null
        }
        Update: {
          batch_id?: string
          contact_id?: string
          context_snapshot?: Json | null
          course_id?: string | null
          created_at?: string | null
          current_step?: number | null
          dispatch_channel?: string | null
          dispatch_error?: string | null
          dispatched_at?: string | null
          distribution_id?: string | null
          exclusion_reason?: string | null
          id?: string
          is_eligible?: boolean | null
          project_id?: string
          status?: string | null
          step1_checked_at?: string | null
          step1_course_completed?: boolean | null
          step1_note?: string | null
          step2_checked_at?: string | null
          step2_last_course_confirmed?: boolean | null
          step2_last_course_date?: string | null
          step2_note?: string | null
          step3_checked_at?: string | null
          step3_closed_date?: string | null
          step3_note?: string | null
          step3_project_closed?: boolean | null
          step4_checked_at?: string | null
          step4_history_checked?: boolean | null
          step4_last_survey_date?: string | null
          step4_note?: string | null
          step4_within_6months?: boolean | null
          step5_confirmed?: boolean | null
          step5_confirmed_at?: string | null
          step5_confirmed_by?: string | null
          survey_token?: string | null
          survey_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_survey_targets_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "cs_target_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_survey_targets_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_cs_batch_dashboard"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "cs_survey_targets_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_cs_dispatch_summary"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "cs_survey_targets_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "cs_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_survey_targets_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_cs_target_candidates"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "cs_survey_targets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "cs_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_survey_targets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "v_cs_target_candidates"
            referencedColumns: ["course_id"]
          },
          {
            foreignKeyName: "cs_survey_targets_distribution_id_fkey"
            columns: ["distribution_id"]
            isOneToOne: false
            referencedRelation: "distributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_survey_targets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cs_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_survey_targets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_cs_project_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_survey_targets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_cs_target_candidates"
            referencedColumns: ["project_uuid"]
          },
        ]
      }
      cs_survey_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          division: string
          division_label: string
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          division: string
          division_label: string
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          division?: string
          division_label?: string
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cs_survey_warnings: {
        Row: {
          action_required: string
          affected_columns: string | null
          affected_questions: string | null
          created_at: string | null
          description: string
          id: string
          is_resolved: boolean | null
          severity: string | null
          template_id: string
          warning_type: string
        }
        Insert: {
          action_required: string
          affected_columns?: string | null
          affected_questions?: string | null
          created_at?: string | null
          description: string
          id?: string
          is_resolved?: boolean | null
          severity?: string | null
          template_id: string
          warning_type: string
        }
        Update: {
          action_required?: string
          affected_columns?: string | null
          affected_questions?: string | null
          created_at?: string | null
          description?: string
          id?: string
          is_resolved?: boolean | null
          severity?: string | null
          template_id?: string
          warning_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cs_survey_warnings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "cs_survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_sync_logs: {
        Row: {
          error_message: string | null
          finished_at: string | null
          id: string
          new_companies: number | null
          new_contacts: number | null
          new_courses: number | null
          new_projects: number | null
          period_end: string | null
          period_start: string | null
          rows_fetched: number | null
          rows_skipped: number | null
          rows_upserted: number | null
          started_at: string | null
          status: string | null
          sync_type: string | null
          triggered_batch_id: string | null
        }
        Insert: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          new_companies?: number | null
          new_contacts?: number | null
          new_courses?: number | null
          new_projects?: number | null
          period_end?: string | null
          period_start?: string | null
          rows_fetched?: number | null
          rows_skipped?: number | null
          rows_upserted?: number | null
          started_at?: string | null
          status?: string | null
          sync_type?: string | null
          triggered_batch_id?: string | null
        }
        Update: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          new_companies?: number | null
          new_contacts?: number | null
          new_courses?: number | null
          new_projects?: number | null
          period_end?: string | null
          period_start?: string | null
          rows_fetched?: number | null
          rows_skipped?: number | null
          rows_upserted?: number | null
          started_at?: string | null
          status?: string | null
          sync_type?: string | null
          triggered_batch_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_sync_logs_triggered_batch_id_fkey"
            columns: ["triggered_batch_id"]
            isOneToOne: false
            referencedRelation: "cs_target_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_sync_logs_triggered_batch_id_fkey"
            columns: ["triggered_batch_id"]
            isOneToOne: false
            referencedRelation: "v_cs_batch_dashboard"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "cs_sync_logs_triggered_batch_id_fkey"
            columns: ["triggered_batch_id"]
            isOneToOne: false
            referencedRelation: "v_cs_dispatch_summary"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      cs_target_batches: {
        Row: {
          batch_name: string
          confirmed_at: string | null
          created_at: string | null
          created_by: string | null
          criteria: Json | null
          dispatched_at: string | null
          dispatched_count: number | null
          eligible_count: number | null
          excluded_count: number | null
          id: string
          status: string | null
          survey_id: string | null
          target_period_end: string | null
          target_period_start: string | null
          total_candidates: number | null
        }
        Insert: {
          batch_name: string
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          criteria?: Json | null
          dispatched_at?: string | null
          dispatched_count?: number | null
          eligible_count?: number | null
          excluded_count?: number | null
          id?: string
          status?: string | null
          survey_id?: string | null
          target_period_end?: string | null
          target_period_start?: string | null
          total_candidates?: number | null
        }
        Update: {
          batch_name?: string
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          criteria?: Json | null
          dispatched_at?: string | null
          dispatched_count?: number | null
          eligible_count?: number | null
          excluded_count?: number | null
          id?: string
          status?: string | null
          survey_id?: string | null
          target_period_end?: string | null
          target_period_start?: string | null
          total_candidates?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_target_batches_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "edu_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_target_batches_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "v_edu_survey_stats"
            referencedColumns: ["survey_id"]
          },
        ]
      }
      cs_trade_history: {
        Row: {
          amount: number | null
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          project_id: string | null
          trade_type: string | null
          trade_year: number | null
        }
        Insert: {
          amount?: number | null
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          project_id?: string | null
          trade_type?: string | null
          trade_year?: number | null
        }
        Update: {
          amount?: number | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          project_id?: string | null
          trade_type?: string | null
          trade_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_trade_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "cs_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_trade_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_cs_target_candidates"
            referencedColumns: ["company_uuid"]
          },
          {
            foreignKeyName: "cs_trade_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cs_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_trade_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_cs_project_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_trade_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_cs_target_candidates"
            referencedColumns: ["project_uuid"]
          },
        ]
      }
      customers: {
        Row: {
          company_name: string
          contact_name: string | null
          contact_title: string | null
          created_at: string
          eco_score: number | null
          email: string | null
          id: number
          is_active: boolean
          notes: string | null
          phone: string | null
          sales_rep: string | null
          sales_team: string | null
          service_type_id: number
          updated_at: string
        }
        Insert: {
          company_name: string
          contact_name?: string | null
          contact_title?: string | null
          created_at?: string
          eco_score?: number | null
          email?: string | null
          id?: number
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          sales_rep?: string | null
          sales_team?: string | null
          service_type_id: number
          updated_at?: string
        }
        Update: {
          company_name?: string
          contact_name?: string | null
          contact_title?: string | null
          created_at?: string
          eco_score?: number | null
          email?: string | null
          id?: number
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          sales_rep?: string | null
          sales_team?: string | null
          service_type_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_batches: {
        Row: {
          channel: string
          completed_count: number | null
          created_at: string | null
          cs_batch_id: string | null
          id: string
          is_test: boolean | null
          label: string | null
          opened_count: number | null
          sent_count: number | null
          source: string | null
          source_batch_id: string | null
          survey_id: string
          title: string | null
          total_count: number | null
        }
        Insert: {
          channel?: string
          completed_count?: number | null
          created_at?: string | null
          cs_batch_id?: string | null
          id?: string
          is_test?: boolean | null
          label?: string | null
          opened_count?: number | null
          sent_count?: number | null
          source?: string | null
          source_batch_id?: string | null
          survey_id: string
          title?: string | null
          total_count?: number | null
        }
        Update: {
          channel?: string
          completed_count?: number | null
          created_at?: string | null
          cs_batch_id?: string | null
          id?: string
          is_test?: boolean | null
          label?: string | null
          opened_count?: number | null
          sent_count?: number | null
          source?: string | null
          source_batch_id?: string | null
          survey_id?: string
          title?: string | null
          total_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "distribution_batches_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "edu_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_batches_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "v_edu_survey_stats"
            referencedColumns: ["survey_id"]
          },
        ]
      }
      distributions: {
        Row: {
          batch_id: string | null
          channel: string
          completed_at: string | null
          created_at: string | null
          cs_batch_id: string | null
          cs_target_id: string | null
          error_message: string | null
          id: string
          last_reminder_at: string | null
          opened_at: string | null
          recipient_company: string | null
          recipient_department: string | null
          recipient_email: string | null
          recipient_name: string | null
          recipient_phone: string | null
          recipient_position: string | null
          reminder_count: number | null
          respondent_id: string | null
          sent_at: string | null
          started_at: string | null
          status: string | null
          survey_id: string
          unique_token: string | null
        }
        Insert: {
          batch_id?: string | null
          channel?: string
          completed_at?: string | null
          created_at?: string | null
          cs_batch_id?: string | null
          cs_target_id?: string | null
          error_message?: string | null
          id?: string
          last_reminder_at?: string | null
          opened_at?: string | null
          recipient_company?: string | null
          recipient_department?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          recipient_position?: string | null
          reminder_count?: number | null
          respondent_id?: string | null
          sent_at?: string | null
          started_at?: string | null
          status?: string | null
          survey_id: string
          unique_token?: string | null
        }
        Update: {
          batch_id?: string | null
          channel?: string
          completed_at?: string | null
          created_at?: string | null
          cs_batch_id?: string | null
          cs_target_id?: string | null
          error_message?: string | null
          id?: string
          last_reminder_at?: string | null
          opened_at?: string | null
          recipient_company?: string | null
          recipient_department?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          recipient_position?: string | null
          reminder_count?: number | null
          respondent_id?: string | null
          sent_at?: string | null
          started_at?: string | null
          status?: string | null
          survey_id?: string
          unique_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distributions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "distribution_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distributions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_distribution_stats"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "distributions_respondent_id_fkey"
            columns: ["respondent_id"]
            isOneToOne: false
            referencedRelation: "respondents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distributions_survey_id_fkey1"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "edu_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distributions_survey_id_fkey1"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "v_edu_survey_stats"
            referencedColumns: ["survey_id"]
          },
        ]
      }
      edu_questions: {
        Row: {
          created_at: string | null
          id: string
          is_required: boolean | null
          metadata: Json | null
          options: Json | null
          question_code: string | null
          question_text: string
          question_type: string
          section: string | null
          skip_logic: Json | null
          sort_order: number
          survey_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          metadata?: Json | null
          options?: Json | null
          question_code?: string | null
          question_text: string
          question_type?: string
          section?: string | null
          skip_logic?: Json | null
          sort_order?: number
          survey_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          metadata?: Json | null
          options?: Json | null
          question_code?: string | null
          question_text?: string
          question_type?: string
          section?: string | null
          skip_logic?: Json | null
          sort_order?: number
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "edu_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "v_edu_survey_stats"
            referencedColumns: ["survey_id"]
          },
        ]
      }
      edu_submissions: {
        Row: {
          answers: Json
          channel: string | null
          class_group_id: string | null
          created_at: string | null
          distribution_id: string | null
          id: string
          ip_address: unknown
          is_complete: boolean | null
          is_test: boolean | null
          respondent_department: string | null
          respondent_id: string | null
          respondent_name: string | null
          respondent_position: string | null
          session_id: string | null
          submitted_at: string | null
          survey_id: string
          total_score: number | null
          user_agent: string | null
        }
        Insert: {
          answers?: Json
          channel?: string | null
          class_group_id?: string | null
          created_at?: string | null
          distribution_id?: string | null
          id?: string
          ip_address?: unknown
          is_complete?: boolean | null
          is_test?: boolean | null
          respondent_department?: string | null
          respondent_id?: string | null
          respondent_name?: string | null
          respondent_position?: string | null
          session_id?: string | null
          submitted_at?: string | null
          survey_id: string
          total_score?: number | null
          user_agent?: string | null
        }
        Update: {
          answers?: Json
          channel?: string | null
          class_group_id?: string | null
          created_at?: string | null
          distribution_id?: string | null
          id?: string
          ip_address?: unknown
          is_complete?: boolean | null
          is_test?: boolean | null
          respondent_department?: string | null
          respondent_id?: string | null
          respondent_name?: string | null
          respondent_position?: string | null
          session_id?: string | null
          submitted_at?: string | null
          survey_id?: string
          total_score?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edu_submissions_class_group_id_fkey"
            columns: ["class_group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_submissions_respondent_id_fkey"
            columns: ["respondent_id"]
            isOneToOne: false
            referencedRelation: "respondents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_submissions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_submissions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "edu_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_submissions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "v_edu_survey_stats"
            referencedColumns: ["survey_id"]
          },
        ]
      }
      edu_survey_templates: {
        Row: {
          created_at: string | null
          description: string | null
          education_type: string | null
          id: string
          is_active: boolean | null
          name: string
          question_config: Json
          survey_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          education_type?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          question_config?: Json
          survey_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          education_type?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          question_config?: Json
          survey_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      edu_surveys: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          education_type: string | null
          ends_at: string | null
          id: string
          owner_id: string | null
          project_id: string | null
          session_id: string | null
          settings: Json | null
          starts_at: string | null
          status: string | null
          survey_type: string
          title: string
          updated_at: string | null
          url_token: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          education_type?: string | null
          ends_at?: string | null
          id?: string
          owner_id?: string | null
          project_id?: string | null
          session_id?: string | null
          settings?: Json | null
          starts_at?: string | null
          status?: string | null
          survey_type?: string
          title: string
          updated_at?: string | null
          url_token?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          education_type?: string | null
          ends_at?: string | null
          id?: string
          owner_id?: string | null
          project_id?: string | null
          session_id?: string | null
          settings?: Json | null
          starts_at?: string | null
          status?: string | null
          survey_type?: string
          title?: string
          updated_at?: string | null
          url_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edu_surveys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_surveys_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          body_html: string
          created_at: string | null
          cs_dispatch_id: string | null
          distribution_id: string | null
          id: string
          last_error: string | null
          max_retries: number | null
          recipient_email: string
          recipient_name: string | null
          retry_count: number | null
          schedule_type: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          subject: string
          template_id: string | null
          trigger_rule: Json | null
        }
        Insert: {
          body_html: string
          created_at?: string | null
          cs_dispatch_id?: string | null
          distribution_id?: string | null
          id?: string
          last_error?: string | null
          max_retries?: number | null
          recipient_email: string
          recipient_name?: string | null
          retry_count?: number | null
          schedule_type?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          template_id?: string | null
          trigger_rule?: Json | null
        }
        Update: {
          body_html?: string
          created_at?: string | null
          cs_dispatch_id?: string | null
          distribution_id?: string | null
          id?: string
          last_error?: string | null
          max_retries?: number | null
          recipient_email?: string
          recipient_name?: string | null
          retry_count?: number | null
          schedule_type?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          template_id?: string | null
          trigger_rule?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_cs_dispatch_id_fkey"
            columns: ["cs_dispatch_id"]
            isOneToOne: false
            referencedRelation: "cs_dispatch_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_distribution_id_fkey"
            columns: ["distribution_id"]
            isOneToOne: false
            referencedRelation: "distributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          created_at: string | null
          education_type: string | null
          id: string
          is_default: boolean | null
          name: string
          subject: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          body_html: string
          created_at?: string | null
          education_type?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          subject: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          body_html?: string
          created_at?: string | null
          education_type?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          subject?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      hrd_benchmark_cache: {
        Row: {
          calculated_at: string | null
          distribution: Json | null
          group_type: string
          id: string
          item_id: string
          max_value: number | null
          mean_value: number | null
          median_value: number | null
          min_value: number | null
          percentiles: Json | null
          q1_value: number | null
          q3_value: number | null
          response_count: number | null
          round_id: string
          std_dev: number | null
        }
        Insert: {
          calculated_at?: string | null
          distribution?: Json | null
          group_type: string
          id?: string
          item_id: string
          max_value?: number | null
          mean_value?: number | null
          median_value?: number | null
          min_value?: number | null
          percentiles?: Json | null
          q1_value?: number | null
          q3_value?: number | null
          response_count?: number | null
          round_id: string
          std_dev?: number | null
        }
        Update: {
          calculated_at?: string | null
          distribution?: Json | null
          group_type?: string
          id?: string
          item_id?: string
          max_value?: number | null
          mean_value?: number | null
          median_value?: number | null
          min_value?: number | null
          percentiles?: Json | null
          q1_value?: number | null
          q3_value?: number | null
          response_count?: number | null
          round_id?: string
          std_dev?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hrd_benchmark_cache_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "hrd_survey_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrd_benchmark_cache_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "hrd_survey_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrd_benchmark_cache_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "v_hrd_response_summary"
            referencedColumns: ["round_id"]
          },
        ]
      }
      hrd_consulting_reports: {
        Row: {
          ai_recommendations: Json | null
          ai_summary: string | null
          created_at: string | null
          generated_at: string | null
          id: string
          report_data: Json
          respondent_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          round_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          ai_recommendations?: Json | null
          ai_summary?: string | null
          created_at?: string | null
          generated_at?: string | null
          id?: string
          report_data?: Json
          respondent_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          round_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          ai_recommendations?: Json | null
          ai_summary?: string | null
          created_at?: string | null
          generated_at?: string | null
          id?: string
          report_data?: Json
          respondent_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          round_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hrd_consulting_reports_respondent_id_fkey"
            columns: ["respondent_id"]
            isOneToOne: false
            referencedRelation: "hrd_respondents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrd_consulting_reports_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "hrd_survey_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrd_consulting_reports_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "v_hrd_response_summary"
            referencedColumns: ["round_id"]
          },
        ]
      }
      hrd_respondents: {
        Row: {
          address_detail: string | null
          address_road: string | null
          biz_reg_no: string | null
          company_name: string
          completed_at: string | null
          created_at: string | null
          department_name: string | null
          id: string
          industry_code: string | null
          industry_name: string | null
          invited_at: string | null
          notes: string | null
          org_type: string | null
          org_type_code: number | null
          recommender: string | null
          respondent_email: string | null
          respondent_gender: string | null
          respondent_mobile: string | null
          respondent_name: string | null
          respondent_phone: string | null
          respondent_position: string | null
          round_id: string
          source: string | null
          started_at: string | null
          status: string
          updated_at: string | null
          url_token: string
          verified_at: string | null
          zipcode: string | null
        }
        Insert: {
          address_detail?: string | null
          address_road?: string | null
          biz_reg_no?: string | null
          company_name: string
          completed_at?: string | null
          created_at?: string | null
          department_name?: string | null
          id?: string
          industry_code?: string | null
          industry_name?: string | null
          invited_at?: string | null
          notes?: string | null
          org_type?: string | null
          org_type_code?: number | null
          recommender?: string | null
          respondent_email?: string | null
          respondent_gender?: string | null
          respondent_mobile?: string | null
          respondent_name?: string | null
          respondent_phone?: string | null
          respondent_position?: string | null
          round_id: string
          source?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
          url_token: string
          verified_at?: string | null
          zipcode?: string | null
        }
        Update: {
          address_detail?: string | null
          address_road?: string | null
          biz_reg_no?: string | null
          company_name?: string
          completed_at?: string | null
          created_at?: string | null
          department_name?: string | null
          id?: string
          industry_code?: string | null
          industry_name?: string | null
          invited_at?: string | null
          notes?: string | null
          org_type?: string | null
          org_type_code?: number | null
          recommender?: string | null
          respondent_email?: string | null
          respondent_gender?: string | null
          respondent_mobile?: string | null
          respondent_name?: string | null
          respondent_phone?: string | null
          respondent_position?: string | null
          round_id?: string
          source?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
          url_token?: string
          verified_at?: string | null
          zipcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hrd_respondents_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "hrd_survey_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrd_respondents_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "v_hrd_response_summary"
            referencedColumns: ["round_id"]
          },
        ]
      }
      hrd_responses: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          respondent_id: string
          round_id: string
          updated_at: string | null
          value_json: Json | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          respondent_id: string
          round_id: string
          updated_at?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          respondent_id?: string
          round_id?: string
          updated_at?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hrd_responses_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "hrd_survey_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrd_responses_respondent_id_fkey"
            columns: ["respondent_id"]
            isOneToOne: false
            referencedRelation: "hrd_respondents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrd_responses_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "hrd_survey_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrd_responses_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "v_hrd_response_summary"
            referencedColumns: ["round_id"]
          },
        ]
      }
      hrd_survey_items: {
        Row: {
          analysis_group: string | null
          answer_options: Json | null
          answer_type: string
          benchmark_comparison: string | null
          conditional_logic: Json | null
          created_at: string | null
          help_text: string | null
          id: string
          is_benchmark_item: boolean | null
          is_required: boolean | null
          item_code: string
          part_id: string
          placeholder: string | null
          question_group: string | null
          question_text: string
          round_id: string
          sort_order: number
          sub_item_text: string | null
          unit: string | null
          updated_at: string | null
          validation_rules: Json | null
        }
        Insert: {
          analysis_group?: string | null
          answer_options?: Json | null
          answer_type?: string
          benchmark_comparison?: string | null
          conditional_logic?: Json | null
          created_at?: string | null
          help_text?: string | null
          id?: string
          is_benchmark_item?: boolean | null
          is_required?: boolean | null
          item_code: string
          part_id: string
          placeholder?: string | null
          question_group?: string | null
          question_text: string
          round_id: string
          sort_order?: number
          sub_item_text?: string | null
          unit?: string | null
          updated_at?: string | null
          validation_rules?: Json | null
        }
        Update: {
          analysis_group?: string | null
          answer_options?: Json | null
          answer_type?: string
          benchmark_comparison?: string | null
          conditional_logic?: Json | null
          created_at?: string | null
          help_text?: string | null
          id?: string
          is_benchmark_item?: boolean | null
          is_required?: boolean | null
          item_code?: string
          part_id?: string
          placeholder?: string | null
          question_group?: string | null
          question_text?: string
          round_id?: string
          sort_order?: number
          sub_item_text?: string | null
          unit?: string | null
          updated_at?: string | null
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "hrd_survey_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "hrd_survey_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrd_survey_items_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "hrd_survey_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrd_survey_items_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "v_hrd_response_summary"
            referencedColumns: ["round_id"]
          },
        ]
      }
      hrd_survey_parts: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          part_code: string
          part_name: string
          round_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          part_code: string
          part_name: string
          round_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          part_code?: string
          part_name?: string
          round_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "hrd_survey_parts_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "hrd_survey_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrd_survey_parts_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "v_hrd_response_summary"
            referencedColumns: ["round_id"]
          },
        ]
      }
      hrd_survey_rounds: {
        Row: {
          created_at: string | null
          description: string | null
          ends_at: string | null
          id: string
          round_number: number
          settings: Json | null
          starts_at: string | null
          status: string
          target_count: number | null
          title: string
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          round_number: number
          settings?: Json | null
          starts_at?: string | null
          status?: string
          target_count?: number | null
          title: string
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          round_number?: number
          settings?: Json | null
          starts_at?: string | null
          status?: string
          target_count?: number | null
          title?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      import_logs: {
        Row: {
          errors_json: string | null
          file_name: string
          file_path: string | null
          id: number
          import_type: string
          imported_at: string
          records_failed: number
          records_success: number
          records_total: number
        }
        Insert: {
          errors_json?: string | null
          file_name: string
          file_path?: string | null
          id?: number
          import_type: string
          imported_at?: string
          records_failed?: number
          records_success?: number
          records_total?: number
        }
        Update: {
          errors_json?: string | null
          file_name?: string
          file_path?: string | null
          id?: number
          import_type?: string
          imported_at?: string
          records_failed?: number
          records_success?: number
          records_total?: number
        }
        Relationships: []
      }
      instructors: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          specialty: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          specialty?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          specialty?: string | null
        }
        Relationships: []
      }
      interviews: {
        Row: {
          audio_file_path: string | null
          created_at: string
          customer_id: number
          document_path: string | null
          id: number
          interview_date: string | null
          interview_type: string | null
          interviewer: string | null
          satisfaction_pct: number | null
          service_type_id: number
          summary: string | null
          survey_id: number | null
          voc_negative: string | null
          voc_positive: string | null
        }
        Insert: {
          audio_file_path?: string | null
          created_at?: string
          customer_id: number
          document_path?: string | null
          id?: number
          interview_date?: string | null
          interview_type?: string | null
          interviewer?: string | null
          satisfaction_pct?: number | null
          service_type_id: number
          summary?: string | null
          survey_id?: number | null
          voc_negative?: string | null
          voc_positive?: string | null
        }
        Update: {
          audio_file_path?: string | null
          created_at?: string
          customer_id?: number
          document_path?: string | null
          id?: number
          interview_date?: string | null
          interview_type?: string | null
          interviewer?: string | null
          satisfaction_pct?: number | null
          service_type_id?: number
          summary?: string | null
          survey_id?: number | null
          voc_negative?: string | null
          voc_positive?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      mlops_alerts: {
        Row: {
          alert_type: string
          am_name: string | null
          category: string | null
          description: string | null
          detected_at: string | null
          expected_income: number | null
          id: number
          level: string | null
          place_id: string | null
          place_name: string | null
          raw_data: Json | null
          resolved: boolean | null
          resolved_at: string | null
          team_name: string | null
        }
        Insert: {
          alert_type: string
          am_name?: string | null
          category?: string | null
          description?: string | null
          detected_at?: string | null
          expected_income?: number | null
          id?: number
          level?: string | null
          place_id?: string | null
          place_name?: string | null
          raw_data?: Json | null
          resolved?: boolean | null
          resolved_at?: string | null
          team_name?: string | null
        }
        Update: {
          alert_type?: string
          am_name?: string | null
          category?: string | null
          description?: string | null
          detected_at?: string | null
          expected_income?: number | null
          id?: number
          level?: string | null
          place_id?: string | null
          place_name?: string | null
          raw_data?: Json | null
          resolved?: boolean | null
          resolved_at?: string | null
          team_name?: string | null
        }
        Relationships: []
      }
      mlops_classifier_config: {
        Row: {
          config_key: string
          config_value: Json
          id: number
          updated_at: string
          version: string | null
        }
        Insert: {
          config_key: string
          config_value: Json
          id?: number
          updated_at?: string
          version?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          id?: number
          updated_at?: string
          version?: string | null
        }
        Relationships: []
      }
      mlops_classifier_versions: {
        Row: {
          change_type: string
          changes: Json
          created_at: string
          etc_rate_after: number | null
          etc_rate_before: number | null
          feedback_id: number | null
          health_score_after: number | null
          health_score_before: number | null
          id: number
          notes: string | null
          triggered_by: string
          version: string
        }
        Insert: {
          change_type: string
          changes: Json
          created_at?: string
          etc_rate_after?: number | null
          etc_rate_before?: number | null
          feedback_id?: number | null
          health_score_after?: number | null
          health_score_before?: number | null
          id?: number
          notes?: string | null
          triggered_by: string
          version: string
        }
        Update: {
          change_type?: string
          changes?: Json
          created_at?: string
          etc_rate_after?: number | null
          etc_rate_before?: number | null
          feedback_id?: number | null
          health_score_after?: number | null
          health_score_before?: number | null
          id?: number
          notes?: string | null
          triggered_by?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "classifier_versions_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "mlops_pipeline_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      mlops_daily_corrections: {
        Row: {
          auto_rule_created: boolean | null
          correction_date: string
          correction_reason: string | null
          created_at: string
          evidence: Json | null
          id: number
          new_category: string | null
          new_confidence: string | null
          new_sub_category: string | null
          old_category: string | null
          old_confidence: string | null
          old_sub_category: string | null
          pattern_count: number | null
          source_id: number
          source_table: string
        }
        Insert: {
          auto_rule_created?: boolean | null
          correction_date?: string
          correction_reason?: string | null
          created_at?: string
          evidence?: Json | null
          id?: number
          new_category?: string | null
          new_confidence?: string | null
          new_sub_category?: string | null
          old_category?: string | null
          old_confidence?: string | null
          old_sub_category?: string | null
          pattern_count?: number | null
          source_id: number
          source_table: string
        }
        Update: {
          auto_rule_created?: boolean | null
          correction_date?: string
          correction_reason?: string | null
          created_at?: string
          evidence?: Json | null
          id?: number
          new_category?: string | null
          new_confidence?: string | null
          new_sub_category?: string | null
          old_category?: string | null
          old_confidence?: string | null
          old_sub_category?: string | null
          pattern_count?: number | null
          source_id?: number
          source_table?: string
        }
        Relationships: []
      }
      mlops_pipeline_feedback: {
        Row: {
          action: string
          applied_at: string | null
          applied_by: string | null
          category: string
          created_at: string
          data: Json | null
          feedback_type: string
          id: number
          rejection_reason: string | null
          source_period: string
          status: string
        }
        Insert: {
          action: string
          applied_at?: string | null
          applied_by?: string | null
          category: string
          created_at?: string
          data?: Json | null
          feedback_type: string
          id?: number
          rejection_reason?: string | null
          source_period: string
          status?: string
        }
        Update: {
          action?: string
          applied_at?: string | null
          applied_by?: string | null
          category?: string
          created_at?: string
          data?: Json | null
          feedback_type?: string
          id?: number
          rejection_reason?: string | null
          source_period?: string
          status?: string
        }
        Relationships: []
      }
      mlops_quality_metrics: {
        Row: {
          created_at: string | null
          etc_rate: number | null
          health_score: number | null
          id: number
          low_confidence_rate: number | null
          metric_date: string
          model_accuracy: Json | null
          new_keywords: string[] | null
          notes: string | null
          null_rate: Json | null
        }
        Insert: {
          created_at?: string | null
          etc_rate?: number | null
          health_score?: number | null
          id?: number
          low_confidence_rate?: number | null
          metric_date: string
          model_accuracy?: Json | null
          new_keywords?: string[] | null
          notes?: string | null
          null_rate?: Json | null
        }
        Update: {
          created_at?: string | null
          etc_rate?: number | null
          health_score?: number | null
          id?: number
          low_confidence_rate?: number | null
          metric_date?: string
          model_accuracy?: Json | null
          new_keywords?: string[] | null
          notes?: string | null
          null_rate?: Json | null
        }
        Relationships: []
      }
      monthly_reports: {
        Row: {
          created_at: string
          file_path: string | null
          id: number
          overall_score: number | null
          report_month: number
          report_year: number
          scores_json: string | null
          status: string
          title: string | null
          updated_at: string
          voc_summary: string | null
        }
        Insert: {
          created_at?: string
          file_path?: string | null
          id?: number
          overall_score?: number | null
          report_month: number
          report_year: number
          scores_json?: string | null
          status?: string
          title?: string | null
          updated_at: string
          voc_summary?: string | null
        }
        Update: {
          created_at?: string
          file_path?: string | null
          id?: number
          overall_score?: number | null
          report_month?: number
          report_year?: number
          scores_json?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          voc_summary?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          am_name: string | null
          bris_code: string | null
          created_at: string | null
          customer_id: number | null
          end_date: string | null
          id: string
          name: string
          notes: string | null
          project_type: string | null
          start_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          am_name?: string | null
          bris_code?: string | null
          created_at?: string | null
          customer_id?: number | null
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          project_type?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          am_name?: string | null
          bris_code?: string | null
          created_at?: string | null
          customer_id?: number | null
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          project_type?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      question_templates: {
        Row: {
          created_at: string
          id: number
          is_default: boolean
          questions_json: string
          service_type_id: number
          template_name: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_default?: boolean
          questions_json: string
          service_type_id: number
          template_name: string
        }
        Update: {
          created_at?: string
          id?: number
          is_default?: boolean
          questions_json?: string
          service_type_id?: number
          template_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_templates_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      respondent_cs_history: {
        Row: {
          course_name: string | null
          created_at: string | null
          customer_id: number | null
          id: string
          notes: string | null
          raw_company_name: string | null
          raw_position: string | null
          responded_month: string
          respondent_id: string
          source: string
        }
        Insert: {
          course_name?: string | null
          created_at?: string | null
          customer_id?: number | null
          id?: string
          notes?: string | null
          raw_company_name?: string | null
          raw_position?: string | null
          responded_month: string
          respondent_id: string
          source?: string
        }
        Update: {
          course_name?: string | null
          created_at?: string | null
          customer_id?: number | null
          id?: string
          notes?: string | null
          raw_company_name?: string | null
          raw_position?: string | null
          responded_month?: string
          respondent_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "respondent_cs_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respondent_cs_history_respondent_id_fkey"
            columns: ["respondent_id"]
            isOneToOne: false
            referencedRelation: "respondents"
            referencedColumns: ["id"]
          },
        ]
      }
      respondents: {
        Row: {
          created_at: string | null
          cs_contact_id: string | null
          customer_id: number | null
          department: string | null
          email: string | null
          id: string
          is_active: boolean | null
          last_cs_survey_sent_at: string | null
          name: string
          notes: string | null
          phone: string | null
          position: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          cs_contact_id?: string | null
          customer_id?: number | null
          department?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          last_cs_survey_sent_at?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          cs_contact_id?: string | null
          customer_id?: number | null
          department?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          last_cs_survey_sent_at?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "respondents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      response_answers: {
        Row: {
          answer_numeric: number | null
          answer_value: string | null
          created_at: string
          id: number
          question_id: number
          response_id: number
        }
        Insert: {
          answer_numeric?: number | null
          answer_value?: string | null
          created_at?: string
          id?: number
          question_id: number
          response_id: number
        }
        Update: {
          answer_numeric?: number | null
          answer_value?: string | null
          created_at?: string
          id?: number
          question_id?: number
          response_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "response_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
        ]
      }
      responses: {
        Row: {
          customer_id: number
          distribution_id: number | null
          id: number
          is_complete: boolean
          responded_at: string | null
          source: string
          survey_id: number
        }
        Insert: {
          customer_id: number
          distribution_id?: number | null
          id?: number
          is_complete?: boolean
          responded_at?: string | null
          source?: string
          survey_id: number
        }
        Update: {
          customer_id?: number
          distribution_id?: number | null
          id?: number
          is_complete?: boolean
          responded_at?: string | null
          source?: string
          survey_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "responses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      service_types: {
        Row: {
          created_at: string
          id: number
          is_active: boolean
          name: string
          name_en: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_active?: boolean
          name: string
          name_en: string
        }
        Update: {
          created_at?: string
          id?: number
          is_active?: boolean
          name?: string
          name_en?: string
        }
        Relationships: []
      }
      session_instructors: {
        Row: {
          id: string
          instructor_id: string
          module_name: string | null
          session_id: string
        }
        Insert: {
          id?: string
          instructor_id: string
          module_name?: string | null
          session_id: string
        }
        Update: {
          id?: string
          instructor_id?: string
          module_name?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_instructors_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_instructors_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          capacity: number | null
          course_id: string
          created_at: string | null
          end_date: string | null
          id: string
          im_name: string | null
          location: string | null
          name: string | null
          region: string | null
          session_number: number
          start_date: string | null
          status: string | null
          total_hours: number | null
          updated_at: string | null
        }
        Insert: {
          capacity?: number | null
          course_id: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          im_name?: string | null
          location?: string | null
          name?: string | null
          region?: string | null
          session_number: number
          start_date?: string | null
          status?: string | null
          total_hours?: number | null
          updated_at?: string | null
        }
        Update: {
          capacity?: number | null
          course_id?: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          im_name?: string | null
          location?: string | null
          name?: string | null
          region?: string | null
          session_number?: number
          start_date?: string | null
          status?: string | null
          total_hours?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_providers: {
        Row: {
          api_key: string | null
          api_user_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_default: boolean | null
          name: string
          provider_type: string
          sender_phone: string | null
          updated_at: string | null
        }
        Insert: {
          api_key?: string | null
          api_user_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          provider_type: string
          sender_phone?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key?: string | null
          api_user_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          provider_type?: string
          sender_phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sms_queue: {
        Row: {
          body_text: string
          created_at: string | null
          cs_dispatch_id: string | null
          distribution_id: string | null
          id: string
          last_error: string | null
          max_retries: number | null
          message_type: string | null
          provider_message_id: string | null
          recipient_name: string | null
          recipient_phone: string
          retry_count: number | null
          schedule_type: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          template_id: string | null
          trigger_rule: Json | null
        }
        Insert: {
          body_text: string
          created_at?: string | null
          cs_dispatch_id?: string | null
          distribution_id?: string | null
          id?: string
          last_error?: string | null
          max_retries?: number | null
          message_type?: string | null
          provider_message_id?: string | null
          recipient_name?: string | null
          recipient_phone: string
          retry_count?: number | null
          schedule_type?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
          trigger_rule?: Json | null
        }
        Update: {
          body_text?: string
          created_at?: string | null
          cs_dispatch_id?: string | null
          distribution_id?: string | null
          id?: string
          last_error?: string | null
          max_retries?: number | null
          message_type?: string | null
          provider_message_id?: string | null
          recipient_name?: string | null
          recipient_phone?: string
          retry_count?: number | null
          schedule_type?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
          trigger_rule?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_queue_cs_dispatch_id_fkey"
            columns: ["cs_dispatch_id"]
            isOneToOne: false
            referencedRelation: "cs_dispatch_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_queue_distribution_id_fkey"
            columns: ["distribution_id"]
            isOneToOne: false
            referencedRelation: "distributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sms_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          body_text: string
          created_at: string | null
          id: string
          is_default: boolean | null
          message_type: string | null
          name: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          body_text: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          message_type?: string | null
          name: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          body_text?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          message_type?: string | null
          name?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      survey_questions: {
        Row: {
          category: string | null
          id: number
          is_required: boolean
          options_json: string | null
          question_order: number
          question_text: string
          question_type: string
          survey_id: number
        }
        Insert: {
          category?: string | null
          id?: number
          is_required?: boolean
          options_json?: string | null
          question_order: number
          question_text: string
          question_type: string
          survey_id: number
        }
        Update: {
          category?: string | null
          id?: number
          is_required?: boolean
          options_json?: string | null
          question_order?: number
          question_text?: string
          question_type?: string
          survey_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          created_at: string
          description: string | null
          id: number
          internal_label: string | null
          service_type_id: number
          show_project_name: boolean
          status: string
          survey_month: number
          survey_year: number
          title: string
          training_month: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          internal_label?: string | null
          service_type_id: number
          show_project_name?: boolean
          status?: string
          survey_month: number
          survey_year: number
          title: string
          training_month?: number | null
          updated_at: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          internal_label?: string | null
          service_type_id?: number
          show_project_name?: boolean
          status?: string
          survey_month?: number
          survey_year?: number
          title?: string
          training_month?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "surveys_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      training_records: {
        Row: {
          customer_id: number
          has_training: boolean
          id: number
          notes: string | null
          service_type_id: number
          training_month: number
          training_name: string | null
          training_year: number
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          customer_id: number
          has_training: boolean
          id?: number
          notes?: string | null
          service_type_id: number
          training_month: number
          training_name?: string | null
          training_year: number
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          customer_id?: number
          has_training?: boolean
          id?: number
          notes?: string | null
          service_type_id?: number
          training_month?: number
          training_name?: string | null
          training_year?: number
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_records_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          department: Database["public"]["Enums"]["app_department"] | null
          display_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          department?: Database["public"]["Enums"]["app_department"] | null
          display_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          department?: Database["public"]["Enums"]["app_department"] | null
          display_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_cs_batch_dashboard: {
        Row: {
          batch_id: string | null
          batch_name: string | null
          batch_status: string | null
          completed_count: number | null
          confirmed_at: string | null
          created_at: string | null
          dispatched_count: number | null
          eligible_count: number | null
          excluded_count: number | null
          pending_count: number | null
          responded_count: number | null
          step1_done: number | null
          step2_done: number | null
          step3_done: number | null
          step4_done: number | null
          step5_done: number | null
          target_period_end: string | null
          target_period_start: string | null
          total_targets: number | null
        }
        Relationships: []
      }
      v_cs_bris_lineage_health: {
        Row: {
          contacts_orphan: number | null
          contacts_with_lineage: number | null
          courses_orphan: number | null
          courses_with_lineage: number | null
          projects_orphan: number | null
          projects_with_lineage: number | null
          raw_pages_total: number | null
          raw_records_total: number | null
        }
        Relationships: []
      }
      v_cs_cron_status: {
        Row: {
          active: boolean | null
          command: string | null
          jobname: string | null
          last_message: string | null
          last_run_at: string | null
          last_status: string | null
          schedule: string | null
        }
        Insert: {
          active?: boolean | null
          command?: string | null
          jobname?: string | null
          last_message?: never
          last_run_at?: never
          last_status?: never
          schedule?: string | null
        }
        Update: {
          active?: boolean | null
          command?: string | null
          jobname?: string | null
          last_message?: never
          last_run_at?: never
          last_status?: never
          schedule?: string | null
        }
        Relationships: []
      }
      v_cs_dispatch_summary: {
        Row: {
          batch_id: string | null
          batch_name: string | null
          batch_status: string | null
          failed_count: number | null
          opened_count: number | null
          pending_count: number | null
          responded_count: number | null
          response_rate: number | null
          sent_count: number | null
          skipped_count: number | null
          total_dispatched: number | null
        }
        Relationships: []
      }
      v_cs_project_overview: {
        Row: {
          actual_course_count: number | null
          all_courses_completed: boolean | null
          am_name: string | null
          am_team: string | null
          bris_code: string | null
          bris_project_id: string | null
          closed_at: string | null
          completed_course_count: number | null
          course_count: number | null
          deadline_date: string | null
          echo_enabled: boolean | null
          echo_exclude_reason: string | null
          execution_team: string | null
          external_instructors: string | null
          first_course_date: string | null
          id: string | null
          im_names: string | null
          internal_instructors: string | null
          last_course_date: string | null
          order_date: string | null
          project_name: string | null
          project_type: string | null
          status: string | null
          total_amount: number | null
        }
        Relationships: []
      }
      v_cs_system_health: {
        Row: {
          batches_in_progress: number | null
          email_queue_pending: number | null
          failed_dispatches_7d: number | null
          last_successful_sync: string | null
          sms_queue_pending: number | null
          stale_pending_dispatches: number | null
          sync_errors_7d: number | null
          syncs_running: number | null
        }
        Relationships: []
      }
      v_cs_target_candidates: {
        Row: {
          am_name: string | null
          am_team: string | null
          biz_reg_no: string | null
          bris_code: string | null
          bris_project_id: string | null
          business_id: string | null
          check_course_done: boolean | null
          check_is_last: boolean | null
          check_project_closed: boolean | null
          check_surveyed_within_6m: boolean | null
          company_name: string | null
          company_uuid: string | null
          contact_id: string | null
          contact_name: string | null
          course_completed: boolean | null
          course_end: string | null
          course_id: string | null
          course_name: string | null
          course_start: string | null
          customer_id: string | null
          department: string | null
          echo_enabled: boolean | null
          echo_status: string | null
          education_type: string | null
          email: string | null
          execution_team: string | null
          is_last_in_project: boolean | null
          last_survey_date: string | null
          mobile: string | null
          phone: string | null
          place_id: string | null
          place_name: string | null
          position: string | null
          program_name: string | null
          project_closed_at: string | null
          project_name: string | null
          project_status: string | null
          project_uuid: string | null
          survey_count_6m: number | null
        }
        Relationships: []
      }
      v_cs_target_detail: {
        Row: {
          am_name: string | null
          am_team: string | null
          batch_id: string | null
          batch_name: string | null
          bris_code: string | null
          company_name: string | null
          contact_name: string | null
          course_end: string | null
          course_name: string | null
          course_start: string | null
          current_step: number | null
          department: string | null
          echo_enabled: boolean | null
          echo_status: string | null
          education_type: string | null
          email: string | null
          exclusion_reason: string | null
          execution_team: string | null
          is_eligible: boolean | null
          mobile: string | null
          phone: string | null
          place_name: string | null
          position: string | null
          program_name: string | null
          project_name: string | null
          project_status: string | null
          step1_course_completed: boolean | null
          step2_last_course_confirmed: boolean | null
          step3_project_closed: boolean | null
          step4_history_checked: boolean | null
          step4_last_survey_date: string | null
          step4_within_6months: boolean | null
          step5_confirmed: boolean | null
          step5_confirmed_by: string | null
          target_id: string | null
          target_period_end: string | null
          target_period_start: string | null
          target_status: string | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_survey_targets_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "cs_target_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_survey_targets_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_cs_batch_dashboard"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "cs_survey_targets_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_cs_dispatch_summary"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      v_distribution_stats: {
        Row: {
          batch_id: string | null
          batch_title: string | null
          channel: string | null
          completed: number | null
          completion_rate: number | null
          created_at: string | null
          opened: number | null
          pending: number | null
          sent: number | null
          started: number | null
          survey_id: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "distribution_batches_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "edu_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_batches_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "v_edu_survey_stats"
            referencedColumns: ["survey_id"]
          },
        ]
      }
      v_edu_survey_stats: {
        Row: {
          capacity: number | null
          complete_count: number | null
          response_count: number | null
          response_rate: number | null
          session_id: string | null
          session_name: string | null
          survey_id: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edu_surveys_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      v_hrd_response_summary: {
        Row: {
          completed_count: number | null
          completion_rate: number | null
          in_progress_count: number | null
          invited_count: number | null
          large_enterprise_count: number | null
          medium_enterprise_count: number | null
          public_institution_count: number | null
          round_id: string | null
          round_number: number | null
          round_status: string | null
          school_count: number | null
          small_enterprise_count: number | null
          target_count: number | null
          title: string | null
          total_respondents: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_cs_sendable: { Args: { p_respondent_id: string }; Returns: boolean }
      distribution_aggregates_by_survey: {
        Args: { p_since?: string }
        Returns: {
          completed: number
          opened: number
          pending: number
          started: number
          survey_id: string
          total: number
        }[]
      }
      edu_submission_counts_by_survey: {
        Args: never
        Returns: {
          cnt: number
          survey_id: string
        }[]
      }
      fn_cs_create_batch_and_scan: {
        Args: {
          p_batch_name: string
          p_created_by?: string
          p_end: string
          p_start: string
        }
        Returns: {
          batch_id: string
          candidates_added: number
        }[]
      }
      fn_cs_cron_lineage_audit: { Args: never; Returns: Json }
      fn_cs_cron_raw_retention: {
        Args: { p_keep_days?: number }
        Returns: Json
      }
      fn_cs_cron_step4_recheck: { Args: never; Returns: Json }
      fn_cs_dispatch_batch: {
        Args: {
          p_batch_id: string
          p_channel: string
          p_survey_base_url: string
        }
        Returns: {
          dispatched: number
          errors: number
          skipped: number
        }[]
      }
      fn_cs_dispatch_event: {
        Args: { p_dispatch_id: string; p_event: string; p_score?: number }
        Returns: undefined
      }
      fn_cs_generate_survey_token: {
        Args: { p_target_id: string }
        Returns: string
      }
      fn_cs_post_sync_auto_batch: {
        Args: {
          p_period_end: string
          p_period_start: string
          p_sync_id: string
        }
        Returns: {
          batch_id: string
          candidates: number
        }[]
      }
      fn_cs_run_auto_screening: {
        Args: { p_batch_id: string }
        Returns: {
          checked: number
          excluded: number
          passed: number
          step: string
        }[]
      }
      fn_cs_step2_check_last_course: {
        Args: { p_batch_id: string }
        Returns: {
          checked: number
          excluded: number
          passed: number
        }[]
      }
      fn_cs_step3_check_project_closed: {
        Args: { p_batch_id: string }
        Returns: {
          checked: number
          excluded: number
          passed: number
        }[]
      }
      fn_cs_step4_check_survey_history: {
        Args: { p_batch_id: string }
        Returns: {
          checked: number
          excluded: number
          passed: number
        }[]
      }
      fn_cs_step5_confirm_targets: {
        Args: {
          p_batch_id: string
          p_confirmed_by?: string
          p_target_ids?: string[]
        }
        Returns: number
      }
      fn_cs_sync_finish: {
        Args: {
          p_error?: string
          p_fetched?: number
          p_new_companies?: number
          p_new_contacts?: number
          p_new_courses?: number
          p_new_projects?: number
          p_status: string
          p_sync_id: string
          p_upserted?: number
        }
        Returns: undefined
      }
      fn_cs_sync_start: {
        Args: { p_end: string; p_start: string }
        Returns: string
      }
      get_admin_sidebar_badges: {
        Args: never
        Returns: {
          active_surveys: number
          failed_emails: number
          recent_responses: number
        }[]
      }
      get_hrd_part_statistics: {
        Args: { p_round_id: string }
        Returns: {
          avg_score: number
          part_code: string
          part_id: string
          part_name: string
          response_count: number
          sort_order: number
        }[]
      }
      get_hrd_respondent_breakdown: {
        Args: { p_round_id: string }
        Returns: {
          cnt: number
          status: string
        }[]
      }
      get_hrd_respondent_summary: {
        Args: { p_round_id: string }
        Returns: {
          completed_count: number
          in_progress_count: number
          invited_count: number
          target_count: number
          total_count: number
        }[]
      }
      get_hrd_round_statistics: {
        Args: { p_round_id: string }
        Returns: {
          avg_score: number
          total_responses: number
          unique_items: number
          unique_respondents: number
        }[]
      }
      get_user_role: {
        Args: { p_user_id: string }
        Returns: {
          department: Database["public"]["Enums"]["app_department"]
          display_name: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
    }
    Enums: {
      app_department: "im" | "am" | "sales" | "marketing" | "consulting"
      app_role: "admin" | "creator" | "viewer"
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
      app_department: ["im", "am", "sales", "marketing", "consulting"],
      app_role: ["admin", "creator", "viewer"],
    },
  },
} as const
