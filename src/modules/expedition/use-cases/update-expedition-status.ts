import type { UseCaseResult } from "@/core/errors/application-errors";
import type { UserContextResult } from "@/core/types/auth-context.types";
import { requireUserContext } from "@/infrastructure/auth/auth-context";
import { StationRepository } from "@/core/station/station-repository";
import {
  ExpeditionStateViolationError,
  type ExpeditionRepository,
} from "../expedition-repository";
import type {
  ExpeditionRow,
  UpdateExpeditionStatusInput,
} from "../types/expedition.types";
import {
  isValidIsoDate,
  isValidUuid,
  validateStatusTransition,
} from "../validation/expedition-validation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/infrastructure/db/database.types";

/**
 * Use case: Execute a lifecycle status transition for a polar expedition.
 *
 * Authorization:
 * - Administrators (SUPER_ADMIN, COMMAND_ADMIN): Can execute all valid transitions including ARCHIVED.
 * - Assigned EXPEDITION_MANAGER: Can transition assigned expeditions along operational lifecycle (DRAFT -> PLANNED -> ACTIVE -> COMPLETED / CANCELLED).
 * - Archiving is restricted to administrators.
 *
 * Concurrency & Integrity:
 * - Application pre-flight validation checks domain prerequisites.
 * - PostgreSQL BEFORE UPDATE trigger provides final authoritative defense-in-depth against invalid transitions.
 */
export class UpdateExpeditionStatusUseCase {
  constructor(
    private readonly repository: ExpeditionRepository,
    private readonly client: SupabaseClient<Database>,
    private readonly stationRepository?: StationRepository,
    private readonly userContextResolver: () => Promise<UserContextResult> = requireUserContext
  ) {}

  async execute(
    id: string,
    input: UpdateExpeditionStatusInput
  ): Promise<
    UseCaseResult<
      ExpeditionRow,
      | "UNAUTHENTICATED"
      | "UNAUTHORIZED"
      | "ACCOUNT_DEACTIVATED"
      | "EXPEDITION_NOT_FOUND"
      | "INVALID_EXPEDITION_INPUT"
      | "INVALID_EXPEDITION_STATE"
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
          message: "You do not have permission to transition expedition status.",
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

    if (!input || !input.targetStatus) {
      return {
        success: false,
        error: {
          code: "INVALID_EXPEDITION_INPUT",
          message: "Target status is required.",
        },
      };
    }

    // Role-specific transition restrictions
    if (
      input.targetStatus === "ARCHIVED" &&
      userRole !== "COMMAND_ADMIN" &&
      userRole !== "SUPER_ADMIN"
    ) {
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Only administrators may archive completed expeditions.",
        },
      };
    }

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

      // 2. Pre-flight transition validation
      const transitionValidation = validateStatusTransition(
        current.status,
        input.targetStatus
      );
      if (!transitionValidation.valid) {
        return {
          success: false,
          error: {
            code: "INVALID_EXPEDITION_STATE",
            message: transitionValidation.error,
          },
        };
      }

      const timestamps: {
        actual_start_at?: string | null;
        actual_end_at?: string | null;
      } = {};

      // 3. Validate lifecycle state prerequisites
      if (current.status === "DRAFT" && input.targetStatus === "PLANNED") {
        // Destination station must be active
        const stationRepo =
          this.stationRepository ?? new StationRepository(this.client);
        const dest = await stationRepo.getById(current.destination_station_id);
        if (!dest || dest.status !== "ACTIVE") {
          return {
            success: false,
            error: {
              code: "INVALID_EXPEDITION_STATE",
              message:
                "Expedition cannot transition to PLANNED because destination station is not ACTIVE.",
            },
          };
        }

        // Must have at least one active EXPEDITION_LEADER
        const members = await this.repository.getMembers(id);
        const hasActiveLeader = members.some(
          (m) => m.assignment_role === "EXPEDITION_LEADER" && m.left_at === null
        );
        if (!hasActiveLeader) {
          return {
            success: false,
            error: {
              code: "INVALID_EXPEDITION_STATE",
              message:
                "Expedition cannot transition to PLANNED without an active assigned EXPEDITION_LEADER.",
            },
          };
        }
      }

      if (current.status === "PLANNED" && input.targetStatus === "ACTIVE") {
        const startStr = input.actual_start_at ?? current.actual_start_at;
        if (!startStr || !isValidIsoDate(startStr)) {
          return {
            success: false,
            error: {
              code: "INVALID_EXPEDITION_INPUT",
              message:
                "A valid actual_start_at timestamp is required to activate an expedition.",
            },
          };
        }
        timestamps.actual_start_at = new Date(startStr).toISOString();
      }

      if (current.status === "ACTIVE" && input.targetStatus === "COMPLETED") {
        const endStr = input.actual_end_at;
        if (!endStr || !isValidIsoDate(endStr)) {
          return {
            success: false,
            error: {
              code: "INVALID_EXPEDITION_INPUT",
              message:
                "A valid actual_end_at timestamp is required to complete an expedition.",
            },
          };
        }

        const startStr = current.actual_start_at;
        if (!startStr || !isValidIsoDate(startStr)) {
          return {
            success: false,
            error: {
              code: "INVALID_EXPEDITION_STATE",
              message:
                "Cannot complete an expedition without an existing actual_start_at timestamp.",
            },
          };
        }

        const startMs = Date.parse(startStr);
        const endMs = Date.parse(endStr);
        if (endMs < startMs) {
          return {
            success: false,
            error: {
              code: "INVALID_EXPEDITION_INPUT",
              message: "actual_end_at must be after or equal to actual_start_at.",
            },
          };
        }
        timestamps.actual_end_at = new Date(endMs).toISOString();
      }

      // 4. Update status (subject to database-level trigger)
      const updated = await this.repository.updateStatus(
        id,
        input.targetStatus,
        timestamps
      );

      if (!updated) {
        return {
          success: false,
          error: {
            code: "EXPEDITION_NOT_FOUND",
            message: `Expedition '${id}' not found or transition unauthorized by RLS.`,
          },
        };
      }

      return {
        success: true,
        data: updated,
      };
    } catch (err) {
      if (err instanceof ExpeditionStateViolationError) {
        return {
          success: false,
          error: {
            code: "INVALID_EXPEDITION_STATE",
            message: err.message,
          },
        };
      }
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: "INFRASTRUCTURE_ERROR",
          message: `Failed to transition expedition status: ${message}`,
        },
      };
    }
  }
}
