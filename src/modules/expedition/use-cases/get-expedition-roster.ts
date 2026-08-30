import type { UseCaseResult } from "@/core/errors/application-errors";
import type { UserContextResult } from "@/core/types/auth-context.types";
import { requireUserContext } from "@/infrastructure/auth/auth-context";
import type { ExpeditionRepository } from "../expedition-repository";
import type {
  ExpeditionRosterMember,
  ExpeditionRosterPerson,
  GetExpeditionRosterFilters,
} from "../types/expedition.types";
import { isValidUuid } from "../validation/expedition-validation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/infrastructure/db/database.types";

/**
 * Explicit columns selected for the operational person profile embedded within a roster.
 * Strictly excludes auth_user_id.
 */
const ROSTER_PERSON_SELECT_COLUMNS =
  "id, display_name, role_title, organization, active" as const;

/**
 * Use case: Retrieve the personnel roster for an expedition.
 *
 * Privacy & Security Guarantees:
 * - Read visibility is available to all authenticated polar personnel.
 * - Embeds operational personnel profiles without leaking internal authentication identifiers (auth_user_id).
 * - Exposes full historical roster data while distinguishing active from departed members.
 */
export class GetExpeditionRosterUseCase {
  constructor(
    private readonly repository: ExpeditionRepository,
    private readonly client: SupabaseClient<Database>,
    private readonly userContextResolver: () => Promise<UserContextResult> = requireUserContext
  ) {}

  async execute(
    expeditionId: string,
    filters?: GetExpeditionRosterFilters
  ): Promise<
    UseCaseResult<
      ExpeditionRosterMember[],
      | "UNAUTHENTICATED"
      | "ACCOUNT_DEACTIVATED"
      | "PROFILE_NOT_FOUND"
      | "EXPEDITION_NOT_FOUND"
      | "INVALID_EXPEDITION_INPUT"
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

    if (!isValidUuid(expeditionId)) {
      return {
        success: false,
        error: {
          code: "INVALID_EXPEDITION_INPUT",
          message: "Expedition ID must be a valid UUID.",
        },
      };
    }

    try {
      // 1. Verify expedition exists
      const expedition = await this.repository.getById(expeditionId);
      if (!expedition) {
        return {
          success: false,
          error: {
            code: "EXPEDITION_NOT_FOUND",
            message: `Expedition '${expeditionId}' not found or inaccessible.`,
          },
        };
      }

      // 2. Fetch membership rows
      let query = this.client
        .from("expedition_members")
        .select("id, expedition_id, person_id, assignment_role, joined_at, left_at")
        .eq("expedition_id", expeditionId)
        .order("joined_at", { ascending: true });

      if (filters?.includeDeparted === false) {
        query = query.is("left_at", null);
      }

      const { data: memberRows, error: memberErr } = await query;

      if (memberErr) {
        return {
          success: false,
          error: {
            code: "INFRASTRUCTURE_ERROR",
            message: `Failed to fetch expedition members: ${memberErr.message}`,
          },
        };
      }

      if (!memberRows || memberRows.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      // 3. Fetch linked operational person records (safely omitting auth_user_id)
      const personIds = Array.from(
        new Set(memberRows.map((m) => m.person_id))
      );

      const { data: personRows, error: personErr } = await this.client
        .from("persons")
        .select(ROSTER_PERSON_SELECT_COLUMNS)
        .in("id", personIds);

      if (personErr) {
        return {
          success: false,
          error: {
            code: "INFRASTRUCTURE_ERROR",
            message: `Failed to fetch person profiles: ${personErr.message}`,
          },
        };
      }

      const personMap = new Map<string, ExpeditionRosterPerson>();
      for (const p of personRows ?? []) {
        personMap.set(p.id, {
          id: p.id,
          display_name: p.display_name,
          role_title: p.role_title,
          organization: p.organization,
          active: p.active,
        });
      }

      // 4. Assemble roster projection
      const roster: ExpeditionRosterMember[] = memberRows.map((m) => ({
        id: m.id,
        expedition_id: m.expedition_id,
        person_id: m.person_id,
        assignment_role: m.assignment_role,
        joined_at: m.joined_at,
        left_at: m.left_at,
        person: personMap.get(m.person_id) ?? null,
      }));

      return {
        success: true,
        data: roster,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: "INFRASTRUCTURE_ERROR",
          message: `Failed to retrieve expedition roster: ${message}`,
        },
      };
    }
  }
}
