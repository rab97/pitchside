export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      bookings: {
        Row: {
          cancel_deadline: string
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          facility_id: string
          field_id: string
          id: string
          member_id: string
          price_cents: number
          recurrence_id: string | null
          slot: unknown
          source: string
          status: string
        }
        Insert: {
          cancel_deadline: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          facility_id: string
          field_id: string
          id?: string
          member_id: string
          price_cents: number
          recurrence_id?: string | null
          slot: unknown
          source?: string
          status?: string
        }
        Update: {
          cancel_deadline?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          facility_id?: string
          field_id?: string
          id?: string
          member_id?: string
          price_cents?: number
          recurrence_id?: string | null
          slot?: unknown
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_recurrence_fk"
            columns: ["recurrence_id"]
            isOneToOne: false
            referencedRelation: "recurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      closures: {
        Row: {
          facility_id: string
          field_id: string | null
          id: string
          period: unknown
          reason: string | null
        }
        Insert: {
          facility_id: string
          field_id?: string | null
          id?: string
          period: unknown
          reason?: string | null
        }
        Update: {
          facility_id?: string
          field_id?: string | null
          id?: string
          period?: unknown
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "closures_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closures_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          address: string | null
          booking_horizon_days: number
          cancel_hours: number
          color: string
          created_at: string
          features: Json
          id: string
          min_duration_minutes: number
          name: string
          phone: string | null
          slot_minutes: number
          slug: string
        }
        Insert: {
          address?: string | null
          booking_horizon_days?: number
          cancel_hours?: number
          color?: string
          created_at?: string
          features?: Json
          id?: string
          min_duration_minutes?: number
          name: string
          phone?: string | null
          slot_minutes?: number
          slug: string
        }
        Update: {
          address?: string | null
          booking_horizon_days?: number
          cancel_hours?: number
          color?: string
          created_at?: string
          features?: Json
          id?: string
          min_duration_minutes?: number
          name?: string
          phone?: string | null
          slot_minutes?: number
          slug?: string
        }
        Relationships: []
      }
      facility_admins: {
        Row: {
          facility_id: string
          role: string
          user_id: string
        }
        Insert: {
          facility_id: string
          role?: string
          user_id: string
        }
        Update: {
          facility_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_admins_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_domains: {
        Row: {
          facility_id: string
          hostname: string
        }
        Insert: {
          facility_id: string
          hostname: string
        }
        Update: {
          facility_id?: string
          hostname?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_domains_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      fields: {
        Row: {
          active: boolean
          covered: boolean
          facility_id: string
          id: string
          kind: string
          name: string
          sort_order: number
          surface: string
        }
        Insert: {
          active?: boolean
          covered?: boolean
          facility_id: string
          id?: string
          kind: string
          name: string
          sort_order?: number
          surface?: string
        }
        Update: {
          active?: boolean
          covered?: boolean
          facility_id?: string
          id?: string
          kind?: string
          name?: string
          sort_order?: number
          surface?: string
        }
        Relationships: [
          {
            foreignKeyName: "fields_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string
          email: string | null
          facility_id: string
          honored_count: number
          id: string
          kind: string
          missed_count: number
          name: string
          notes: string | null
          phone: string | null
          price_list: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          facility_id: string
          honored_count?: number
          id?: string
          kind?: string
          missed_count?: number
          name: string
          notes?: string | null
          phone?: string | null
          price_list?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          facility_id?: string
          honored_count?: number
          id?: string
          kind?: string
          missed_count?: number
          name?: string
          notes?: string | null
          phone?: string | null
          price_list?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      price_bands: {
        Row: {
          ends_min: number
          facility_id: string
          field_id: string
          id: string
          price_cents: number
          starts_min: number
          weekdays: number[]
        }
        Insert: {
          ends_min: number
          facility_id: string
          field_id: string
          id?: string
          price_cents: number
          starts_min: number
          weekdays: number[]
        }
        Update: {
          ends_min?: number
          facility_id?: string
          field_id?: string
          id?: string
          price_cents?: number
          starts_min?: number
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "price_bands_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_bands_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
        ]
      }
      recurrences: {
        Row: {
          created_at: string
          duration_minutes: number
          facility_id: string
          field_id: string
          from_date: string
          id: string
          member_id: string
          start_min: number
          to_date: string
          weekday: number
        }
        Insert: {
          created_at?: string
          duration_minutes: number
          facility_id: string
          field_id: string
          from_date: string
          id?: string
          member_id: string
          start_min: number
          to_date: string
          weekday: number
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          facility_id?: string
          field_id?: string
          from_date?: string
          id?: string
          member_id?: string
          start_min?: number
          to_date?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurrences_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrences_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrences_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      busy_slots: {
        Row: {
          facility_id: string | null
          field_id: string | null
          slot: unknown
        }
        Insert: {
          facility_id?: string | null
          field_id?: string | null
          slot?: unknown
        }
        Update: {
          facility_id?: string | null
          field_id?: string | null
          slot?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "bookings_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calc_booking_price: {
        Args: { p_field_id: string; p_slot: unknown }
        Returns: number
      }
      cancel_booking: {
        Args: { p_booking_id: string; p_reason?: string }
        Returns: {
          cancel_deadline: string
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          facility_id: string
          field_id: string
          id: string
          member_id: string
          price_cents: number
          recurrence_id: string | null
          slot: unknown
          source: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_booking: {
        Args: {
          p_field_id: string
          p_member_id: string
          p_slot: unknown
          p_source?: string
        }
        Returns: {
          cancel_deadline: string
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          facility_id: string
          field_id: string
          id: string
          member_id: string
          price_cents: number
          recurrence_id: string | null
          slot: unknown
          source: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      find_members_by_phone: {
        Args: { p_phone: string }
        Returns: {
          created_at: string
          email: string | null
          facility_id: string
          honored_count: number
          id: string
          kind: string
          missed_count: number
          name: string
          notes: string | null
          phone: string | null
          price_list: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "members"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      generate_recurrence: {
        Args: { p_recurrence_id: string }
        Returns: {
          created: number
          skipped: number
          skipped_dates: string[]
        }[]
      }
      is_facility_admin: { Args: { p_facility: string }; Returns: boolean }
      member_reliability: {
        Args: { m: Database["public"]["Tables"]["members"]["Row"] }
        Returns: number
      }
      owns_member: { Args: { p_member_id: string }; Returns: boolean }
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

