export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      courses: {
        Row: {
          cover_image_path: string | null
          created_at: string
          description: string
          id: string
          location: string | null
          price_info: string | null
          published_at: string | null
          signup_url: string | null
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          cover_image_path?: string | null
          created_at?: string
          description: string
          id?: string
          location?: string | null
          price_info?: string | null
          published_at?: string | null
          signup_url?: string | null
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          cover_image_path?: string | null
          created_at?: string
          description?: string
          id?: string
          location?: string | null
          price_info?: string | null
          published_at?: string | null
          signup_url?: string | null
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      exercise_categories: {
        Row: {
          description: string | null
          icon: string | null
          id: string
          slug: string
          sort_order: number
          title: string
        }
        Insert: {
          description?: string | null
          icon?: string | null
          id?: string
          slug: string
          sort_order?: number
          title: string
        }
        Update: {
          description?: string | null
          icon?: string | null
          id?: string
          slug?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      exercise_phases: {
        Row: {
          cue_text: string | null
          duration_delta_per_round: number
          duration_seconds: number
          id: string
          is_open_ended: boolean
          kind: Database["public"]["Enums"]["phase_kind"]
          max_duration_seconds: number | null
          position: number
          step_id: string
        }
        Insert: {
          cue_text?: string | null
          duration_delta_per_round?: number
          duration_seconds?: number
          id?: string
          is_open_ended?: boolean
          kind: Database["public"]["Enums"]["phase_kind"]
          max_duration_seconds?: number | null
          position: number
          step_id: string
        }
        Update: {
          cue_text?: string | null
          duration_delta_per_round?: number
          duration_seconds?: number
          id?: string
          is_open_ended?: boolean
          kind?: Database["public"]["Enums"]["phase_kind"]
          max_duration_seconds?: number | null
          position?: number
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_phases_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "exercise_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_steps: {
        Row: {
          exercise_id: string
          id: string
          label: string | null
          position: number
          repeat_count: number
          rest_seconds: number
        }
        Insert: {
          exercise_id: string
          id?: string
          label?: string | null
          position: number
          repeat_count?: number
          rest_seconds?: number
        }
        Update: {
          exercise_id?: string
          id?: string
          label?: string | null
          position?: number
          repeat_count?: number
          rest_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "exercise_steps_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_steps_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "v_exercise_duration"
            referencedColumns: ["exercise_id"]
          },
        ]
      }
      exercises: {
        Row: {
          audio_path: string | null
          benefits_md: string | null
          category_id: string | null
          client_id: string | null
          contraindications_md: string | null
          cover_image_path: string | null
          created_at: string
          default_round_count: number | null
          deleted_at: string | null
          description_md: string | null
          difficulty: number | null
          effects: Database["public"]["Enums"]["exercise_effect"][]
          estimated_seconds: number | null
          has_metronome: boolean
          id: string
          is_published: boolean
          owner_id: string | null
          playback_mode: Database["public"]["Enums"]["playback_mode"]
          slug: string | null
          sort_order: number
          subtitle: string | null
          title: string
          type: Database["public"]["Enums"]["exercise_type"]
          updated_at: string
          video_external_id: string | null
          video_hash: string | null
          video_provider: string | null
          visibility: Database["public"]["Enums"]["visibility_level"]
        }
        Insert: {
          audio_path?: string | null
          benefits_md?: string | null
          category_id?: string | null
          client_id?: string | null
          contraindications_md?: string | null
          cover_image_path?: string | null
          created_at?: string
          default_round_count?: number | null
          deleted_at?: string | null
          description_md?: string | null
          difficulty?: number | null
          effects?: Database["public"]["Enums"]["exercise_effect"][]
          estimated_seconds?: number | null
          has_metronome?: boolean
          id?: string
          is_published?: boolean
          owner_id?: string | null
          playback_mode?: Database["public"]["Enums"]["playback_mode"]
          slug?: string | null
          sort_order?: number
          subtitle?: string | null
          title: string
          type: Database["public"]["Enums"]["exercise_type"]
          updated_at?: string
          video_external_id?: string | null
          video_hash?: string | null
          video_provider?: string | null
          visibility?: Database["public"]["Enums"]["visibility_level"]
        }
        Update: {
          audio_path?: string | null
          benefits_md?: string | null
          category_id?: string | null
          client_id?: string | null
          contraindications_md?: string | null
          cover_image_path?: string | null
          created_at?: string
          default_round_count?: number | null
          deleted_at?: string | null
          description_md?: string | null
          difficulty?: number | null
          effects?: Database["public"]["Enums"]["exercise_effect"][]
          estimated_seconds?: number | null
          has_metronome?: boolean
          id?: string
          is_published?: boolean
          owner_id?: string | null
          playback_mode?: Database["public"]["Enums"]["playback_mode"]
          slug?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string
          type?: Database["public"]["Enums"]["exercise_type"]
          updated_at?: string
          video_external_id?: string | null
          video_hash?: string | null
          video_provider?: string | null
          visibility?: Database["public"]["Enums"]["visibility_level"]
        }
        Relationships: [
          {
            foreignKeyName: "exercises_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "exercise_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      news_posts: {
        Row: {
          body_md: string
          category: Database["public"]["Enums"]["news_category"]
          cover_image_path: string | null
          created_at: string
          excerpt: string | null
          id: string
          is_pinned: boolean
          published_at: string | null
          slug: string
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility_level"]
        }
        Insert: {
          body_md: string
          category?: Database["public"]["Enums"]["news_category"]
          cover_image_path?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_pinned?: boolean
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility_level"]
        }
        Update: {
          body_md?: string
          category?: Database["public"]["Enums"]["news_category"]
          cover_image_path?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_pinned?: boolean
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility_level"]
        }
        Relationships: []
      }
      news_translations: {
        Row: {
          body_md: string
          excerpt: string | null
          locale: string
          post_id: string
          title: string
        }
        Insert: {
          body_md: string
          excerpt?: string | null
          locale: string
          post_id: string
          title: string
        }
        Update: {
          body_md?: string
          excerpt?: string | null
          locale?: string
          post_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_translations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "news_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          has_active_subscription: boolean
          id: string
          locale: string
          onboarding_completed_at: string | null
          plus_until: string | null
          registered_at: string
          sound_enabled: boolean
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          has_active_subscription?: boolean
          id: string
          locale?: string
          onboarding_completed_at?: string | null
          plus_until?: string | null
          registered_at?: string
          sound_enabled?: boolean
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          has_active_subscription?: boolean
          id?: string
          locale?: string
          onboarding_completed_at?: string | null
          plus_until?: string | null
          registered_at?: string
          sound_enabled?: boolean
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          bio: string | null
          created_at: string
          full_name: string
          id: string
          photo_path: string | null
          published_at: string | null
          role_title: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          full_name: string
          id?: string
          photo_path?: string | null
          published_at?: string | null
          role_title?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          full_name?: string
          id?: string
          photo_path?: string | null
          published_at?: string | null
          role_title?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_exercise_duration: {
        Row: {
          exercise_id: string | null
          total_seconds: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_plus_access: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      exercise_effect:
        | "co2_toleranz"
        | "entspannend"
        | "aktivierend"
        | "stressreduktion"
      exercise_type: "paced" | "general"
      habit_tracking_type: "number" | "smiley_5" | "slider_100" | "text"
      news_category: "praxis" | "blog" | "kurs" | "allgemein"
      phase_kind:
        | "inhale"
        | "hold_in"
        | "exhale"
        | "hold_out"
        | "free_breathing"
      playback_mode: "timer" | "audio_guided" | "audio_only"
      subscription_plan: "monthly" | "yearly"
      subscription_status:
        | "active"
        | "trialing"
        | "past_due"
        | "canceled"
        | "incomplete"
        | "expired"
      visibility_level: "free" | "registered" | "plus"
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
      exercise_effect: [
        "co2_toleranz",
        "entspannend",
        "aktivierend",
        "stressreduktion",
      ],
      exercise_type: ["paced", "general"],
      habit_tracking_type: ["number", "smiley_5", "slider_100", "text"],
      news_category: ["praxis", "blog", "kurs", "allgemein"],
      phase_kind: ["inhale", "hold_in", "exhale", "hold_out", "free_breathing"],
      playback_mode: ["timer", "audio_guided", "audio_only"],
      subscription_plan: ["monthly", "yearly"],
      subscription_status: [
        "active",
        "trialing",
        "past_due",
        "canceled",
        "incomplete",
        "expired",
      ],
      visibility_level: ["free", "registered", "plus"],
    },
  },
} as const

