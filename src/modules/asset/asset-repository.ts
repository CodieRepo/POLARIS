import type { Database } from "@/infrastructure/db/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssetAssignmentRow,
  AssetListFilters,
  AssetRow,
  AssignAssetInput,
  CreateAssetInput,
  MaintenanceRecordRow,
  UpdateAssetMetadataInput,
} from "./types/asset.types";

/**
 * Explicit column projection for the assets table.
 * Avoids `select('*')` to maintain bounded data contracts.
 */
const ASSET_SELECT_COLUMNS =
  "id, asset_code, name, category, type, station_id, status, condition, criticality, manufacturer, model, commissioned_at, last_maintenance_at, next_maintenance_at, data_classification, created_at, updated_at" as const;

/**
 * Explicit column projection for the asset_assignments table.
 */
const ASSET_ASSIGNMENT_SELECT_COLUMNS =
  "id, asset_id, expedition_id, station_id, assignment_type, assigned_at, released_at, notes, created_at, updated_at" as const;

/**
 * Explicit column projection for the maintenance_records table.
 */
const MAINTENANCE_RECORD_SELECT_COLUMNS =
  "id, asset_id, maintenance_type, status, scheduled_at, started_at, completed_at, performed_by, cost, description, notes, created_at, updated_at" as const;

/**
 * Custom error indicating a PostgreSQL unique constraint violation on asset_code (23505).
 */
export class AssetConflictError extends Error {
  readonly code = "23505";
  constructor(message: string) {
    super(message);
    this.name = "AssetConflictError";
  }
}

/**
 * Error indicating a PostgreSQL RPC workflow failure (assign_asset / release_asset_assignment).
 * Preserves the original PostgreSQL error code for upstream mapping.
 */
export class AssetWorkflowError extends Error {
  readonly pgCode: string;
  constructor(message: string, pgCode: string) {
    super(message);
    this.name = "AssetWorkflowError";
    this.pgCode = pgCode;
  }
}

/**
 * Data-access repository for the Asset domain.
 *
 * Enforces:
 * - Direct SupabaseClient injection (user-scoped authenticated client only).
 * - Explicit column projections without `select('*')`.
 * - No internal authorization or UserContext checks (handled at RLS / UseCase boundary).
 */
