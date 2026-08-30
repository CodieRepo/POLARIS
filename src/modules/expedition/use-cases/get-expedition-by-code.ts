import type { ExpeditionRepository } from "../expedition-repository";
import type { ExpeditionRow } from "../types/expedition.types";
import type { UseCaseResult } from "@/core/errors/application-errors";
import { requireUserContext } from "@/infrastructure/auth/auth-context";
import type { UserContextResult } from "@/core/types/auth-context.types";

/**
 * Use case: Retrieve a polar expedition by its unique alphanumeric code (e.g., 'EXP-01').
 *
 * Responsibilities:
 * - Validate/guard input string semantics.
 * - Verify authenticated, active caller identity via UserContext.
 * - Delegate to ExpeditionRepository for RLS-scoped data retrieval.
 * - Return a deterministic, typed UseCaseResult discriminated union.
 * - Prevent authorization / existence leakage by returning EXPEDITION_NOT_FOUND for missing or RLS-hidden records.
 */
export class GetExpeditionByCodeUseCase {
  constructor(
    private readonly repository: ExpeditionRepository,
    private readonly userContextResolver: () => Promise<UserContextResult> = requireUserContext
  ) {}

  /**
   * Executes the retrieval of an expedition by its code.
   *
   * @param code - The unique human-readable expedition code.
   * @returns Discriminated union with ExpeditionRow on success or typed ApplicationError on failure.
   */
  async execute(
    code: string
  ): Promise<
    UseCaseResult<
      ExpeditionRow,
      | "EXPEDITION_NOT_FOUND"
      | "UNAUTHENTICATED"
      | "ACCOUNT_DEACTIVATED"
      | "INFRASTRUCTURE_ERROR"
    >
  > {
    const normalizedCode = code?.trim();

    if (!normalizedCode) {
      return {
        success: false,
        error: {
          code: "EXPEDITION_NOT_FOUND",
          message: "Expedition code must be a non-empty string.",
        },
      };
    }

    const authResult = await this.userContextResolver();

    if (!authResult.success) {
      const authError = authResult.error;
      const mappedCode: "UNAUTHENTICATED" | "ACCOUNT_DEACTIVATED" | "INFRASTRUCTURE_ERROR" =
        authError.code === "ACCOUNT_DEACTIVATED"
          ? "ACCOUNT_DEACTIVATED"
          : authError.code === "INFRASTRUCTURE_ERROR"
            ? "INFRASTRUCTURE_ERROR"
            : "UNAUTHENTICATED";

      return {
        success: false,
        error: {
          code: mappedCode,
          message: authError.message,
        },
      };
    }

    try {
      const expedition = await this.repository.getByCode(normalizedCode);

      if (!expedition) {
        return {
          success: false,
          error: {
            code: "EXPEDITION_NOT_FOUND",
            message: `Expedition with code '${normalizedCode}' not found.`,
          },
        };
      }

      return {
        success: true,
        data: expedition,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: "INFRASTRUCTURE_ERROR",
          message: `Failed to retrieve expedition '${normalizedCode}': ${message}`,
        },
      };
    }
  }
}
