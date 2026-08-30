import type { UseCaseResult } from "@/core/errors/application-errors";
import type { UserContextResult } from "@/core/types/auth-context.types";
import { requireUserContext } from "@/infrastructure/auth/auth-context";
import type { ExpeditionRepository } from "../expedition-repository";
import type {
  ExpeditionMemberRow,
  RemoveExpeditionMemberInput,
} from "../types/expedition.types";
import { isValidUuid } from "../validation/expedition-validation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/infrastructure/db/database.types";

/**
 * Use case: Soft-remove a personnel assignment from an active expedition roster (setting left_at = now()).
 *
 * Security & Lifecycle Invariants:
 * - Preserves historical roster audit trails without physical row deletion.
 * - Prevents removal of the last active leader on PLANNED and ACTIVE expeditions.
 * - Restricts self-removal by EXPEDITION_MANAGER to prevent privilege revocation orphaning.
 */
export class RemoveExpeditionMemberUseCase {
  constructor(
    private readonly repository: ExpeditionRepository,
    private readonly client: SupabaseClient<Database>,
    private readonly userContextResolver: () => Promise<UserContextResult> = requireUserContext
  ) {}

  async execute(
    input: RemoveExpeditionMemberInput
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
    if (
      userRole !== "COMMAND_ADMIN" &&
      userRole !== "SUPER_ADMIN" &&
      userRole !== "EXPEDITION_MANAGER"
    ) {
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message:
            "Only administrators and assigned expedition managers may remove members from an expedition roster.",
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

    if (!isValidUuid(input?.person_id)) {
      return {
        success: false,
        error: {
          code: "INVALID_EXPEDITION_INPUT",
          message: "Person ID must be a valid UUID.",
        },
      };
    }

    try {
      // 1. Verify expedition exists and status is mutable
      const expedition = await this.repository.getById(input.expedition_id);
      if (!expedition) {
        return {
          success: false,
          error: {
            code: "EXPEDITION_NOT_FOUND",
            message: `Expedition '${input.expedition_id}' not found or inaccessible.`,
          },
        };
      }

      if (
        expedition.status !== "DRAFT" &&
        expedition.status !== "PLANNED" &&
        expedition.status !== "ACTIVE"
      ) {
        return {
          success: false,
          error: {
            code: "INVALID_EXPEDITION_STATE",
            message: `Roster mutations are not permitted on ${expedition.status} expeditions.`,
          },
        };
      }

      // 2. Fetch active member
      const activeMember = await this.repository.getActiveMember(
        input.expedition_id,
        input.person_id
      );

      if (!activeMember) {
        return {
          success: false,
          error: {
            code: "EXPEDITION_MEMBER_NOT_FOUND",
            message: `Person '${input.person_id}' is not an active member of expedition '${expedition.code}'.`,
          },
        };
      }

      // 3. Prevent manager self-removal
      if (userRole === "EXPEDITION_MANAGER") {
        const { data: targetPerson, error: pErr } = await this.client
          .from("persons")
          .select("auth_user_id")
          .eq("id", input.person_id)
          .maybeSingle();

        if (pErr) {
          return {
            success: false,
            error: {
              code: "INFRASTRUCTURE_ERROR",
              message: `Failed to inspect person: ${pErr.message}`,
            },
          };
        }

        if (
          (authResult.data.personId && input.person_id === authResult.data.personId) ||
          targetPerson?.auth_user_id === authResult.data.userId
        ) {
          return {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message:
                "Expedition managers cannot remove themselves from the roster.",
            },
          };
        }
      }

      // 4. Last active leader protection
      if (activeMember.assignment_role === "EXPEDITION_LEADER") {
        if (expedition.status === "PLANNED" || expedition.status === "ACTIVE") {
          return {
            success: false,
            error: {
              code: "EXPEDITION_LEADER_REQUIRED",
              message: `Cannot remove the active leader from an expedition in ${expedition.status} status without replacement.`,
            },
          };
        }
      }

      // 5. Execute soft removal
      const removedMember = await this.repository.removeMember(
        input.expedition_id,
        input.person_id
      );

      if (!removedMember) {
        return {
          success: false,
          error: {
            code: "EXPEDITION_MEMBER_NOT_FOUND",
            message: `Failed to remove member '${input.person_id}': record was not found or already departed.`,
          },
        };
      }

      return {
        success: true,
        data: removedMember,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("violates row-level security")) {
        return {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message:
              "You do not have permission to remove members from this expedition roster.",
          },
        };
      }

      return {
        success: false,
        error: {
          code: "INFRASTRUCTURE_ERROR",
          message: `Failed to remove expedition member: ${message}`,
        },
      };
    }
  }
}