export class AssetRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  /**
   * Provisions a new physical asset in AVAILABLE status.
   *
   * @param input - The asset creation data payload.
   * @returns The newly created AssetRow.
   * @throws AssetConflictError if asset_code already exists (23505).
   */
  async create(input: CreateAssetInput): Promise<AssetRow> {
    const insertPayload: Database["public"]["Tables"]["assets"]["Insert"] = {
      asset_code: input.asset_code.trim(),
      name: input.name.trim(),
      category: input.category.trim(),
      type: input.type?.trim() || null,
      station_id: input.station_id || null,
      status: "AVAILABLE",
      condition: input.condition ?? "GOOD",
      criticality: input.criticality ?? "MEDIUM",
      manufacturer: input.manufacturer?.trim() || null,
      model: input.model?.trim() || null,
      commissioned_at: input.commissioned_at || null,
      data_classification: input.data_classification ?? "SIMULATED",
    };

    const { data, error } = await this.client
      .from("assets")
      .insert(insertPayload)
      .select(ASSET_SELECT_COLUMNS)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new AssetConflictError(
          `Asset with code '${input.asset_code}' already exists.`
        );
      }
      throw new Error(`Failed to create asset: ${error.message}`);
    }

    return data as AssetRow;
  }

  /**
   * Updates descriptive metadata and specifications of an existing asset.
   *
   * @param id - Asset UUID.
   * @param input - Partial metadata attributes to update.
   * @returns The updated AssetRow.
   */
  async update(
    id: string,
    input: UpdateAssetMetadataInput
  ): Promise<AssetRow> {
    const updatePayload: Database["public"]["Tables"]["assets"]["Update"] = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updatePayload.name = input.name.trim();
    if (input.category !== undefined) updatePayload.category = input.category.trim();
    if (input.type !== undefined) updatePayload.type = input.type?.trim() || null;
    if (input.condition !== undefined) updatePayload.condition = input.condition;
    if (input.criticality !== undefined) updatePayload.criticality = input.criticality;
    if (input.manufacturer !== undefined) updatePayload.manufacturer = input.manufacturer?.trim() || null;
    if (input.model !== undefined) updatePayload.model = input.model?.trim() || null;
    if (input.commissioned_at !== undefined) updatePayload.commissioned_at = input.commissioned_at || null;
    if (input.status !== undefined) updatePayload.status = input.status;

    const { data, error } = await this.client
      .from("assets")
      .update(updatePayload)
      .eq("id", id)
      .select(ASSET_SELECT_COLUMNS)
      .single();

    if (error) {
      throw new Error(`Failed to update asset '${id}': ${error.message}`);
    }

    return data as AssetRow;
  }

  /**
   * Retrieves an asset by its primary UUID.
   *
   * @param id - Asset primary key UUID.
   * @returns The asset row or null if not found.
   */
  async getById(id: string): Promise<AssetRow | null> {
    const { data, error } = await this.client
      .from("assets")
      .select(ASSET_SELECT_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get asset by ID '${id}': ${error.message}`);
    }

    return (data as AssetRow) ?? null;
  }

  /**
   * Retrieves an asset by its unique alphanumeric barcode/code (e.g., 'GEN-01').
   *
   * @param assetCode - Unique asset code.
   * @returns The asset row or null if not found.
   */
  async getByCode(assetCode: string): Promise<AssetRow | null> {
    const { data, error } = await this.client
      .from("assets")
      .select(ASSET_SELECT_COLUMNS)
      .eq("asset_code", assetCode)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to get asset by code '${assetCode}': ${error.message}`
      );
    }

    return (data as AssetRow) ?? null;
  }

  /**
   * Lists assets matching optional filters, ordered by asset_code ascending.
   *
   * @param filters - Optional criteria: station_id, status, category, criticality.
   * @returns Array of matching asset rows.
   */
  async list(filters?: AssetListFilters): Promise<AssetRow[]> {
    let query = this.client
      .from("assets")
      .select(ASSET_SELECT_COLUMNS)
      .order("asset_code", { ascending: true });

    if (filters?.station_id) {
      query = query.eq("station_id", filters.station_id);
    }

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    if (filters?.category) {
      query = query.eq("category", filters.category);
    }

    if (filters?.criticality) {
      query = query.eq("criticality", filters.criticality);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list assets: ${error.message}`);
    }

    return (data as AssetRow[]) ?? [];
  }

  /**
   * Retrieves the current active assignment for an asset (released_at IS NULL).
   *
   * @param assetId - Asset UUID.
   * @returns The active assignment row or null if none active.
   */
  async getActiveAssignment(
    assetId: string
  ): Promise<AssetAssignmentRow | null> {
    const { data, error } = await this.client
      .from("asset_assignments")
      .select(ASSET_ASSIGNMENT_SELECT_COLUMNS)
      .eq("asset_id", assetId)
      .is("released_at", null)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to get active assignment for asset '${assetId}': ${error.message}`
      );
    }

    return (data as AssetAssignmentRow) ?? null;
  }

  /**
   * Retrieves all historical and active assignment allocations for an asset,
   * ordered in reverse chronological order (assigned_at descending).
   *
   * @param assetId - Asset UUID.
   * @returns Array of assignment rows (both active and released).
   */
  async getAssignmentHistory(
    assetId: string
  ): Promise<AssetAssignmentRow[]> {
    const { data, error } = await this.client
      .from("asset_assignments")
      .select(ASSET_ASSIGNMENT_SELECT_COLUMNS)
      .eq("asset_id", assetId)
      .order("assigned_at", { ascending: false });

    if (error) {
      throw new Error(
        `Failed to get assignment history for asset '${assetId}': ${error.message}`
      );
    }

    return (data as AssetAssignmentRow[]) ?? [];
  }

  /**
   * Retrieves the full maintenance servicing history for an asset,
   * ordered in reverse chronological order (scheduled_at descending).
   *
   * @param assetId - Asset UUID.
   * @returns Array of maintenance record rows.
   */
  async getMaintenanceHistory(
    assetId: string
  ): Promise<MaintenanceRecordRow[]> {
    const { data, error } = await this.client
      .from("maintenance_records")
      .select(MAINTENANCE_RECORD_SELECT_COLUMNS)
      .eq("asset_id", assetId)
      .order("scheduled_at", { ascending: false });

    if (error) {
      throw new Error(
        `Failed to get maintenance history for asset '${assetId}': ${error.message}`
      );
    }

    return (data as MaintenanceRecordRow[]) ?? [];
  }

  /**
   * Retrieves currently active maintenance work orders for an asset (status IN ('SCHEDULED', 'IN_PROGRESS')).
   *
   * @param assetId - Asset UUID.
   * @returns Array of active maintenance record rows ordered chronologically.
   */
  async getActiveMaintenanceRecords(
    assetId: string
  ): Promise<MaintenanceRecordRow[]> {
    const { data, error } = await this.client
      .from("maintenance_records")
      .select(MAINTENANCE_RECORD_SELECT_COLUMNS)
      .eq("asset_id", assetId)
      .in("status", ["SCHEDULED", "IN_PROGRESS"])
      .order("scheduled_at", { ascending: true });

    if (error) {
      throw new Error(
        `Failed to get active maintenance records for asset '${assetId}': ${error.message}`
      );
    }

    return (data as MaintenanceRecordRow[]) ?? [];
  }

  /**
   * Atomically assigns an AVAILABLE asset to a station or expedition
   * via the assign_asset() SECURITY DEFINER RPC.
   *
   * @param input - Assignment input contract.
   * @returns The created assignment row.
   * @throws AssetWorkflowError if the RPC returns a domain error.
   */
  async assignAsset(input: AssignAssetInput): Promise<AssetAssignmentRow> {
    const { data, error } = await this.client.rpc("assign_asset", {
      p_asset_id: input.asset_id,
      p_assignment_type: input.assignment_type,
      p_station_id: input.station_id ?? undefined,
      p_expedition_id: input.expedition_id ?? undefined,
      p_notes: input.notes ?? undefined,
    });

    if (error) {
      throw new AssetWorkflowError(error.message, error.code);
    }

    const rows = data as AssetAssignmentRow[] | AssetAssignmentRow | null;
    const result = Array.isArray(rows) ? rows[0] : rows;

    if (!result) {
      throw new AssetWorkflowError(
        "assign_asset RPC returned no data",
        "PGRST000"
      );
    }

    return result;
  }

  /**
   * Atomically releases an active asset assignment via the
   * release_asset_assignment() SECURITY DEFINER RPC.
   *
   * @param assignmentId - The UUID of the active assignment to release.
   * @returns The closed assignment row with released_at populated.
   * @throws AssetWorkflowError if the RPC returns a domain error.
   */
  async releaseAssignment(assignmentId: string): Promise<AssetAssignmentRow> {
    const { data, error } = await this.client.rpc(
      "release_asset_assignment",
      {
        p_assignment_id: assignmentId,
      }
    );

    if (error) {
      throw new AssetWorkflowError(error.message, error.code);
    }

    const rows = data as AssetAssignmentRow[] | AssetAssignmentRow | null;
    const result = Array.isArray(rows) ? rows[0] : rows;

    if (!result) {
      throw new AssetWorkflowError(
        "release_asset_assignment RPC returned no data",
        "PGRST000"
      );
    }

    return result;
  }
}

