import type { Database } from "@/infrastructure/db/database.types";

/**
 * Direct database row representation for the expeditions table.
 * Sourced directly from the generated Supabase schema contract.
 */
export type ExpeditionRow = Database["public"]["Tables"]["expeditions"]["Row"];

/**
 * Expedition operational lifecycle status enum.
 * Sourced directly from the generated Supabase schema contract.
 */
export type ExpeditionStatus =
  Database["public"]["Enums"]["expedition_status"];

/**
 * Data classification level for polar expedition data.
 * Sourced directly from the generated Supabase schema contract.
 */
export type DataClassification =
  Database["public"]["Enums"]["data_classification"];

/**
 * Direct database row representation for the expedition_members table.
 * Sourced directly from the generated Supabase schema contract.
 */
export type ExpeditionMemberRow =
  Database["public"]["Tables"]["expedition_members"]["Row"];

/**
 * Filter options for querying expedition collections.
 */
export interface ExpeditionListFilters {
  readonly status?: ExpeditionStatus;
}

/**
 * Input contract for creating a new polar expedition.
 * Note: Status is not caller-controlled; new expeditions always begin as DRAFT.
 */
export interface CreateExpeditionInput {
  readonly code: string;
  readonly name: string;
  readonly description?: string | null;
  readonly origin_station_id?: string | null;
  readonly destination_station_id: string;
  readonly planned_start_at: string;
  readonly planned_end_at: string;
  readonly data_classification?: DataClassification;
  readonly initial_leader_person_id?: string | null;
}

/**
 * Input contract for updating descriptive metadata of an existing expedition.
 * Strictly excludes immutable fields (id, code, data_classification) and lifecycle status.
 */
export interface UpdateExpeditionMetadataInput {
  readonly name?: string;
  readonly description?: string | null;
  readonly origin_station_id?: string | null;
  readonly destination_station_id?: string;
  readonly planned_start_at?: string;
  readonly planned_end_at?: string;
}

/**
 * Input contract for executing lifecycle status transitions.
 * Bounded strictly to the target state and operational timestamps required by the state machine.
 */
export interface UpdateExpeditionStatusInput {
  readonly targetStatus: ExpeditionStatus;
  readonly actual_start_at?: string;
  readonly actual_end_at?: string;
}
