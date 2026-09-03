import type { AssetRepository } from "../asset-repository";
import { AssetWorkflowError } from "../asset-repository";
import type { AssetAssignmentRow } from "../types/asset.types";
import type { UseCaseResult } from "@/core/errors/application-errors";
import { requireUserContext } from "@/infrastructure/auth/auth-context";
import type { UserContextResult } from "@/core/types/auth-context.types";
import { isValidUuid } from "../validation/asset-validation";

/**
 * Use case: Atomically release an active asset assignment.
 *
 * Authorization:
 * - SUPER_ADMIN, COMMAND_ADMIN: may release any assignment.
 * - EXPEDITION_MANAGER: may release assignments to their managed expedition.
 * - Database RPC enforces authorization independently via is_admin() / is_expedition_manager_for().
 *
 * Lifecycle Rules:
 * - Assignment must be active (released_at IS NULL) — enforced by database RPC.
 * - Asset status transitions back to AVAILABLE via trusted workflow signal.
 * - Assignment released_at is set to now().
 * - Station_id is preserved (asset stays at its current physical location).
 * - All steps execute in a single PostgreSQL transaction with row-level locking.
 */
export class ReleaseAssetUseCase {
  constructor(
    private readonly repository: AssetRepository,
    private readonly userContextResolver: () => Promise<UserContextResult> = requireUserContext
  ) {}

  /**
   * Executes atomic asset release workflow.
   *
   * @param assignmentId - UUID of the active assignment to release.
   * @returns Discriminated union with closed AssetAssignmentRow on success or typed ApplicationError on failure.
   */
  async execute(
    assignmentId: string
  ): Promise<
    UseCaseResult<
      AssetAssignmentRow,
      | "UNAUTHENTICATED"
      | "UNAUTHORIZED"
      | "ACCOUNT_DEACTIVATED"
      | "INVALID_ASSET_INPUT"
      | "ASSIGNMENT_NOT_FOUND"
      | "INFRASTRUCTURE_ERROR"
    >
  > {
    // 1. Validate input
    const normalizedId = assignmentId?.trim();

    if (!normalizedId || !isValidUuid(normalizedId)) {
      return {
        success: false,
        error: {
          code: "INVALID_ASSET_INPUT",
          message: "A valid assignment UUID is required.",
        },
      };
    }

    // 2. Authenticate caller
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

    // 3. Execute atomic release via database RPC
    try {
      const assignment = await this.repository.releaseAssignment(normalizedId);

      return {
        success: true,
        data: assignment,
      };
    } catch (err) {
      // Map PostgreSQL RPC errors to application error codes
      if (err instanceof AssetWorkflowError) {
        const msg = err.message.toLowerCase();

        if (msg.includes("not found")) {
          return { success: false, error: { code: "ASSIGNMENT_NOT_FOUND", message: err.message } };
        }
        if (msg.includes("already been released")) {
          return { success: false, error: { code: "ASSIGNMENT_NOT_FOUND", message: err.message } };
        }
        if (err.pgCode === "42501") {
          return { success: false, error: { code: "UNAUTHORIZED", message: err.message } };
        }

        return { success: false, error: { code: "INFRASTRUCTURE_ERROR", message: err.message } };
      }

      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: "INFRASTRUCTURE_ERROR",
          message: `Failed to release assignment: ${message}`,
        },
      };
    }
  }
}
