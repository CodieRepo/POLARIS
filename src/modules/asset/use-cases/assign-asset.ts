import type { AssetRepository } from "../asset-repository";
import { AssetWorkflowError } from "../asset-repository";
import type { AssetAssignmentRow, AssignAssetInput } from "../types/asset.types";
import type { UseCaseResult } from "@/core/errors/application-errors";
import { requireUserContext } from "@/infrastructure/auth/auth-context";
import type { UserContextResult } from "@/core/types/auth-context.types";
import { validateAssignAssetInput } from "../validation/asset-validation";

/**
 * Use case: Atomically assign an AVAILABLE asset to a station or expedition.
 *
 * Authorization:
 * - SUPER_ADMIN, COMMAND_ADMIN: may assign to any station or expedition.
 * - EXPEDITION_MANAGER: may assign to their managed expedition only.
 * - Database RPC enforces authorization independently via is_admin() / is_expedition_manager_for().
 *
 * Lifecycle Rules:
 * - Asset must be in AVAILABLE status (enforced by database RPC).
 * - Partial unique index prevents duplicate active assignments (database constraint).
 * - Asset status transitions to ASSIGNED via trusted workflow signal.
 * - Station_id updates atomically for STATION_DEPLOYMENT assignments.
 * - All steps execute in a single PostgreSQL transaction with row-level locking.
 */
export class AssignAssetUseCase {
  constructor(
    private readonly repository: AssetRepository,
    private readonly userContextResolver: () => Promise<UserContextResult> = requireUserContext
  ) {}

  /**
   * Executes atomic asset assignment workflow.
   *
   * @param input - Assignment input contract.
   * @returns Discriminated union with AssetAssignmentRow on success or typed ApplicationError on failure.
   */
  async execute(
    input: AssignAssetInput
  ): Promise<
    UseCaseResult<
      AssetAssignmentRow,
      | "UNAUTHENTICATED"
      | "UNAUTHORIZED"
      | "ACCOUNT_DEACTIVATED"
      | "INVALID_ASSET_INPUT"
      | "ASSET_NOT_FOUND"
      | "ASSET_NOT_AVAILABLE"
      | "ASSET_ALREADY_ASSIGNED"
      | "ASSET_RETIRED"
      | "STATION_NOT_FOUND"
      | "EXPEDITION_NOT_FOUND"
      | "INFRASTRUCTURE_ERROR"
    >
  > {
    // 1. Authenticate caller
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

    // 2. Validate input
    const validationError = validateAssignAssetInput(input);
    if (validationError) {
      return {
        success: false,
        error: {
          code: "INVALID_ASSET_INPUT",
          message: validationError,
        },
      };
    }

    // 3. Execute atomic assignment via database RPC
    try {
      const assignment = await this.repository.assignAsset(input);

      return {
        success: true,
        data: assignment,
      };
    } catch (err) {
      // Map PostgreSQL RPC errors to application error codes
      if (err instanceof AssetWorkflowError) {
        const msg = err.message.toLowerCase();

        if (msg.includes("not found") && msg.includes("asset")) {
          return { success: false, error: { code: "ASSET_NOT_FOUND", message: err.message } };
        }
        if (msg.includes("retired")) {
          return { success: false, error: { code: "ASSET_RETIRED", message: err.message } };
        }
        if (msg.includes("not available")) {
          return { success: false, error: { code: "ASSET_NOT_AVAILABLE", message: err.message } };
        }
        if (msg.includes("station") && msg.includes("not found")) {
          return { success: false, error: { code: "STATION_NOT_FOUND", message: err.message } };
        }
        if (msg.includes("expedition") && msg.includes("not found")) {
          return { success: false, error: { code: "EXPEDITION_NOT_FOUND", message: err.message } };
        }
        if (err.pgCode === "42501") {
          return { success: false, error: { code: "UNAUTHORIZED", message: err.message } };
        }
        if (err.pgCode === "23505") {
          return { success: false, error: { code: "ASSET_ALREADY_ASSIGNED", message: "Asset already has an active assignment." } };
        }

        return { success: false, error: { code: "INFRASTRUCTURE_ERROR", message: err.message } };
      }

      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: "INFRASTRUCTURE_ERROR",
          message: `Failed to assign asset: ${message}`,
        },
      };
    }
  }
}
