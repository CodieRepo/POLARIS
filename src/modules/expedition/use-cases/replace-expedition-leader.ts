import type { UseCaseResult } from "@/core/errors/application-errors";
import type { UserContextResult } from "@/core/types/auth-context.types";
import { requireUserContext } from "@/infrastructure/auth/auth-context";
import type { ExpeditionRepository } from "../expedition-repository";
import {
  ExpeditionConflictError,
  ExpeditionStateViolationError,
  UnauthorizedDatabaseError,
} from "../expedition-repository";
import type {
  ExpeditionMemberRow,
  ReplaceExpeditionLeaderInput,
} from "../types/expedition.types";
import { isValidUuid } from "../validation/expedition-validation";

/**
 * Use case: Atomically replace the operational leader of an active polar expedition.
 *
 * Security & Lifecycle Invariants:
 * - Restricted strictly to COMMAND_ADMIN and SUPER_ADMIN roles.
 * - Delegates all atomic concurrency control, locking, deactivation, and insertion
 *   to the PostgreSQL SECURITY DEFINER RPC `replace_expedition_leader`.
 * - Pure application boundary performing role validation, input sanitization, and error translation.
 */
export class ReplaceExpeditionLeaderUseCase {
  constructor(
    private readonly repository: ExpeditionRepository,
    private readonly userContextResolver: () => Promise<UserContextResult> = requireUserContext
  ) {}

  async execute(
    input: ReplaceExpeditionLeaderInput
  ): Promise<
    UseCaseResult<
      ExpeditionMemberRow,
      | "UNAUTHENTICATED"
      | "UNAUTHORIZED"
      | "ACCOUNT_DEACTIVATED"
      | "PROFILE_NOT_FOUND"
      | "EXPEDITION_NOT_FOUND"
      | "INVALID_EXPEDITION_INPUT"
      | "INVALID_EXPEDITION_STATE"
      | "EXPEDITION_MEMBER_NOT_FOUND"
      | "EXPEDITION_MEMBER_ALREADY_EXISTS"
      | "EXPEDITION_LEADER_REQUIRED"
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
              : authError.code === "PROFILE_NOT_FOUND"
                ? "PROFILE_NOT_FOUND"
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
          message:
            "Only administrators may replace operational expedition leaders.",
        },
      };
    }

    if (!isValidUuid(input?.expedition_id)) {
      return {
        success: false,
        error: {
          code: "INVALID_EXPEDITION_INPUT",
          message: "Expedition ID must be a valid UUID.",
        },
      };
    }

    if (!isValidUuid(input?.new_leader_person_id)) {
      return {
        success: false,
        error: {
          code: "INVALID_EXPEDITION_INPUT",
          message: "New leader person ID must be a valid UUID.",
        },
      };
    }

    try {
      const newLeader = await this.repository.callReplaceLeaderRpc(input);
      return {
        success: true,
        data: newLeader,
      };
    } catch (err) {
      if (err instanceof UnauthorizedDatabaseError) {
        return {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message:
              "Only administrators may replace operational expedition leaders.",
          },
        };
      }

      if (err instanceof ExpeditionConflictError) {
        return {
          success: false,
          error: {
            code: "EXPEDITION_MEMBER_ALREADY_EXISTS",
            message:
              "A membership conflict occurred during leader replacement.",
          },
        };
      }

      if (err instanceof ExpeditionStateViolationError) {
        const msg = err.message;
        if (msg.includes("No active leader found")) {
          return {
            success: false,
            error: {
              code: "EXPEDITION_LEADER_REQUIRED",
              message:
                "Cannot replace leader: target expedition does not currently have an active leader.",
            },
          };
        }

        if (
          msg.includes("is inactive") ||
          (msg.includes("Person") && msg.includes("not found"))
        ) {
          return {
            success: false,
            error: {
              code: "INVALID_EXPEDITION_INPUT",
              message: `Target person '${input.new_leader_person_id}' is inactive or does not exist.`,
            },
          };
        }

        if (msg.includes("already the active leader")) {
          return {
            success: false,
            error: {
              code: "INVALID_EXPEDITION_STATE",
              message:
                "Target person is already designated as the active leader of this expedition.",
            },
          };
        }

        if (msg.includes("not permitted on")) {
          return {
            success: false,
            error: {
              code: "INVALID_EXPEDITION_STATE",
              message: msg,
            },
          };
        }

        if (msg.includes("Expedition") && msg.includes("not found")) {
          return {
            success: false,
            error: {
              code: "EXPEDITION_NOT_FOUND",
              message: `Expedition '${input.expedition_id}' was not found or is inaccessible.`,
            },
          };
        }

        return {
          success: false,
          error: {
            code: "INVALID_EXPEDITION_STATE",
            message: msg,
          },
        };
      }

      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: "INFRASTRUCTURE_ERROR",
          message: `Failed to replace expedition leader: ${message}`,
        },
      };
    }
  }
}
