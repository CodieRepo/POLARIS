import type { UseCaseResult } from "@/core/errors/application-errors";
import type { UserContextResult } from "@/core/types/auth-context.types";
import { requireUserContext } from "@/infrastructure/auth/auth-context";
import type { ExpeditionRepository } from "../expedition-repository";
import type {
  ExpeditionMemberRow,
  UpdateMemberRoleInput,
} from "../types/expedition.types";
import { isValidUuid } from "../validation/expedition-validation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/infrastructure/db/database.types";

/**
 * Use case: Update an active expedition member's operational role.
 *
 * Invariants:
 * - Direct promotion to EXPEDITION_LEADER is strictly forbidden (must use dedicated leader workflows).
 * - Direct demotion of an active EXPEDITION_LEADER is strictly forbidden (must use dedicated leader replacement).
 * - EXPEDITION_MANAGER cannot modify their own role.
 */
export class UpdateMemberRoleUseCase {
  constructor(
    private readonly repository: ExpeditionRepository,
    private readonly client: SupabaseClient<Database>,
    private readonly userContextResolver: () => Promise<UserContextResult> = requireUserContext
  ) {}

  async execute(
    input: UpdateMemberRoleInput
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
            "Only administrators and assigned expedition managers may update member roles.",
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

    if (input.new_role === "EXPEDITION_LEADER") {
      return {
        success: false,
        error: {
          code: "INVALID_EXPEDITION_STATE",
          message:
            "Operational leadership cannot be assigned via role updates. Use dedicated leader workflows.",
        },
      };
    }

    if (input.new_role !== "EXPEDITION_MEMBER") {
      return {
        success: false,
        error: {
          code: "INVALID_EXPEDITION_INPUT",
          message: `Invalid operational role: '${input.new_role}'.`,
        },
      };
    }

    try {
      // 1. Verify expedition exists and status allows roster mutation
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

      // 3. Prohibit demoting an active leader via generic role update
      if (activeMember.assignment_role === "EXPEDITION_LEADER") {
        return {
          success: false,
          error: {
            code: "INVALID_EXPEDITION_STATE",
            message:
              "Active leader cannot be demoted via role update. Use dedicated leader replacement.",
          },
        };
      }

      // 4. Prohibit manager self-modification
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
                "Expedition managers cannot modify their own operational role.",
            },
          };
        }
      }

      // 5. Update role
      const updatedMember = await this.repository.updateMember(
        input.expedition_id,
        input.person_id,
        {
          assignment_role: input.new_role,
        }
      );

      if (!updatedMember) {
        return {
          success: false,
          error: {
            code: "EXPEDITION_MEMBER_NOT_FOUND",
            message: `Failed to update member '${input.person_id}'.`,
          },
        };
      }

      return {
        success: true,
        data: updatedMember,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("violates row-level security")) {
        return {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message:
              "You do not have permission to update member roles on this expedition.",
          },
        };
      }

      return {
        success: false,
        error: {
          code: "INFRASTRUCTURE_ERROR",
          message: `Failed to update member role: ${message}`,
        },
      };
    }
  }
}
