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
      assessment_assignments: {
        Row: {
          assessment_id: string
          candidate_id: string
          completed_at: string | null
          created_at: string | null
          id: string
          score: number | null
          status: string | null
        }
        Insert: {
          assessment_id: string
          candidate_id: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          score?: number | null
          status?: string | null
        }
        Update: {
          assessment_id?: string
          candidate_id?: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          score?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_assignments_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_assignments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_questions: {
        Row: {
          assessment_id: string
          correct_answer: string
          created_at: string | null
          id: string
          options: Json
          points: number | null
          question_text: string
          question_type: string | null
        }
        Insert: {
          assessment_id: string
          correct_answer: string
          created_at?: string | null
          id?: string
          options: Json
          points?: number | null
          question_text: string
          question_type?: string | null
        }
        Update: {
          assessment_id?: string
          correct_answer?: string
          created_at?: string | null
          id?: string
          options?: Json
          points?: number | null
          question_text?: string
          question_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          candidates_assigned: number | null
          completion_rate: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          difficulty: string | null
          duration: number | null
          id: string
          pass_rate: number | null
          questions: number | null
          required_skills: string[] | null
          status: string | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          candidates_assigned?: number | null
          completion_rate?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          duration?: number | null
          id?: string
          pass_rate?: number | null
          questions?: number | null
          required_skills?: string[] | null
          status?: string | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          candidates_assigned?: number | null
          completion_rate?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          duration?: number | null
          id?: string
          pass_rate?: number | null
          questions?: number | null
          required_skills?: string[] | null
          status?: string | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          changed_by: string | null
          changed_by_role: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          new_value: Json | null
          notes: string | null
          old_value: Json | null
        }
        Insert: {
          action: string
          changed_by?: string | null
          changed_by_role?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          new_value?: Json | null
          notes?: string | null
          old_value?: Json | null
        }
        Update: {
          action?: string
          changed_by?: string | null
          changed_by_role?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_value?: Json | null
          notes?: string | null
          old_value?: Json | null
        }
        Relationships: []
      }
      candidate_assignments: {
        Row: {
          candidate_id: string
          created_at: string | null
          id: string
          notes: string | null
          review_completed_at: string | null
          status: string | null
          team_lead_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          review_completed_at?: string | null
          status?: string | null
          team_lead_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          review_completed_at?: string | null
          status?: string | null
          team_lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_assignments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_assignments_team_lead_id_fkey"
            columns: ["team_lead_id"]
            isOneToOne: false
            referencedRelation: "team_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          ai_analysis: string | null
          applied_date: string | null
          applied_role: string
          assessment_status: string | null
          assigned_team_lead_id: string | null
          ats_notes: string | null
          ai_score: number | null
          bgv_status: string | null
          created_at: string | null
          education: string | null
          education_details: string | null
          email: string
          experience: string | null
          id: string
          job_id: string | null
          last_employer_details: string | null
          last_status_change_at: string | null
          last_status_changed_by: string | null
          last_status_changed_by_role: string | null
          location: string | null
          match_percentage: number | null
          name: string
          phone: string | null
          pipeline_status: string | null
          resume_text: string | null
          resume_url: string | null
          review_notes: string | null
          salary_expectation: number | null
          skills: string[] | null
          status: string | null
          token_expiry: string | null
          updated_at: string | null
          upload_token: string | null
        }
        Insert: {
          ai_analysis?: string | null
          applied_date?: string | null
          applied_role: string
          assessment_status?: string | null
          assigned_team_lead_id?: string | null
          ats_notes?: string | null
          ai_score?: number | null
          bgv_status?: string | null
          created_at?: string | null
          education?: string | null
          education_details?: string | null
          email: string
          experience?: string | null
          id?: string
          job_id?: string | null
          last_employer_details?: string | null
          last_status_change_at?: string | null
          last_status_changed_by?: string | null
          last_status_changed_by_role?: string | null
          location?: string | null
          match_percentage?: number | null
          name: string
          phone?: string | null
          pipeline_status?: string | null
          resume_text?: string | null
          resume_url?: string | null
          review_notes?: string | null
          salary_expectation?: number | null
          skills?: string[] | null
          status?: string | null
          token_expiry?: string | null
          updated_at?: string | null
          upload_token?: string | null
        }
        Update: {
          ai_analysis?: string | null
          applied_date?: string | null
          applied_role?: string
          assessment_status?: string | null
          assigned_team_lead_id?: string | null
          ats_notes?: string | null
          ai_score?: number | null
          bgv_status?: string | null
          created_at?: string | null
          education?: string | null
          education_details?: string | null
          email?: string
          experience?: string | null
          id?: string
          job_id?: string | null
          last_employer_details?: string | null
          last_status_change_at?: string | null
          last_status_changed_by?: string | null
          last_status_changed_by_role?: string | null
          location?: string | null
          match_percentage?: number | null
          name?: string
          phone?: string | null
          pipeline_status?: string | null
          resume_text?: string | null
          resume_url?: string | null
          review_notes?: string | null
          salary_expectation?: number | null
          skills?: string[] | null
          status?: string | null
          token_expiry?: string | null
          updated_at?: string | null
          upload_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_assigned_team_lead_id_fkey"
            columns: ["assigned_team_lead_id"]
            isOneToOne: false
            referencedRelation: "team_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          department: string | null
          description: string | null
          employment_type: string | null
          id: string
          location: string | null
          openings: number
          organization_id: string
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          description?: string | null
          employment_type?: string | null
          id?: string
          location?: string | null
          openings?: number
          organization_id?: string
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          description?: string | null
          employment_type?: string | null
          id?: string
          location?: string | null
          openings?: number
          organization_id?: string
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bgv_verification_contacts: {
        Row: {
          candidate_id: string
          created_at: string | null
          hr_email: string | null
          id: string
          mail_status: string | null
          manager_email: string | null
          reference_email: string | null
          university_email: string | null
          updated_at: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string | null
          hr_email?: string | null
          id?: string
          mail_status?: string | null
          manager_email?: string | null
          reference_email?: string | null
          university_email?: string | null
          updated_at?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string | null
          hr_email?: string | null
          id?: string
          mail_status?: string | null
          manager_email?: string | null
          reference_email?: string | null
          university_email?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bgv_verification_contacts_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          candidate_id: string | null
          created_at: string
          department: string | null
          email: string
          id: string
          manager_id: string | null
          name: string
          phone: string | null
          role: string
          salary: number | null
          start_date: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          department?: string | null
          email: string
          id?: string
          manager_id?: string | null
          name: string
          phone?: string | null
          role: string
          salary?: number | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          department?: string | null
          email?: string
          id?: string
          manager_id?: string | null
          name?: string
          phone?: string | null
          role?: string
          salary?: number | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "team_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      filter_presets: {
        Row: {
          created_at: string | null
          created_by: string | null
          education_levels: string[] | null
          id: string
          is_active: boolean | null
          job_types: string[] | null
          location_preferences: string[] | null
          max_salary: number | null
          min_ats_score: number | null
          min_experience_years: number | null
          min_salary: number | null
          name: string
          required_skills: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          education_levels?: string[] | null
          id?: string
          is_active?: boolean | null
          job_types?: string[] | null
          location_preferences?: string[] | null
          max_salary?: number | null
          min_ats_score?: number | null
          min_experience_years?: number | null
          min_salary?: number | null
          name: string
          required_skills?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          education_levels?: string[] | null
          id?: string
          is_active?: boolean | null
          job_types?: string[] | null
          location_preferences?: string[] | null
          max_salary?: number | null
          min_ats_score?: number | null
          min_experience_years?: number | null
          min_salary?: number | null
          name?: string
          required_skills?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      google_form_responses: {
        Row: {
          created_at: string | null
          form_data: Json
          id: string
          processed: boolean | null
        }
        Insert: {
          created_at?: string | null
          form_data: Json
          id?: string
          processed?: boolean | null
        }
        Update: {
          created_at?: string | null
          form_data?: Json
          id?: string
          processed?: boolean | null
        }
        Relationships: []
      }
      hr_settings: {
        Row: {
          created_at: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      hr_users: {
        Row: {
          created_at: string | null
          email: string
          gemini_api_key: string | null
          google_access_token: string | null
          google_calendar_connected: boolean | null
          google_refresh_token: string | null
          google_token_expires_at: string | null
          id: string
          name: string
          openai_api_key: string | null
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          gemini_api_key?: string | null
          google_access_token?: string | null
          google_calendar_connected?: boolean | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          id?: string
          name: string
          openai_api_key?: string | null
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          gemini_api_key?: string | null
          google_access_token?: string | null
          google_calendar_connected?: boolean | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          id?: string
          name?: string
          openai_api_key?: string | null
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_schedule: {
        Row: {
          calendar_event_id: string | null
          candidate_id: string
          created_at: string | null
          duration_minutes: number | null
          id: string
          interview_date: string
          interview_type: string
          interviewer: string | null
          interviewer_email: string | null
          meeting_link: string | null
          notes: string | null
          scheduled_time: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          calendar_event_id?: string | null
          candidate_id: string
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          interview_date: string
          interview_type: string
          interviewer?: string | null
          interviewer_email?: string | null
          meeting_link?: string | null
          notes?: string | null
          scheduled_time?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          calendar_event_id?: string | null
          candidate_id?: string
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          interview_date?: string
          interview_type?: string
          interviewer?: string | null
          interviewer_email?: string | null
          meeting_link?: string | null
          notes?: string | null
          scheduled_time?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_schedule_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      role_thresholds: {
        Row: {
          auto_shortlist: boolean | null
          created_at: string | null
          id: string
          is_active: boolean | null
          max_ats_score: number | null
          min_assessment_score: number | null
          min_ats_score: number | null
          min_score: number
          role_name: string
          team_lead_id: string | null
          updated_at: string | null
        }
        Insert: {
          auto_shortlist?: boolean | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_ats_score?: number | null
          min_assessment_score?: number | null
          min_ats_score?: number | null
          min_score: number
          role_name: string
          team_lead_id?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_shortlist?: boolean | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_ats_score?: number | null
          min_assessment_score?: number | null
          min_ats_score?: number | null
          min_score?: number
          role_name?: string
          team_lead_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_thresholds_team_lead_id_fkey"
            columns: ["team_lead_id"]
            isOneToOne: false
            referencedRelation: "team_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      team_leads: {
        Row: {
          created_at: string | null
          department: string
          email: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          department: string
          email: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          department?: string
          email?: string
          id?: string
          name?: string
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "hr" | "team_lead"
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
      app_role: ["admin", "hr", "team_lead"],
    },
  },
} as const
