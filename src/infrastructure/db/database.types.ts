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
      asset_assignments: {
        Row: {
          asset_id: string
          assigned_at: string
          assignment_type: string
          created_at: string
          expedition_id: string | null
          id: string
          notes: string | null
          released_at: string | null
          station_id: string | null
          updated_at: string
        }
        Insert: {
          asset_id: string
          assigned_at: string
          assignment_type: string
          created_at?: string
          expedition_id?: string | null
          id?: string
          notes?: string | null
          released_at?: string | null
          station_id?: string | null
          updated_at?: string
        }
        Update: {
          asset_id?: string
          assigned_at?: string
          assignment_type?: string
          created_at?: string
          expedition_id?: string | null
          id?: string
          notes?: string | null
          released_at?: string | null
          station_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_assignments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignments_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignments_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_code: string
          category: string
          commissioned_at: string | null
          condition: Database["public"]["Enums"]["asset_condition"]
          created_at: string
          criticality: Database["public"]["Enums"]["criticality_level"]
          data_classification: Database["public"]["Enums"]["data_classification"]
          id: string
          last_maintenance_at: string | null
          manufacturer: string | null
          model: string | null
          name: string
          next_maintenance_at: string | null
          station_id: string | null
          status: Database["public"]["Enums"]["asset_status"]
          type: string | null
          updated_at: string
        }
        Insert: {
          asset_code: string
          category: string
          commissioned_at?: string | null
          condition?: Database["public"]["Enums"]["asset_condition"]
          created_at?: string
          criticality?: Database["public"]["Enums"]["criticality_level"]
          data_classification?: Database["public"]["Enums"]["data_classification"]
          id?: string
          last_maintenance_at?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          next_maintenance_at?: string | null
          station_id?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          type?: string | null
          updated_at?: string
        }
        Update: {
          asset_code?: string
          category?: string
          commissioned_at?: string | null
          condition?: Database["public"]["Enums"]["asset_condition"]
          created_at?: string
          criticality?: Database["public"]["Enums"]["criticality_level"]
          data_classification?: Database["public"]["Enums"]["data_classification"]
          id?: string
          last_maintenance_at?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          next_maintenance_at?: string | null
          station_id?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      data_sources: {
        Row: {
          access_method: string | null
          active: boolean
          attribution_text: string | null
          base_url: string | null
          created_at: string
          dataset_name: string | null
          dataset_version: string | null
          description: string | null
          id: string
          license_name: string | null
          name: string
          provider: string
          source_type: string | null
          updated_at: string
        }
        Insert: {
          access_method?: string | null
          active?: boolean
          attribution_text?: string | null
          base_url?: string | null
          created_at?: string
          dataset_name?: string | null
          dataset_version?: string | null
          description?: string | null
          id?: string
          license_name?: string | null
          name: string
          provider: string
          source_type?: string | null
          updated_at?: string
        }
        Update: {
          access_method?: string | null
          active?: boolean
          attribution_text?: string | null
          base_url?: string | null
          created_at?: string
          dataset_name?: string | null
          dataset_version?: string | null
          description?: string | null
          id?: string
          license_name?: string | null
          name?: string
          provider?: string
          source_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expedition_members: {
        Row: {
          assignment_role: string
          created_at: string
          expedition_id: string
          id: string
          joined_at: string
          left_at: string | null
          person_id: string
          updated_at: string
        }
        Insert: {
          assignment_role: string
          created_at?: string
          expedition_id: string
          id?: string
          joined_at: string
          left_at?: string | null
          person_id: string
          updated_at?: string
        }
        Update: {
          assignment_role?: string
          created_at?: string
          expedition_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          person_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expedition_members_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expedition_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      expeditions: {
        Row: {
          actual_end_at: string | null
          actual_start_at: string | null
          code: string
          created_at: string
          data_classification: Database["public"]["Enums"]["data_classification"]
          description: string | null
          destination_station_id: string
          id: string
          name: string
          origin_station_id: string | null
          planned_end_at: string
          planned_start_at: string
          status: Database["public"]["Enums"]["expedition_status"]
          updated_at: string
        }
        Insert: {
          actual_end_at?: string | null
          actual_start_at?: string | null
          code: string
          created_at?: string
          data_classification?: Database["public"]["Enums"]["data_classification"]
          description?: string | null
          destination_station_id: string
          id?: string
          name: string
          origin_station_id?: string | null
          planned_end_at: string
          planned_start_at: string
          status?: Database["public"]["Enums"]["expedition_status"]
          updated_at?: string
        }
        Update: {
          actual_end_at?: string | null
          actual_start_at?: string | null
          code?: string
          created_at?: string
          data_classification?: Database["public"]["Enums"]["data_classification"]
          description?: string | null
          destination_station_id?: string
          id?: string
          name?: string
          origin_station_id?: string | null
          planned_end_at?: string
          planned_start_at?: string
          status?: Database["public"]["Enums"]["expedition_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expeditions_destination_station_id_fkey"
            columns: ["destination_station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expeditions_origin_station_id_fkey"
            columns: ["origin_station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          active: boolean
          category: string
          created_at: string
          criticality: Database["public"]["Enums"]["criticality_level"]
          current_quantity: number
          daily_consumption_rate: number
          data_classification: Database["public"]["Enums"]["data_classification"]
          id: string
          minimum_threshold: number
          name: string
          safety_stock: number
          sku: string
          station_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          criticality?: Database["public"]["Enums"]["criticality_level"]
          current_quantity?: number
          daily_consumption_rate?: number
          data_classification?: Database["public"]["Enums"]["data_classification"]
          id?: string
          minimum_threshold?: number
          name: string
          safety_stock?: number
          sku: string
          station_id: string
          unit: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          criticality?: Database["public"]["Enums"]["criticality_level"]
          current_quantity?: number
          daily_consumption_rate?: number
          data_classification?: Database["public"]["Enums"]["data_classification"]
          id?: string
          minimum_threshold?: number
          name?: string
          safety_stock?: number
          sku?: string
          station_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          inventory_item_id: string
          notes: string | null
          occurred_at: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          transaction_type: Database["public"]["Enums"]["inventory_transaction_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id: string
          notes?: string | null
          occurred_at?: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          transaction_type: Database["public"]["Enums"]["inventory_transaction_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id?: string
          notes?: string | null
          occurred_at?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          transaction_type?: Database["public"]["Enums"]["inventory_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_records: {
        Row: {
          asset_id: string
          completed_at: string | null
          cost: number | null
          created_at: string
          description: string | null
          id: string
          maintenance_type: string
          notes: string | null
          performed_by: string | null
          scheduled_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          updated_at: string
        }
        Insert: {
          asset_id: string
          completed_at?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          maintenance_type: string
          notes?: string | null
          performed_by?: string | null
          scheduled_at: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          updated_at?: string
        }
        Update: {
          asset_id?: string
          completed_at?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          maintenance_type?: string
          notes?: string | null
          performed_by?: string | null
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      persons: {
        Row: {
          active: boolean
          auth_user_id: string | null
          created_at: string
          display_name: string
          id: string
          organization: string | null
          role_title: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          display_name: string
          id?: string
          organization?: string | null
          role_title?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          display_name?: string
          id?: string
          organization?: string | null
          role_title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stations: {
        Row: {
          capacity: number | null
          code: string
          country: string | null
          created_at: string
          elevation_m: number | null
          id: string
          latitude: number
          longitude: number
          metadata: Json | null
          name: string
          region: string | null
          source_id: string | null
          source_reference: string | null
          status: Database["public"]["Enums"]["station_status"]
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          code: string
          country?: string | null
          created_at?: string
          elevation_m?: number | null
          id?: string
          latitude: number
          longitude: number
          metadata?: Json | null
          name: string
          region?: string | null
          source_id?: string | null
          source_reference?: string | null
          status?: Database["public"]["Enums"]["station_status"]
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          code?: string
          country?: string | null
          created_at?: string
          elevation_m?: number | null
          id?: string
          latitude?: number
          longitude?: number
          metadata?: Json | null
          name?: string
          region?: string | null
          source_id?: string | null
          source_reference?: string | null
          status?: Database["public"]["Enums"]["station_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stations_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      asset_condition: "EXCELLENT" | "GOOD" | "ATTENTION_REQUIRED" | "CRITICAL"
      asset_status:
        | "AVAILABLE"
        | "ASSIGNED"
        | "IN_USE"
        | "MAINTENANCE"
        | "DAMAGED"
        | "RETIRED"
      criticality_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
      data_classification:
        | "AUTHORITATIVE_REAL"
        | "EXTERNAL_REAL"
        | "SIMULATED"
        | "DERIVED"
      expedition_status:
        | "DRAFT"
        | "PLANNED"
        | "ACTIVE"
        | "COMPLETED"
        | "CANCELLED"
        | "ARCHIVED"
      inventory_transaction_type:
        | "RECEIPT"
        | "RESTOCK"
        | "CONSUMPTION"
        | "TRANSFER_IN"
        | "TRANSFER_OUT"
        | "ADJUSTMENT"
        | "DAMAGE_LOSS"
        | "EXPIRY"
      maintenance_status:
        | "SCHEDULED"
        | "IN_PROGRESS"
        | "COMPLETED"
        | "CANCELLED"
      station_status: "ACTIVE" | "INACTIVE" | "HISTORICAL"
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
    Enums: {
      asset_condition: ["EXCELLENT", "GOOD", "ATTENTION_REQUIRED", "CRITICAL"],
      asset_status: [
        "AVAILABLE",
        "ASSIGNED",
        "IN_USE",
        "MAINTENANCE",
        "DAMAGED",
        "RETIRED",
      ],
      criticality_level: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      data_classification: [
        "AUTHORITATIVE_REAL",
        "EXTERNAL_REAL",
        "SIMULATED",
        "DERIVED",
      ],
      expedition_status: [
        "DRAFT",
        "PLANNED",
        "ACTIVE",
        "COMPLETED",
        "CANCELLED",
        "ARCHIVED",
      ],
      inventory_transaction_type: [
        "RECEIPT",
        "RESTOCK",
        "CONSUMPTION",
        "TRANSFER_IN",
        "TRANSFER_OUT",
        "ADJUSTMENT",
        "DAMAGE_LOSS",
        "EXPIRY",
      ],
      maintenance_status: [
        "SCHEDULED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ],
      station_status: ["ACTIVE", "INACTIVE", "HISTORICAL"],
    },
  },
} as const
