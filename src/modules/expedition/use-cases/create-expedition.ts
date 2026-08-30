import type { UseCaseResult } from "@/core/errors/application-errors";
import type { UserContextResult } from "@/core/types/auth-context.types";
import { requireUserContext } from "@/infrastructure/auth/auth-context";
import { StationRepository } from "@/core/station/station-repository";
import {
  ExpeditionConflictError,
  type ExpeditionRepository,
} from "../expedition-repository";
import type {
  CreateExpeditionInput,
  ExpeditionRow,
} from "../types/expedition.types";
import { validateCreateExpeditionInput } from "../validation/expedition-validation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/infrastructure/db/database.types";

export interface CreateExpeditionResultData {
  readonly expedition: ExpeditionRow;
  readonly initialLeaderAssigned: boolean;
  readonly leaderAssignmentError?: string;
}

/**
 * Use case: Create a new polar expedition in DRAFT status.
 *
 * Authorization:
 * - Restricted to COMMAND_ADMIN and SUPER_ADMIN roles.
 *
 * Lifecycle & Atomicity:
 * - Always initializes in DRAFT status.
 * - If optional initial leader is provided, attempts leader assignment.
 * - If leader assignment fails, clearly reports partial creation state.
 */
export class CreateExpeditionUseCase {
  constructor(
    private readonly repository: ExpeditionRepository,
    private readonly client: SupabaseClient<Database>,
    private readonly stationRepository?: StationRepository,
    private readonly userContextResolver: () => Promise<UserContextResult> = requireUserContext
  ) {}

  async execute(
    input: CreateExpeditionInput
  ): Promise<
    UseCaseResult<
      CreateExpeditionResultData,
      | "UNAUTHENTICATED"
      | "UNAUTHORIZED"
      | "ACCOUNT_DEACTIVATED"
      | "INVALID_EXPEDITION_INPUT"
      | "STATION_NOT_FOUND"
      | "EXPEDITION_ALREADY_EXISTS"
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
    if (userRole !== "COMMAND_ADMIN" && userRole !== "SUPER_ADMIN") {
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Only administrators may create new polar expeditions.",
        },
      };
    }

    // 1. Pure format and bounds validation
    const validation = validateCreateExpeditionInput(input);
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

    // 2. Validate destination station existence and status
    const stationRepo =
      this.stationRepository ?? new StationRepository(this.client);
    try {
      const destStation = await stationRepo.getById(
        validated.destination_station_id
      );
      if (!destStation) {
        return {
          success: false,
          error: {
            code: "STATION_NOT_FOUND",
            message: `Destination station '${validated.destination_station_id}' not found.`,
          },
        };
      }
      if (destStation.status !== "ACTIVE") {
        return {
          success: false,
          error: {
            code: "INVALID_EXPEDITION_INPUT",
            message: `Destination station '${destStation.code}' is not ACTIVE.`,
          },
        };
      }

      // 3. Validate origin station if supplied
      if (validated.origin_station_id) {
        const originStation = await stationRepo.getById(
          validated.origin_station_id
        );
        if (!originStation) {
          return {
            success: false,
            error: {
              code: "STATION_NOT_FOUND",
              message: `Origin station '${validated.origin_station_id}' not found.`,
            },
          };
        }
      }

      // 4. Validate initial leader person if supplied
      if (validated.initial_leader_person_id) {
        const { data: person, error: personErr } = await this.client
          .from("persons")
          .select("id, active")
          .eq("id", validated.initial_leader_person_id)
          .maybeSingle();

        if (personErr) {
          return {
            success: false,
            error: {
              code: "INFRASTRUCTURE_ERROR",
              message: `Failed to verify initial leader: ${personErr.message}`,
            },
          };
        }

        if (!person || !person.active) {
          return {
            success: false,
            error: {
              code: "INVALID_EXPEDITION_INPUT",
              message: `Initial leader person '${validated.initial_leader_person_id}' not found or inactive.`,
            },
          };
        }
      }

      // 5. Create expedition record in DRAFT status
      const createdExpedition = await this.repository.create({
        code: validated.code,
        name: validated.name,
        description: validated.description,
        destination_station_id: validated.destination_station_id,
        origin_station_id: validated.origin_station_id,
        planned_start_at: validated.planned_start_at,
        planned_end_at: validated.planned_end_at,
        data_classification: validated.data_classification,
      });

      // 6. Assign initial leader if provided
      if (validated.initial_leader_person_id) {
        try {
          await this.repository.addMember({
            expedition_id: createdExpedition.id,
            person_id: validated.initial_leader_person_id,
            assignment_role: "EXPEDITION_LEADER",
          });
          return {
            success: true,
            data: {
              expedition: createdExpedition,
              initialLeaderAssigned: true,
            },
          };
        } catch (memberErr) {
          const msg =
            memberErr instanceof Error
              ? memberErr.message
              : String(memberErr);
          return {
            success: true,
            data: {
              expedition: createdExpedition,
              initialLeaderAssigned: false,
              leaderAssignmentError: `Expedition created in DRAFT status, but initial leader assignment failed: ${msg}`,
            },
          };
        }
      }

      return {
        success: true,
        data: {
          expedition: createdExpedition,
          initialLeaderAssigned: false,
        },
      };
    } catch (err) {
      if (err instanceof ExpeditionConflictError) {
        return {
          success: false,
          error: {
            code: "EXPEDITION_ALREADY_EXISTS",
            message: err.message,
          },
        };
      }
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: "INFRASTRUCTURE_ERROR",
          message: `Failed to create expedition: ${message}`,
        },
      };
    }
  }
}
