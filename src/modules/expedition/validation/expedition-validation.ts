import type {
  CreateExpeditionInput,
  DataClassification,
  ExpeditionStatus,
  UpdateExpeditionMetadataInput,
} from "../types/expedition.types";

/**
 * Standard structured result returned by validation functions.
 */
export type ValidationResult<T> =
  | { readonly valid: true; readonly data: T }
  | { readonly valid: false; readonly error: string };

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EXPEDITION_CODE_REGEX = /^EXP-[A-Z0-9_-]+$/;

const VALID_DATA_CLASSIFICATIONS: ReadonlySet<DataClassification> = new Set([
  "AUTHORITATIVE_REAL",
  "EXTERNAL_REAL",
  "SIMULATED",
  "DERIVED",
]);

const ALLOWED_STATUS_TRANSITIONS: ReadonlyMap<
  ExpeditionStatus,
  ReadonlySet<ExpeditionStatus>
> = new Map([
  ["DRAFT", new Set<ExpeditionStatus>(["PLANNED", "CANCELLED"])],
  ["PLANNED", new Set<ExpeditionStatus>(["ACTIVE", "CANCELLED"])],
  ["ACTIVE", new Set<ExpeditionStatus>(["COMPLETED", "CANCELLED"])],
  ["COMPLETED", new Set<ExpeditionStatus>(["ARCHIVED"])],
  ["CANCELLED", new Set<ExpeditionStatus>(["ARCHIVED"])],
  ["ARCHIVED", new Set<ExpeditionStatus>()],
]);

/**
 * Checks if a given string is a valid RFC 4122 UUID.
 */
export function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id?.trim() ?? "");
}

/**
 * Checks if a string is a valid parseable ISO date timestamp.
 */
export function isValidIsoDate(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== "string") {
    return false;
  }
  const parsed = Date.parse(dateStr);
  return !isNaN(parsed);
}

/**
 * Validates and normalizes input for creating a new polar expedition.
 * Pure validation: does not query external sources or database tables.
 */
export function validateCreateExpeditionInput(
  input: CreateExpeditionInput
): ValidationResult<CreateExpeditionInput> {
  if (!input || typeof input !== "object") {
    return { valid: false, error: "Input payload is required." };
  }

  // 1. Validate Code
  const normalizedCode = input.code?.trim().toUpperCase();
  if (!normalizedCode) {
    return { valid: false, error: "Expedition code is required." };
  }
  if (!EXPEDITION_CODE_REGEX.test(normalizedCode)) {
    return {
      valid: false,
      error:
        "Expedition code must follow the pattern '^EXP-[A-Z0-9_-]+$' (e.g. 'EXP-2027-01').",
    };
  }

  // 2. Validate Name
  const normalizedName = input.name?.trim();
  if (!normalizedName) {
    return { valid: false, error: "Expedition name is required." };
  }
  if (normalizedName.length < 3 || normalizedName.length > 100) {
    return {
      valid: false,
      error: "Expedition name must be between 3 and 100 characters.",
    };
  }

  // 3. Validate Description
  const normalizedDescription = input.description?.trim() ?? null;
  if (normalizedDescription && normalizedDescription.length > 2000) {
    return {
      valid: false,
      error: "Expedition description must not exceed 2000 characters.",
    };
  }

  // 4. Validate Destination Station UUID
  const normalizedDestinationId = input.destination_station_id?.trim();
  if (!normalizedDestinationId || !isValidUuid(normalizedDestinationId)) {
    return {
      valid: false,
      error: "Destination station ID must be a valid UUID.",
    };
  }

  // 5. Validate Origin Station UUID (Optional)
  const normalizedOriginId = input.origin_station_id?.trim() ?? null;
  if (normalizedOriginId && !isValidUuid(normalizedOriginId)) {
    return {
      valid: false,
      error: "Origin station ID must be a valid UUID if provided.",
    };
  }

  // 6. Validate Dates
  if (!isValidIsoDate(input.planned_start_at)) {
    return {
      valid: false,
      error: "Planned start date must be a valid ISO timestamp.",
    };
  }
  if (!isValidIsoDate(input.planned_end_at)) {
    return {
      valid: false,
      error: "Planned end date must be a valid ISO timestamp.",
    };
  }
  const startMs = Date.parse(input.planned_start_at);
  const endMs = Date.parse(input.planned_end_at);
  if (endMs <= startMs) {
    return {
      valid: false,
      error: "Planned end date must be strictly after planned start date.",
    };
  }

  // 7. Validate Data Classification (Optional)
  if (
    input.data_classification &&
    !VALID_DATA_CLASSIFICATIONS.has(input.data_classification)
  ) {
    return {
      valid: false,
      error: `Invalid data classification '${input.data_classification}'.`,
    };
  }

  // 8. Validate Initial Leader Person ID (Optional)
  const normalizedLeaderId = input.initial_leader_person_id?.trim() ?? null;
  if (normalizedLeaderId && !isValidUuid(normalizedLeaderId)) {
    return {
      valid: false,
      error: "Initial leader person ID must be a valid UUID if provided.",
    };
  }

  return {
    valid: true,
    data: {
      code: normalizedCode,
      name: normalizedName,
      description: normalizedDescription,
      destination_station_id: normalizedDestinationId,
      origin_station_id: normalizedOriginId,
      planned_start_at: new Date(startMs).toISOString(),
      planned_end_at: new Date(endMs).toISOString(),
      data_classification: input.data_classification ?? "AUTHORITATIVE_REAL",
      initial_leader_person_id: normalizedLeaderId,
    },
  };
}

