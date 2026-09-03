import type {
  AssignAssetInput,
  AssignmentType,
  CreateAssetInput,
  MaintenanceType,
  ScheduleMaintenanceInput,
  UpdateAssetMetadataInput,
} from "../types/asset.types";

/**
 * Regex for standard UUID format (supports v1-v5 and deterministic identifiers).
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Regex for polar asset code format (e.g., GEN-01, PISTEN-04, COMMS-HF-02).
 * Requirements: uppercase letters, numbers, hyphens; 2 to 32 characters.
 */
const ASSET_CODE_REGEX = /^[A-Z0-9][A-Z0-9-]{0,30}[A-Z0-9]$/;

/**
 * Allowed assignment types constant array.
 */
export const ALLOWED_ASSIGNMENT_TYPES: readonly AssignmentType[] = [
  "STATION_DEPLOYMENT",
  "EXPEDITION_FIELD_OPERATION",
] as const;

/**
 * Allowed maintenance types constant array.
 */
export const ALLOWED_MAINTENANCE_TYPES: readonly MaintenanceType[] = [
  "PREVENTIVE",
  "CORRECTIVE",
  "INSPECTION",
] as const;

/**
 * Validates whether a string conforms to UUID format.
 */
export function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id.trim());
}

/**
 * Validates whether an asset code conforms to the POLARIS asset code format.
 */
export function isValidAssetCode(code: string): boolean {
  return ASSET_CODE_REGEX.test(code.trim());
}

/**
 * Validates whether a string is a valid ISO-8601 date timestamp.
 */
export function isValidIsoDate(dateString: string): boolean {
  const parsed = Date.parse(dateString);
  return !Number.isNaN(parsed);
}

/**
 * Validates non-negative numerical cost.
 */
export function isValidCost(cost: number | null | undefined): boolean {
  if (cost === null || cost === undefined) return true;
  return typeof cost === "number" && !Number.isNaN(cost) && cost >= 0;
}

/**
 * Validates assignment type enum string.
 */
export function isValidAssignmentType(
  type: string
): type is AssignmentType {
  return ALLOWED_ASSIGNMENT_TYPES.includes(type as AssignmentType);
}

/**
 * Validates maintenance type enum string.
 */
export function isValidMaintenanceType(
  type: string
): type is MaintenanceType {
  return ALLOWED_MAINTENANCE_TYPES.includes(type as MaintenanceType);
}

/**
 * Validates chronological date sequencing for maintenance lifecycle records.
 * Invariant: started_at >= scheduled_at, completed_at >= started_at
 */
export function isValidMaintenanceDateSequence(
  scheduledAt: string,
  startedAt?: string | null,
  completedAt?: string | null
): boolean {
  if (!isValidIsoDate(scheduledAt)) return false;
  const schedMs = Date.parse(scheduledAt);

  if (startedAt) {
    if (!isValidIsoDate(startedAt)) return false;
    const startMs = Date.parse(startedAt);
    if (startMs < schedMs) return false;

    if (completedAt) {
      if (!isValidIsoDate(completedAt)) return false;
      const compMs = Date.parse(completedAt);
      if (compMs < startMs) return false;
    }
  } else if (completedAt) {
    // Cannot be completed without being started
    return false;
  }

  return true;
}

/**
 * Pure validation for CreateAssetInput.
 * Returns error string if invalid, or null if valid.
 */
export function validateCreateAssetInput(
  input: CreateAssetInput
): string | null {
  if (!input.asset_code || !isValidAssetCode(input.asset_code)) {
    return "Invalid asset code format. Must be 2-32 characters of uppercase letters, numbers, and hyphens.";
  }

  if (!input.name || input.name.trim().length === 0) {
    return "Asset name is required and cannot be empty.";
  }

  if (!input.category || input.category.trim().length === 0) {
    return "Asset category is required and cannot be empty.";
  }

  if (input.station_id && !isValidUuid(input.station_id)) {
    return "Invalid station_id UUID format.";
  }

  if (input.commissioned_at && !isValidIsoDate(input.commissioned_at)) {
    return "Invalid commissioned_at ISO date format.";
  }

  return null;
}

/**
 * Pure validation for UpdateAssetMetadataInput.
 * Returns error string if invalid, or null if valid.
 */
export function validateUpdateAssetMetadataInput(
  input: UpdateAssetMetadataInput
): string | null {
  if (input.name !== undefined && input.name.trim().length === 0) {
    return "Asset name cannot be empty.";
  }

  if (input.category !== undefined && input.category.trim().length === 0) {
    return "Asset category cannot be empty.";
  }

  if (input.commissioned_at && !isValidIsoDate(input.commissioned_at)) {
    return "Invalid commissioned_at ISO date format.";
  }

  return null;
}

/**
 * Pure validation for AssignAssetInput.
 * Returns error string if invalid, or null if valid.
 */
export function validateAssignAssetInput(
  input: AssignAssetInput
): string | null {
  if (!input.asset_id || !isValidUuid(input.asset_id)) {
    return "Invalid asset_id UUID format.";
  }

  if (!isValidAssignmentType(input.assignment_type)) {
    return "Invalid assignment_type. Must be STATION_DEPLOYMENT or EXPEDITION_FIELD_OPERATION.";
  }

  if (input.assignment_type === "STATION_DEPLOYMENT") {
    if (!input.station_id || !isValidUuid(input.station_id)) {
      return "STATION_DEPLOYMENT requires a valid station_id UUID.";
    }
  }

  if (input.assignment_type === "EXPEDITION_FIELD_OPERATION") {
    if (!input.expedition_id || !isValidUuid(input.expedition_id)) {
      return "EXPEDITION_FIELD_OPERATION requires a valid expedition_id UUID.";
    }
  }

  return null;
}

/**
 * Pure validation for ScheduleMaintenanceInput.
 * Returns error string if invalid, or null if valid.
 */
export function validateScheduleMaintenanceInput(
  input: ScheduleMaintenanceInput
): string | null {
  if (!input.asset_id || !isValidUuid(input.asset_id)) {
    return "Invalid asset_id UUID format.";
  }

  if (!isValidMaintenanceType(input.maintenance_type)) {
    return "Invalid maintenance_type. Must be PREVENTIVE, CORRECTIVE, or INSPECTION.";
  }

  if (!input.scheduled_at || !isValidIsoDate(input.scheduled_at)) {
    return "Invalid scheduled_at ISO date format.";
  }

  if (!isValidCost(input.cost)) {
    return "Maintenance cost must be a non-negative number.";
  }

  return null;
}
