import type { UseCaseResult } from "@/core/errors/application-errors";
import type { UserContextResult } from "@/core/types/auth-context.types";
import { requireUserContext } from "@/infrastructure/auth/auth-context";
import type { ExpeditionRepository } from "../expedition-repository";
import type {
  AddExpeditionMemberInput,
  ExpeditionMemberRow,
} from "../types/expedition.types";
import { isValidUuid } from "../validation/expedition-validation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/infrastructure/db/database.types";
import { ExpeditionConflictError } from "../expedition-repository";

/**
 * Use case: Add an active personnel assignment to an expedition roster.
 *
 * Authorization:
 * - COMMAND_ADMIN and SUPER_ADMIN have global roster management privileges.
 * - EXPEDITION_MANAGER may manage rosters only within actively assigned expeditions (enforced by RLS).
 * - Direct assignment of EXPEDITION_LEADER is rejected in favor of dedicated leader workflows.
 */
export class AddExpeditionMemberUseCase {
  constructor(
    private readonly repository: ExpeditionRepository,
    private readonly client: SupabaseClient<Database>,
    private readonly userContextResolver: () => Promise<UserContextResult> = requireUserContext
  ) {}

  async execute(
    input: AddExpeditionMemberInput
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
      | "EXPEDITION_MEMBER_ALREADY_EXISTS"
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
            "Only administrators and assigned expedition managers may add members to an expedition roster.",
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

    if (input.assignment_role === "EXPEDITION_LEADER") {
      return {
        success: false,
        error: {
          code: "INVALID_EXPEDITION_STATE",
          message:
            "Operational leadership must be assigned via dedicated leader workflows.",
        },
      };
    }

    if (
      input.assignment_role !== "EXPEDITION_MEMBER"
    ) {
      return {
        success: false,
        error: {
          code: "INVALID_EXPEDITION_INPUT",
          message: `Invalid assignment role: '${input.assignment_role}'.`,
        },
      };
    }

    try {
      // 1. Verify expedition exists and status allows roster mutations
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

      // 2. Verify target person exists and active=true
      const { data: person, error: personErr } = await this.client
        .from("persons")
        .select("id, active")
        .eq("id", input.person_id)
        .maybeSingle();

      if (personErr) {
        return {
          success: false,
          error: {
            code: "INFRASTRUCTURE_ERROR",
            message: `Failed to verify person: ${personErr.message}`,
          },
        };
      }

      if (!person || !person.active) {
        return {
          success: false,
          error: {
            code: "INVALID_EXPEDITION_INPUT",
            message: `Target person '${input.person_id}' is inactive or does not exist.`,
          },
        };
      }

      // 3. Inspect existing membership record for this expedition and person
      const { data: existingRow, error: memErr } = await this.client
        .from("expedition_members")
        .select("id, left_at")
        .eq("expedition_id", input.expedition_id)
        .eq("person_id", input.person_id)
        .maybeSingle();

      if (memErr) {
        return {
          success: false,
          error: {
            code: "INFRASTRUCTURE_ERROR",
            message: `Failed to inspect membership: ${memErr.message}`,
          },
        };
      }

      if (existingRow) {
        if (existingRow.left_at === null) {
          return {
            success: false,
            error: {
              code: "EXPEDITION_MEMBER_ALREADY_EXISTS",
              message: `Person '${input.person_id}' is already an active member of expedition '${expedition.code}'.`,
            },
          };
        }

        // Rejoin departed member: clear left_at and update joined_at and role
        const rejoined = await this.repository.updateMember(
          input.expedition_id,
          input.person_id,
          {
            left_at: null,
            joined_at: input.joined_at ?? new Date().toISOString(),
            assignment_role: input.assignment_role,
          }
        );

        if (!rejoined) {
          return {
            success: false,
            error: {
              code: "INFRASTRUCTURE_ERROR",
              message: `Failed to rejoin member '${input.person_id}'.`,
            },
          };
        }

        return {
          success: true,
          data: rejoined,
        };
      }

      // 4. Fresh membership row insertion
      const member = await this.repository.addMember({
        expedition_id: input.expedition_id,
        person_id: input.person_id,
        assignment_role: input.assignment_role,
        joined_at: input.joined_at,
      });

      return {
        success: true,
        data: member,
      };
    } catch (err) {
      if (err instanceof ExpeditionConflictError) {
        return {
          success: false,
          error: {
            code: "EXPEDITION_MEMBER_ALREADY_EXISTS",
            message: `Person '${input.person_id}' is already an active member of this expedition.`,
          },
        };
      }

      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("violates row-level security")) {
        return {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message:
              "You do not have permission to add members to this expedition roster.",
          },
        };
      }

      return {
        success: false,
        error: {
          code: "INFRASTRUCTURE_ERROR",
          message: `Failed to add expedition member: ${message}`,
        },
      };
    }
  }
}
