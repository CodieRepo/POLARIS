import type { UseCaseResult } from "@/core/errors/application-errors";
import type { UserContextResult } from "@/core/types/auth-context.types";
import { requireUserContext } from "@/infrastructure/auth/auth-context";
import type { ExpeditionRepository } from "../expedition-repository";
import type { ExpeditionMemberRow } from "../types/expedition.types";
import { isValidUuid } from "../validation/expedition-validation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/infrastructure/db/database.types";

export interface AssignExpeditionLeaderInput {
  readonly expedition_id: string;
  readonly person_id: string;
}

/**
 * Use case: Assign an initial operational leader to a DRAFT expedition.
 *
 * Authorization:
 * - Restricted to COMMAND_ADMIN and SUPER_ADMIN roles.
 * - Prevents self-bootstrap privilege escalation.
 */
export class AssignExpeditionLeaderUseCase {
  constructor(
    private readonly repository: ExpeditionRepository,
    private readonly client: SupabaseClient<Database>,
    private readonly userContextResolver: () => Promise<UserContextResult> = requireUserContext
  ) {}

  async execute(
    input: AssignExpeditionLeaderInput
  ): Promise<
    UseCaseResult<
      ExpeditionMemberRow,
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
    if (userRole !== "COMMAND_ADMIN" && userRole !== "SUPER_ADMIN") {
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message:
            "Only administrators may assign operational expedition leaders.",
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
      // 1. Verify expedition exists
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

      // 2. Only allow leader assignment while in DRAFT status
      if (expedition.status !== "DRAFT") {
        return {
          success: false,
          error: {
            code: "INVALID_EXPEDITION_STATE",
            message: `Initial leader can only be designated while expedition is in DRAFT status (current: '${expedition.status}').`,
          },
        };
      }

      // 3. Verify person exists and is active
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
            message: `Target person '${input.person_id}' not found or inactive.`,
          },
        };
      }

      // 4. Verify no active leader already assigned
      const existingMembers = await this.repository.getMembers(
        input.expedition_id
      );
      const hasActiveLeader = existingMembers.some(
        (m) => m.assignment_role === "EXPEDITION_LEADER" && m.left_at === null
      );

      if (hasActiveLeader) {
        return {
          success: false,
          error: {
            code: "INVALID_EXPEDITION_STATE",
            message: `Expedition '${expedition.code}' already has an assigned active leader.`,
          },
        };
      }

      // 5. Insert member record
      const member = await this.repository.addMember({
        expedition_id: input.expedition_id,
        person_id: input.person_id,
        assignment_role: "EXPEDITION_LEADER",
      });

      return {
        success: true,
        data: member,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: "INFRASTRUCTURE_ERROR",
          message: `Failed to assign expedition leader: ${message}`,
        },
      };
    }
  }
}
