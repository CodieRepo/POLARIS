import type { AssetRepository } from "../asset-repository";
import type { AssetHistory } from "../types/asset.types";
import type { UseCaseResult } from "@/core/errors/application-errors";
import { requireUserContext } from "@/infrastructure/auth/auth-context";
import type { UserContextResult } from "@/core/types/auth-context.types";
import { isValidUuid } from "../validation/asset-validation";

/**
 * Use case: Retrieve complete lifecycle history for a physical asset.
 *
 * Aggregates:
 * - Current asset record
 * - Complete deployment assignment history (both active and released)
 * - Complete maintenance servicing history
 *
 * Responsibilities:
 * - Validate UUID format.
 * - Verify authenticated, active caller identity via UserContext.
 * - Return consolidated historical projection without mutating state.
 * - Return ASSET_NOT_FOUND if asset does not exist or is hidden by RLS.
 */
export class GetAssetHistoryUseCase {
  constructor(
    private readonly repository: AssetRepository,
    private readonly userContextResolver: () => Promise<UserContextResult> = requireUserContext
  ) {}

  /**
   * Executes historical retrieval for an asset.
   *
   * @param assetId - Asset UUID.
   * @returns Discriminated union with AssetHistory on success or typed ApplicationError on failure.
   */
  async execute(
    assetId: string
  ): Promise<
    UseCaseResult<
      AssetHistory,
      | "ASSET_NOT_FOUND"
      | "INVALID_ASSET_INPUT"
      | "UNAUTHENTICATED"
      | "ACCOUNT_DEACTIVATED"
      | "INFRASTRUCTURE_ERROR"
    >
  > {
    const normalizedId = assetId?.trim();

    if (!normalizedId || !isValidUuid(normalizedId)) {
      return {
        success: false,
        error: {
          code: "INVALID_ASSET_INPUT",
          message: "A valid asset UUID is required.",
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
      const asset = await this.repository.getById(normalizedId);

      if (!asset) {
        return {
          success: false,
          error: {
            code: "ASSET_NOT_FOUND",
            message: `Asset with ID '${normalizedId}' not found.`,
          },
        };
      }

      const [assignments, maintenance] = await Promise.all([
        this.repository.getAssignmentHistory(normalizedId),
        this.repository.getMaintenanceHistory(normalizedId),
      ]);

      return {
        success: true,
        data: {
          asset,
          assignments,
          maintenance,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: "INFRASTRUCTURE_ERROR",
          message: `Failed to retrieve history for asset '${normalizedId}': ${message}`,
        },
      };
    }
  }
}