/**
 * Validates and normalizes input for updating metadata of an existing expedition.
 */
export function validateUpdateExpeditionMetadataInput(
  input: UpdateExpeditionMetadataInput
): ValidationResult<UpdateExpeditionMetadataInput> {
  if (!input || typeof input !== "object") {
    return { valid: false, error: "Update payload is required." };
  }

  const keys = Object.keys(input) as (keyof UpdateExpeditionMetadataInput)[];
  if (keys.length === 0 || keys.every((k) => input[k] === undefined)) {
    return {
      valid: false,
      error: "At least one metadata field must be provided for update.",
    };
  }

  const result: { -readonly [K in keyof UpdateExpeditionMetadataInput]?: UpdateExpeditionMetadataInput[K] } = {};

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (trimmed.length < 3 || trimmed.length > 100) {
      return {
        valid: false,
        error: "Expedition name must be between 3 and 100 characters.",
      };
    }
    result.name = trimmed;
  }

  if (input.description !== undefined) {
    if (input.description !== null && input.description.length > 2000) {
      return {
        valid: false,
        error: "Expedition description must not exceed 2000 characters.",
      };
    }
    result.description = input.description?.trim() ?? null;
  }

  if (input.destination_station_id !== undefined) {
    if (!isValidUuid(input.destination_station_id)) {
      return {
        valid: false,
        error: "Destination station ID must be a valid UUID.",
      };
    }
    result.destination_station_id = input.destination_station_id.trim();
  }

  if (input.origin_station_id !== undefined) {
    if (
      input.origin_station_id !== null &&
      !isValidUuid(input.origin_station_id)
    ) {
      return {
        valid: false,
        error: "Origin station ID must be a valid UUID if provided.",
      };
    }
    result.origin_station_id = input.origin_station_id?.trim() ?? null;
  }

  if (input.planned_start_at !== undefined) {
    if (!isValidIsoDate(input.planned_start_at)) {
      return {
        valid: false,
        error: "Planned start date must be a valid ISO timestamp.",
      };
    }
    result.planned_start_at = new Date(input.planned_start_at).toISOString();
  }

  if (input.planned_end_at !== undefined) {
    if (!isValidIsoDate(input.planned_end_at)) {
      return {
        valid: false,
        error: "Planned end date must be a valid ISO timestamp.",
      };
    }
    result.planned_end_at = new Date(input.planned_end_at).toISOString();
  }

  if (result.planned_start_at && result.planned_end_at) {
    if (
      Date.parse(result.planned_end_at) <= Date.parse(result.planned_start_at)
    ) {
      return {
        valid: false,
        error: "Planned end date must be strictly after planned start date.",
      };
    }
  }

  return { valid: true, data: result };
}

/**
 * Validates whether a lifecycle status transition from currentStatus to targetStatus is permitted.
 */
export function validateStatusTransition(
  currentStatus: ExpeditionStatus,
  targetStatus: ExpeditionStatus
): ValidationResult<void> {
  if (currentStatus === targetStatus) {
    return {
      valid: false,
      error: `Expedition is already in '${currentStatus}' status.`,
    };
  }

  const allowedTargets = ALLOWED_STATUS_TRANSITIONS.get(currentStatus);
  if (!allowedTargets || !allowedTargets.has(targetStatus)) {
    return {
      valid: false,
      error: `Invalid expedition status transition from '${currentStatus}' to '${targetStatus}'.`,
    };
  }

  return { valid: true, data: undefined };
}
