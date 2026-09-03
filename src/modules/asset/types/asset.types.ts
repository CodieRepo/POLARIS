import type { Database } from "@/infrastructure/db/database.types";

/**
 * Direct database row representation for the assets table.
 * Sourced directly from the generated Supabase schema contract.
 */
export type AssetRow = Database["public"]["Tables"]["assets"]["Row"];

/**
 * Direct database row representation for the asset_assignments table.
 * Sourced directly from the generated Supabase schema contract.
 */
export type AssetAssignmentRow =
  Database["public"]["Tables"]["asset_assignments"]["Row"];

/**
 * Direct database row representation for the maintenance_records table.
 * Sourced directly from the generated Supabase schema contract.
 */
export type MaintenanceRecordRow =
  Database["public"]["Tables"]["maintenance_records"]["Row"];

/**
 * Operational availability status enum for physical assets.
 * Sourced directly from the generated Supabase schema contract.
 */
export type AssetStatus = Database["public"]["Enums"]["asset_status"];

/**
 * Physical health assessment enum for physical assets.
 * Sourced directly from the generated Supabase schema contract.
 */
export type AssetCondition = Database["public"]["Enums"]["asset_condition"];

/**
 * Operational criticality rating enum.
 * Sourced directly from the generated Supabase schema contract.
 */
export type CriticalityLevel =
  Database["public"]["Enums"]["criticality_level"];

/**
 * Lifecycle state enum for maintenance work orders.
 * Sourced directly from the generated Supabase schema contract.
 */
export type MaintenanceStatus =
  Database["public"]["Enums"]["maintenance_status"];

/**
 * Data classification level for polar asset data.
 * Sourced directly from the generated Supabase schema contract.
 */
export type DataClassification =
  Database["public"]["Enums"]["data_classification"];

/**
 * Allowed deployment assignment types enforced by database CHECK constraint:
 * asset_assignments_assignment_type_check
 */
export type AssignmentType =
  | "STATION_DEPLOYMENT"
  | "EXPEDITION_FIELD_OPERATION";

/**
 * Allowed maintenance work order types enforced by database CHECK constraint:
 * maintenance_records_maintenance_type_check
 */
export type MaintenanceType = "PREVENTIVE" | "CORRECTIVE" | "INSPECTION";

/**
 * Filter options for querying asset collections.
 */
export interface AssetListFilters {
  readonly station_id?: string;
  readonly status?: AssetStatus;
  readonly category?: string;
  readonly criticality?: CriticalityLevel;
}

/**
 * Input contract for provisioning a new physical asset.
 * Note: Initial status is not caller-controlled; new assets always begin as AVAILABLE.
 */
export interface CreateAssetInput {
  readonly asset_code: string;
  readonly name: string;
  readonly category: string;
  readonly type?: string | null;
  readonly station_id?: string | null;
  readonly condition?: AssetCondition;
  readonly criticality?: CriticalityLevel;
  readonly manufacturer?: string | null;
  readonly model?: string | null;
  readonly commissioned_at?: string | null;
  readonly data_classification?: DataClassification;
}

/**
 * Input contract for updating descriptive specifications and condition of an existing asset.
 * Strictly excludes immutable fields (id, asset_code, data_classification) and lifecycle status.
 */
export interface UpdateAssetMetadataInput {
  readonly name?: string;
  readonly category?: string;
  readonly type?: string | null;
  readonly condition?: AssetCondition;
  readonly criticality?: CriticalityLevel;
  readonly manufacturer?: string | null;
  readonly model?: string | null;
  readonly commissioned_at?: string | null;
  readonly status?: AssetStatus;
}

/**
 * Input contract for deploying an asset to a station or expedition.
 */
export interface AssignAssetInput {
  readonly asset_id: string;
  readonly assignment_type: AssignmentType;
  readonly station_id?: string | null;
  readonly expedition_id?: string | null;
  readonly notes?: string | null;
}

/**
 * Input contract for closing an active asset deployment.
 */
export interface ReleaseAssetInput {
  readonly assignment_id: string;
}

/**
 * Input contract for logging a scheduled maintenance work order.
 */
export interface ScheduleMaintenanceInput {
  readonly asset_id: string;
  readonly maintenance_type: MaintenanceType;
  readonly scheduled_at: string;
  readonly description?: string | null;
  readonly performed_by?: string | null;
  readonly cost?: number | null;
  readonly notes?: string | null;
}

/**
 * Input contract for updating maintenance work order lifecycle state.
 */
export interface UpdateMaintenanceStatusInput {
  readonly maintenance_id: string;
  readonly status: MaintenanceStatus;
  readonly started_at?: string | null;
  readonly completed_at?: string | null;
  readonly performed_by?: string | null;
  readonly cost?: number | null;
  readonly notes?: string | null;
}

/**
 * Consolidated historical view of an asset including deployment allocations and maintenance servicing records.
 */
export interface AssetHistory {
  readonly asset: AssetRow;
  readonly assignments: readonly AssetAssignmentRow[];
  readonly maintenance: readonly MaintenanceRecordRow[];
}

