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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          is_primary: boolean
          mime: string | null
          storage_path: string
          target_id: string
          target_type: Database["public"]["Enums"]["attach_target"]
          uploaded_by: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          is_primary?: boolean
          mime?: string | null
          storage_path: string
          target_id: string
          target_type: Database["public"]["Enums"]["attach_target"]
          uploaded_by?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          is_primary?: boolean
          mime?: string | null
          storage_path?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["attach_target"]
          uploaded_by?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          author_label: string
          created_at: string
          created_by: string | null
          id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["item_status"]
          target_id: string | null
          target_type: Database["public"]["Enums"]["item_target"]
          text: string
          vendor_id: string
        }
        Insert: {
          author_label?: string
          created_at?: string
          created_by?: string | null
          id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          target_id?: string | null
          target_type?: Database["public"]["Enums"]["item_target"]
          text: string
          vendor_id: string
        }
        Update: {
          author_label?: string
          created_at?: string
          created_by?: string | null
          id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          target_id?: string | null
          target_type?: Database["public"]["Enums"]["item_target"]
          text?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      job_revisions: {
        Row: {
          contract_amount: number
          created_at: string
          estimate_file_id: string | null
          id: string
          job_id: string
          note: string | null
        }
        Insert: {
          contract_amount: number
          created_at?: string
          estimate_file_id?: string | null
          id?: string
          job_id: string
          note?: string | null
        }
        Update: {
          contract_amount?: number
          created_at?: string
          estimate_file_id?: string | null
          id?: string
          job_id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_revisions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          approved_at: string | null
          contract_amount: number
          created_at: string
          estimate_no: string
          id: string
          scope: string | null
          sort_order: number
          status: Database["public"]["Enums"]["job_status"]
          title: string
          vendor_id: string
        }
        Insert: {
          approved_at?: string | null
          contract_amount?: number
          created_at?: string
          estimate_no: string
          id?: string
          scope?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          vendor_id: string
        }
        Update: {
          approved_at?: string | null
          contract_amount?: number
          created_at?: string
          estimate_no?: string
          id?: string
          scope?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount: number
          id: string
          invoice_ref: string | null
          job_id: string
          payment_id: string
        }
        Insert: {
          amount: number
          id?: string
          invoice_ref?: string | null
          job_id: string
          payment_id: string
        }
        Update: {
          amount?: number
          id?: string
          invoice_ref?: string | null
          job_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bank_ref: string
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          detail: string | null
          id: string
          kind: Database["public"]["Enums"]["payment_kind"]
          payment_no: number | null
          vendor_id: string
        }
        Insert: {
          amount: number
          bank_ref: string
          created_at?: string
          created_by?: string | null
          date: string
          description?: string | null
          detail?: string | null
          id?: string
          kind: Database["public"]["Enums"]["payment_kind"]
          payment_no?: number | null
          vendor_id: string
        }
        Update: {
          amount?: number
          bank_ref?: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          detail?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["payment_kind"]
          payment_no?: number | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_access: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string | null
          pin: string | null
          token: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string | null
          pin?: string | null
          token: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string | null
          pin?: string | null
          token?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_access_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          bank: Json
          contact_first_name: string | null
          created_at: string
          id: string
          initials: string | null
          legal_name: string | null
          name: string
          owner_id: string | null
          slug: string
          sort_order: number
          trade: string | null
        }
        Insert: {
          address?: string | null
          bank?: Json
          contact_first_name?: string | null
          created_at?: string
          id?: string
          initials?: string | null
          legal_name?: string | null
          name: string
          owner_id?: string | null
          slug: string
          sort_order?: number
          trade?: string | null
        }
        Update: {
          address?: string | null
          bank?: Json
          contact_first_name?: string | null
          created_at?: string
          id?: string
          initials?: string | null
          legal_name?: string | null
          name?: string
          owner_id?: string | null
          slug?: string
          sort_order?: number
          trade?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      attach_target: "payment" | "job" | "item"
      item_status: "open" | "resolved"
      item_target: "job" | "payment" | "general"
      job_status: "pending" | "confirmed" | "closed"
      payment_kind: "contract" | "bill"
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
      attach_target: ["payment", "job", "item"],
      item_status: ["open", "resolved"],
      item_target: ["job", "payment", "general"],
      job_status: ["pending", "confirmed", "closed"],
      payment_kind: ["contract", "bill"],
    },
  },
} as const
