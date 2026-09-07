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
      cargo_containers: {
        Row: {
          container_id: string
          container_type: Database["public"]["Enums"]["cargo_container_type"]
          created_at: string
          delivered_at: string | null
          destination_station_id: string | null
          expedition_id: string | null
          id: string
          manifest_description: string
          payload_weight_kg: number
          priority: string
          shipped_at: string | null
          tare_weight_kg: number
          transit_stage: Database["public"]["Enums"]["logistics_transit_stage"]
          updated_at: string
          vessel_name: string | null
          voyage_number: string | null
        }
        Insert: {
          container_id: string
          container_type?: Database["public"]["Enums"]["cargo_container_type"]
          created_at?: string
          delivered_at?: string | null
          destination_station_id?: string | null
          expedition_id?: string | null
          id?: string
          manifest_description: string
          payload_weight_kg: number
          priority?: string
          shipped_at?: string | null
          tare_weight_kg?: number
          transit_stage?: Database["public"]["Enums"]["logistics_transit_stage"]
          updated_at?: string
          vessel_name?: string | null
          voyage_number?: string | null
        }
        Update: {
          container_id?: string
          container_type?: Database["public"]["Enums"]["cargo_container_type"]
          created_at?: string
          delivered_at?: string | null
          destination_station_id?: string | null
          expedition_id?: string | null
          id?: string
          manifest_description?: string
          payload_weight_kg?: number
          priority?: string
          shipped_at?: string | null
          tare_weight_kg?: number
          transit_stage?: Database["public"]["Enums"]["logistics_transit_stage"]
          updated_at?: string
          vessel_name?: string | null
          voyage_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cargo_containers_destination_station_id_fkey"
            columns: ["destination_station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_containers_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sitreps: {
        Row: {
          commander_name: string
          created_at: string
          fuel_consumed_24h_liters: number
          generator_runtime_hours: number
          id: string
          integrity_hash: string
          max_temp_c: number | null
          min_temp_c: number | null
          operational_remarks: string | null
          outdoor_status: Database["public"]["Enums"]["outdoor_clearance_status"]
          peak_wind_kmh: number | null
          pressure_hpa: number | null
          pressure_trend_6h: number | null
          report_date: string
          signed_off_at: string
          signer_identity: string
          station_id: string
          submitted_by: string | null
          summer_science_headcount: number
          transient_headcount: number
          winter_over_headcount: number
        }
        Insert: {
          commander_name: string
          created_at?: string
          fuel_consumed_24h_liters?: number
          generator_runtime_hours?: number
          id?: string
          integrity_hash: string
          max_temp_c?: number | null
          min_temp_c?: number | null
          operational_remarks?: string | null
          outdoor_status?: Database["public"]["Enums"]["outdoor_clearance_status"]
          peak_wind_kmh?: number | null
          pressure_hpa?: number | null
          pressure_trend_6h?: number | null
          report_date: string
          signed_off_at?: string
          signer_identity?: string
          station_id: string
          submitted_by?: string | null
          summer_science_headcount?: number
          transient_headcount?: number
          winter_over_headcount?: number
        }
        Update: {
          commander_name?: string
          created_at?: string
          fuel_consumed_24h_liters?: number
          generator_runtime_hours?: number
          id?: string
          integrity_hash?: string
          max_temp_c?: number | null
          min_temp_c?: number | null
          operational_remarks?: string | null
          outdoor_status?: Database["public"]["Enums"]["outdoor_clearance_status"]
          peak_wind_kmh?: number | null
          pressure_hpa?: number | null
          pressure_trend_6h?: number | null
          report_date?: string
          signed_off_at?: string
          signer_identity?: string
          station_id?: string
          submitted_by?: string | null
          summer_science_headcount?: number
          transient_headcount?: number
          winter_over_headcount?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_sitreps_station_id_fkey"
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
      gateway_credentials: {
        Row: {
          created_at: string
          gateway_id: string
          id: string
          is_active: boolean
          key_hash: string
          last_seen_at: string | null
          name: string
          revoked_at: string | null
          station_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gateway_id: string
          id?: string
          is_active?: boolean
          key_hash: string
          last_seen_at?: string | null
          name: string
          revoked_at?: string | null
          station_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gateway_id?: string
          id?: string
          is_active?: boolean
          key_hash?: string
          last_seen_at?: string | null
          name?: string
          revoked_at?: string | null
          station_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_credentials_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      hardware_devices: {
        Row: {
          created_at: string
          description: string | null
          device_code: string
          gateway_id: string
          id: string
          is_active: boolean
          name: string
          polling_interval_sec: number
          protocol: Database["public"]["Enums"]["hardware_protocol"]
          station_id: string
          target_asset_id: string | null
          target_tank_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          device_code: string
          gateway_id: string
          id?: string
          is_active?: boolean
          name: string
          polling_interval_sec?: number
          protocol?: Database["public"]["Enums"]["hardware_protocol"]
          station_id: string
          target_asset_id?: string | null
          target_tank_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          device_code?: string
          gateway_id?: string
          id?: string
          is_active?: boolean
          name?: string
          polling_interval_sec?: number
          protocol?: Database["public"]["Enums"]["hardware_protocol"]
          station_id?: string
          target_asset_id?: string | null
          target_tank_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hardware_devices_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "gateway_credentials"
            referencedColumns: ["gateway_id"]
          },
          {
            foreignKeyName: "hardware_devices_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hardware_devices_target_asset_id_fkey"
            columns: ["target_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hardware_devices_target_tank_id_fkey"
            columns: ["target_tank_id"]
            isOneToOne: false
            referencedRelation: "station_fuel_tanks"
            referencedColumns: ["id"]
          },
        ]
      }
      hardware_telemetry_history: {
        Row: {
          boot_session_id: string
          classification: Database["public"]["Enums"]["telemetry_classification"]
          created_at: string
          device_id: string
          event_id: string
          gateway_id: string
          id: string
          metric: string
          observed_at: string
          quality: Database["public"]["Enums"]["telemetry_quality"]
          raw_payload: Json | null
          received_at: string
          sequence_number: number
          source: Database["public"]["Enums"]["telemetry_source"]
          unit: string
          value: number
        }
        Insert: {
          boot_session_id?: string
          classification?: Database["public"]["Enums"]["telemetry_classification"]
          created_at?: string
          device_id: string
          event_id: string
          gateway_id: string
          id?: string
          metric: string
          observed_at: string
          quality?: Database["public"]["Enums"]["telemetry_quality"]
          raw_payload?: Json | null
          received_at?: string
          sequence_number: number
          source?: Database["public"]["Enums"]["telemetry_source"]
          unit: string
          value: number
        }
        Update: {
          boot_session_id?: string
          classification?: Database["public"]["Enums"]["telemetry_classification"]
          created_at?: string
          device_id?: string
          event_id?: string
          gateway_id?: string
          id?: string
          metric?: string
          observed_at?: string
          quality?: Database["public"]["Enums"]["telemetry_quality"]
          raw_payload?: Json | null
          received_at?: string
          sequence_number?: number
          source?: Database["public"]["Enums"]["telemetry_source"]
          unit?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "hardware_telemetry_history_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "hardware_devices"
            referencedColumns: ["device_code"]
          },
          {
            foreignKeyName: "hardware_telemetry_history_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "gateway_credentials"
            referencedColumns: ["gateway_id"]
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
      notification_deliveries: {
        Row: {
          alert_id: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          delivered_at: string
          delivery_status: Database["public"]["Enums"]["delivery_status"]
          external_reference_id: string | null
          failure_reason: string | null
          id: string
          outbox_id: string
          recipient: string
        }
        Insert: {
          alert_id?: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          delivered_at?: string
          delivery_status: Database["public"]["Enums"]["delivery_status"]
          external_reference_id?: string | null
          failure_reason?: string | null
          id?: string
          outbox_id: string
          recipient: string
        }
        Update: {
          alert_id?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          delivered_at?: string
          delivery_status?: Database["public"]["Enums"]["delivery_status"]
          external_reference_id?: string | null
          failure_reason?: string | null
          id?: string
          outbox_id?: string
          recipient?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "operational_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "notification_outbox"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          alert_id: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          last_error: string | null
          max_retries: number
          next_retry_at: string
          payload: Json
          recipient: string
          retry_count: number
          status: Database["public"]["Enums"]["outbox_status"]
          subject: string | null
          updated_at: string
        }
        Insert: {
          alert_id?: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          last_error?: string | null
          max_retries?: number
          next_retry_at?: string
          payload: Json
          recipient: string
          retry_count?: number
          status?: Database["public"]["Enums"]["outbox_status"]
          subject?: string | null
          updated_at?: string
        }
        Update: {
          alert_id?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          last_error?: string | null
          max_retries?: number
          next_retry_at?: string
          payload?: Json
          recipient?: string
          retry_count?: number
          status?: Database["public"]["Enums"]["outbox_status"]
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "operational_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      offline_sync_idempotency: {
        Row: {
          action_type: string
          created_at: string
          idempotency_key: string
          request_hash: string
          response_payload: Json
          status: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          idempotency_key: string
          request_hash: string
          response_payload: Json
          status?: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          idempotency_key?: string
          request_hash?: string
          response_payload?: Json
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      operational_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          category: string
          created_at: string
          details: string
          id: string
          resolved_at: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          station_id: string | null
          status: Database["public"]["Enums"]["alert_status"]
          title: string
          triggered_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          category: string
          created_at?: string
          details: string
          id?: string
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          station_id?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          title: string
          triggered_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          category?: string
          created_at?: string
          details?: string
          id?: string
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          station_id?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          title?: string
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_alerts_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
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
      profiles: {
        Row: {
          active: boolean
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          is_active: boolean
          p256dh: string
          station_id: string | null
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean
          p256dh: string
          station_id?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean
          p256dh?: string
          station_id?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_incidents: {
        Row: {
          actions_taken: string
          created_at: string
          description: string
          id: string
          incident_type: Database["public"]["Enums"]["incident_type"]
          occurred_at: string
          reported_by: string
          resolution_status: string
          severity: Database["public"]["Enums"]["alert_severity"]
          station_id: string | null
        }
        Insert: {
          actions_taken: string
          created_at?: string
          description: string
          id?: string
          incident_type: Database["public"]["Enums"]["incident_type"]
          occurred_at?: string
          reported_by: string
          resolution_status?: string
          severity: Database["public"]["Enums"]["alert_severity"]
          station_id?: string | null
        }
        Update: {
          actions_taken?: string
          created_at?: string
          description?: string
          id?: string
          incident_type?: Database["public"]["Enums"]["incident_type"]
          occurred_at?: string
          reported_by?: string
          resolution_status?: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          station_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_incidents_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      station_fuel_tanks: {
        Row: {
          capacity_liters: number
          created_at: string
          current_level_liters: number
          daily_burn_rate_liters: number
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          id: string
          last_dip_reading_at: string
          station_id: string
          tank_code: string
          tank_name: string
          tank_type: Database["public"]["Enums"]["tank_type"]
          updated_at: string
        }
        Insert: {
          capacity_liters: number
          created_at?: string
          current_level_liters: number
          daily_burn_rate_liters?: number
          fuel_type?: Database["public"]["Enums"]["fuel_type"]
          id?: string
          last_dip_reading_at?: string
          station_id: string
          tank_code: string
          tank_name: string
          tank_type?: Database["public"]["Enums"]["tank_type"]
          updated_at?: string
        }
        Update: {
          capacity_liters?: number
          created_at?: string
          current_level_liters?: number
          daily_burn_rate_liters?: number
          fuel_type?: Database["public"]["Enums"]["fuel_type"]
          id?: string
          last_dip_reading_at?: string
          station_id?: string
          tank_code?: string
          tank_name?: string
          tank_type?: Database["public"]["Enums"]["tank_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_fuel_tanks_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
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
      traverse_checkins: {
        Row: {
          ambient_temp_c: number | null
          checkin_at: string
          comms_status: Database["public"]["Enums"]["comms_status"]
          created_at: string
          hazard_assessment_notes: string | null
          id: string
          latitude: number
          longitude: number
          mission_id: string
          operational_status: string
          recorded_by: string | null
          remaining_fuel_liters: number | null
          waypoint_code: string
        }
        Insert: {
          ambient_temp_c?: number | null
          checkin_at?: string
          comms_status?: Database["public"]["Enums"]["comms_status"]
          created_at?: string
          hazard_assessment_notes?: string | null
          id?: string
          latitude: number
          longitude: number
          mission_id: string
          operational_status?: string
          recorded_by?: string | null
          remaining_fuel_liters?: number | null
          waypoint_code: string
        }
        Update: {
          ambient_temp_c?: number | null
          checkin_at?: string
          comms_status?: Database["public"]["Enums"]["comms_status"]
          created_at?: string
          hazard_assessment_notes?: string | null
          id?: string
          latitude?: number
          longitude?: number
          mission_id?: string
          operational_status?: string
          recorded_by?: string | null
          remaining_fuel_liters?: number | null
          waypoint_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "traverse_checkins_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "traverse_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      traverse_missions: {
        Row: {
          aborted_at: string | null
          actual_departure_at: string | null
          cancelled_at: string | null
          checkin_interval_hours: number
          completed_at: string | null
          corridor_id: string
          created_at: string
          created_by: string | null
          destination_station_id: string | null
          expedition_id: string
          id: string
          lead_asset_id: string
          lead_person_id: string
          mission_code: string
          operational_notes: string | null
          origin_station_id: string
          scheduled_departure_at: string
          status: Database["public"]["Enums"]["traverse_mission_status"]
          title: string
          updated_at: string
        }
        Insert: {
          aborted_at?: string | null
          actual_departure_at?: string | null
          cancelled_at?: string | null
          checkin_interval_hours?: number
          completed_at?: string | null
          corridor_id: string
          created_at?: string
          created_by?: string | null
          destination_station_id?: string | null
          expedition_id: string
          id?: string
          lead_asset_id: string
          lead_person_id: string
          mission_code: string
          operational_notes?: string | null
          origin_station_id: string
          scheduled_departure_at: string
          status?: Database["public"]["Enums"]["traverse_mission_status"]
          title: string
          updated_at?: string
        }
        Update: {
          aborted_at?: string | null
          actual_departure_at?: string | null
          cancelled_at?: string | null
          checkin_interval_hours?: number
          completed_at?: string | null
          corridor_id?: string
          created_at?: string
          created_by?: string | null
          destination_station_id?: string | null
          expedition_id?: string
          id?: string
          lead_asset_id?: string
          lead_person_id?: string
          mission_code?: string
          operational_notes?: string | null
          origin_station_id?: string
          scheduled_departure_at?: string
          status?: Database["public"]["Enums"]["traverse_mission_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "traverse_missions_destination_station_id_fkey"
            columns: ["destination_station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traverse_missions_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traverse_missions_lead_asset_id_fkey"
            columns: ["lead_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traverse_missions_lead_person_id_fkey"
            columns: ["lead_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traverse_missions_origin_station_id_fkey"
            columns: ["origin_station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_telemetry_history: {
        Row: {
          apparent_temp_c: number
          created_at: string
          id: string
          observed_at: string
          pressure_hpa: number
          provenance_tier: string
          relative_humidity_pct: number | null
          solar_elevation_deg: number | null
          station_code: string
          temperature_c: number
          wind_speed_kmh: number
        }
        Insert: {
          apparent_temp_c: number
          created_at?: string
          id?: string
          observed_at?: string
          pressure_hpa: number
          provenance_tier?: string
          relative_humidity_pct?: number | null
          solar_elevation_deg?: number | null
          station_code: string
          temperature_c: number
          wind_speed_kmh: number
        }
        Update: {
          apparent_temp_c?: number
          created_at?: string
          id?: string
          observed_at?: string
          pressure_hpa?: number
          provenance_tier?: string
          relative_humidity_pct?: number | null
          solar_elevation_deg?: number | null
          station_code?: string
          temperature_c?: number
          wind_speed_kmh?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_asset: {
        Args: {
          p_asset_id: string
          p_assignment_type: string
          p_expedition_id?: string
          p_notes?: string
          p_station_id?: string
        }
        Returns: {
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
        }[]
        SetofOptions: {
          from: "*"
          to: "asset_assignments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      current_user_person_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      is_admin: { Args: never; Returns: boolean }
      is_expedition_manager_for: {
        Args: { target_expedition_id: string }
        Returns: boolean
      }
      release_asset_assignment: {
        Args: { p_assignment_id: string }
        Returns: {
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
        }[]
        SetofOptions: {
          from: "*"
          to: "asset_assignments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      replace_expedition_leader: {
        Args: { new_leader_person_id: string; target_expedition_id: string }
        Returns: {
          assignment_role: string
          created_at: string
          expedition_id: string
          id: string
          joined_at: string
          left_at: string | null
          person_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "expedition_members"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      alert_severity: "INFO" | "WATCH" | "WARNING" | "CRITICAL"
      alert_status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED"
      app_role:
        | "SUPER_ADMIN"
        | "COMMAND_ADMIN"
        | "EXPEDITION_MANAGER"
        | "STATION_OPERATOR"
        | "VIEWER"
      asset_condition: "EXCELLENT" | "GOOD" | "ATTENTION_REQUIRED" | "CRITICAL"
      asset_status:
        | "AVAILABLE"
        | "ASSIGNED"
        | "IN_USE"
        | "MAINTENANCE"
        | "DAMAGED"
        | "RETIRED"
      cargo_container_type:
        | "ISO_20FT_DRY"
        | "ISO_20FT_REEFER"
        | "BREAKBULK_PALLET"
        | "HAZMAT_DRUM"
      comms_status:
        | "NOMINAL_HF"
        | "IRIDIUM_RUDICS"
        | "INMARSAT_BGAN"
        | "DEGRADED_AURORAL"
        | "BLACKOUT"
      criticality_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
      data_classification:
        | "AUTHORITATIVE_REAL"
        | "EXTERNAL_REAL"
        | "SIMULATED"
        | "DERIVED"
      delivery_status:
        | "SUCCESS"
        | "PERMANENT_FAILURE"
        | "RATE_LIMITED"
        | "TEST_MODE_SIMULATED"
      expedition_status:
        | "DRAFT"
        | "PLANNED"
        | "ACTIVE"
        | "COMPLETED"
        | "CANCELLED"
        | "ARCHIVED"
      fuel_type: "ARCTIC_HSD" | "JET_A1" | "LUBE_OIL" | "MOGAS"
      hardware_protocol:
        | "MODBUS_RTU"
        | "MODBUS_TCP"
        | "MQTT"
        | "SNMP"
        | "NMEA"
        | "VIRTUAL"
      incident_type:
        | "COLD_INJURY"
        | "EQUIPMENT_FAILURE"
        | "FIRE_ALARM"
        | "VEHICLE_BREAKDOWN"
        | "CREVASSE_HAZARD"
        | "COMMS_BLACKOUT"
        | "FUEL_SPILL"
      inventory_transaction_type:
        | "RECEIPT"
        | "RESTOCK"
        | "CONSUMPTION"
        | "TRANSFER_IN"
        | "TRANSFER_OUT"
        | "ADJUSTMENT"
        | "DAMAGE_LOSS"
        | "EXPIRY"
      logistics_transit_stage:
        | "GOA_MOBILIZATION"
        | "CAPE_TOWN_BUNKERING"
        | "SOUTHERN_OCEAN_TRANSIT"
        | "ICE_SHELF_BARRIER"
        | "STATION_DELIVERED"
      maintenance_status:
        | "SCHEDULED"
        | "IN_PROGRESS"
        | "COMPLETED"
        | "CANCELLED"
      notification_channel: "TELEGRAM" | "EMAIL" | "WEB_PUSH" | "MOCK"
      outbox_status: "QUEUED" | "SENDING" | "SENT" | "FAILED" | "CANCELLED"
      outdoor_clearance_status:
        | "GREEN_NORMAL"
        | "YELLOW_RESTRICTED"
        | "RED_LOCKDOWN"
      station_status: "ACTIVE" | "INACTIVE" | "HISTORICAL"
      tank_type: "MAIN_BULK" | "DAY_TANK" | "RESERVE_CACHE" | "MOBILE_BOWSER"
      telemetry_classification: "PHYSICAL_TELEMETRY" | "SIMULATED_TELEMETRY"
      telemetry_quality: "GOOD" | "SUSPECT" | "BAD" | "SIMULATED"
      telemetry_source: "MODBUS" | "MQTT" | "SNMP" | "NMEA" | "VIRTUAL"
      traverse_mission_status:
        | "PLANNED"
        | "DISPATCHED"
        | "EN_ROUTE"
        | "CHECKIN_OVERDUE"
        | "COMPLETED"
        | "ABORTED"
        | "CANCELLED"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      alert_severity: ["INFO", "WATCH", "WARNING", "CRITICAL"],
      alert_status: ["ACTIVE", "ACKNOWLEDGED", "RESOLVED"],
      app_role: [
        "SUPER_ADMIN",
        "COMMAND_ADMIN",
        "EXPEDITION_MANAGER",
        "STATION_OPERATOR",
        "VIEWER",
      ],
      asset_condition: ["EXCELLENT", "GOOD", "ATTENTION_REQUIRED", "CRITICAL"],
      asset_status: [
        "AVAILABLE",
        "ASSIGNED",
        "IN_USE",
        "MAINTENANCE",
        "DAMAGED",
        "RETIRED",
      ],
      cargo_container_type: [
        "ISO_20FT_DRY",
        "ISO_20FT_REEFER",
        "BREAKBULK_PALLET",
        "HAZMAT_DRUM",
      ],
      comms_status: [
        "NOMINAL_HF",
        "IRIDIUM_RUDICS",
        "INMARSAT_BGAN",
        "DEGRADED_AURORAL",
        "BLACKOUT",
      ],
      criticality_level: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      data_classification: [
        "AUTHORITATIVE_REAL",
        "EXTERNAL_REAL",
        "SIMULATED",
        "DERIVED",
      ],
      delivery_status: [
        "SUCCESS",
        "PERMANENT_FAILURE",
        "RATE_LIMITED",
        "TEST_MODE_SIMULATED",
      ],
      expedition_status: [
        "DRAFT",
        "PLANNED",
        "ACTIVE",
        "COMPLETED",
        "CANCELLED",
        "ARCHIVED",
      ],
      fuel_type: ["ARCTIC_HSD", "JET_A1", "LUBE_OIL", "MOGAS"],
      hardware_protocol: [
        "MODBUS_RTU",
        "MODBUS_TCP",
        "MQTT",
        "SNMP",
        "NMEA",
        "VIRTUAL",
      ],
      incident_type: [
        "COLD_INJURY",
        "EQUIPMENT_FAILURE",
        "FIRE_ALARM",
        "VEHICLE_BREAKDOWN",
        "CREVASSE_HAZARD",
        "COMMS_BLACKOUT",
        "FUEL_SPILL",
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
      logistics_transit_stage: [
        "GOA_MOBILIZATION",
        "CAPE_TOWN_BUNKERING",
        "SOUTHERN_OCEAN_TRANSIT",
        "ICE_SHELF_BARRIER",
        "STATION_DELIVERED",
      ],
      maintenance_status: [
        "SCHEDULED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ],
      notification_channel: ["TELEGRAM", "EMAIL", "WEB_PUSH", "MOCK"],
      outbox_status: ["QUEUED", "SENDING", "SENT", "FAILED", "CANCELLED"],
      outdoor_clearance_status: [
        "GREEN_NORMAL",
        "YELLOW_RESTRICTED",
        "RED_LOCKDOWN",
      ],
      station_status: ["ACTIVE", "INACTIVE", "HISTORICAL"],
      tank_type: ["MAIN_BULK", "DAY_TANK", "RESERVE_CACHE", "MOBILE_BOWSER"],
      telemetry_classification: ["PHYSICAL_TELEMETRY", "SIMULATED_TELEMETRY"],
      telemetry_quality: ["GOOD", "SUSPECT", "BAD", "SIMULATED"],
      telemetry_source: ["MODBUS", "MQTT", "SNMP", "NMEA", "VIRTUAL"],
      traverse_mission_status: [
        "PLANNED",
        "DISPATCHED",
        "EN_ROUTE",
        "CHECKIN_OVERDUE",
        "COMPLETED",
        "ABORTED",
        "CANCELLED",
      ],
    },
  },
} as const
