import type { UseCaseResult } from "@/core/errors/application-errors";
import type { UserContextResult } from "@/core/types/auth-context.types";
import { requireUserContext } from "@/infrastructure/auth/auth-context";
import { StationRepository } from "@/core/station/station-repository";
import type { ExpeditionRepository } from "../expedition-repository";
import type {
  ExpeditionRow,
  UpdateExpeditionMetadataInput,
} from "../types/expedition.types";
import {
  isValidUuid,
  validateUpdateExpeditionMetadataInput,
} from "../validation/expedition-validation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/infrastructure/db/database.types";

/**
 * Use case: Update descriptive metadata of an existing expedition.
 *
 * Authorization:
 * - Administrators (SUPER_ADMIN, COMMAND_ADMIN).
 * - Assigned EXPEDITION_MANAGER (enforced via RLS and roster membership).
 *
 * State Rules:
 * - DRAFT / PLANNED: All metadata fields editable.
 * - ACTIVE: Route stations and planned_start locked; name, description, and planned_end editable.
 * - COMPLETED / CANCELLED: Only description editable.
 * - ARCHIVED: All fields locked.
 */
export class UpdateExpeditionMetadataUseCase {
  constructor(
    private readonly repository: ExpeditionRepository,
    private readonly client: SupabaseClient<Database>,
    private readonly stationRepository?: StationRepository,
    private readonly userContextResolver: () => Promise<UserContextResult> = requireUserContext
  ) {}

  async execute(
    id: string,
    input: UpdateExpeditionMetadataInput
  ): Promise<
    UseCaseResult<
      ExpeditionRow,
      | "UNAUTHENTICATED"
      | "UNAUTHORIZED"
      | "ACCOUNT_DEACTIVATED"
      | "EXPEDITION_NOT_FOUND"
      | "INVALID_EXPEDITION_INPUT"
      | "INVALID_EXPEDITION_STATE"
      | "STATION_NOT_FOUND"
      | "INFRASTRUCTURE_ERROR"
    >
  > {
    const authResult = await this.userContextResolver();
    if (!authResult.success) {
      const authError = authResult.error;
      return {
        success: false,
        error: {
          code:
            authError.code === "ACCOUNT_DEACTIVATED"
              ? "ACCOUNT_DEACTIVATED"
              : authError.code === "INFRASTRUCTURE_ERROR"
                ? "INFRASTRUCTURE_ERROR"
                : "UNAUTHENTICATED",
          message: authError.message,
        },
      };
    }

    const userRole = authResult.data.role;
    if (
      userRole !== "COMMAND_ADMIN" &&
      userRole !== "SUPER_ADMIN" &&
      userRole !== "EXPEDITION_MANAGER"
    ) {
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "You do not have permission to modify expedition metadata.",
        },
      };
    }

    if (!isValidUuid(id)) {
      return {
        success: false,
        error: {
          code: "INVALID_EXPEDITION_INPUT",
          message: "Expedition ID must be a valid UUID.",
        },
      };
    }

    const validation = validateUpdateExpeditionMetadataInput(input);
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: "INVALID_EXPEDITION_INPUT",
          message: validation.error,
        },
      };
    }
    const validated = validation.data;

    try {
      // 1. Load current expedition state
      const current = await this.repository.getById(id);
      if (!current) {
        return {
          success: false,
          error: {
            code: "EXPEDITION_NOT_FOUND",
            message: `Expedition '${id}' not found or inaccessible.`,
          },
        };
      }

      // 2. Enforce state-specific field locks
      if (current.status === "ARCHIVED") {
        return {
          success: false,
          error: {
            code: "INVALID_EXPEDITION_STATE",
            message: "Archived expeditions are immutable and cannot be updated.",
          },
        };
      }

      if (
        current.status === "COMPLETED" ||
        current.status === "CANCELLED"
      ) {
        if (
          validated.name !== undefined ||
          validated.destination_station_id !== undefined ||
          validated.origin_station_id !== undefined ||
          validated.planned_start_at !== undefined ||
          validated.planned_end_at !== undefined
        ) {
          return {
            success: false,
            error: {
              code: "INVALID_EXPEDITION_STATE",
              message: `Only description may be updated on a ${current.status} expedition.`,
            },
          };
        }
      }

      if (current.status === "ACTIVE") {
        if (
          validated.destination_station_id !== undefined ||
          validated.origin_station_id !== undefined ||
          validated.planned_start_at !== undefined
        ) {
          return {
            success: false,
            error: {
              code: "INVALID_EXPEDITION_STATE",
              message:
                "Cannot modify route stations or planned start date while expedition is ACTIVE.",
            },
          };
        }
      }

      // 3. Validate station references if updated
      const stationRepo =
        this.stationRepository ?? new StationRepository(this.client);

      if (validated.destination_station_id !== undefined) {
        const dest = await stationRepo.getById(
          validated.destination_station_id
        );
        if (!dest) {
          return {
            success: false,
            error: {
              code: "STATION_NOT_FOUND",
              message: `Destination station '${validated.destination_station_id}' not found.`,
            },
          };
        }
        if (dest.status !== "ACTIVE") {
          return {
            success: false,
            error: {
              code: "INVALID_EXPEDITION_INPUT",
              message: `Destination station '${dest.code}' is not ACTIVE.`,
            },
          };
        }
      }

      if (validated.origin_station_id) {
        const orig = await stationRepo.getById(validated.origin_station_id);
        if (!orig) {
          return {
            success: false,
            error: {
              code: "STATION_NOT_FOUND",
              message: `Origin station '${validated.origin_station_id}' not found.`,
            },
          };
        }
      }

      // 4. Execute update
      const updated = await this.repository.updateMetadata(id, validated);
      if (!updated) {
        return {
          success: false,
          error: {
            code: "EXPEDITION_NOT_FOUND",
            message: `Expedition '${id}' not found or update unauthorized by RLS.`,
          },
        };
      }

      return {
        success: true,
        data: updated,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: "INFRASTRUCTURE_ERROR",
          message: `Failed to update expedition metadata: ${message}`,
        },
      };
    }
  }
}
