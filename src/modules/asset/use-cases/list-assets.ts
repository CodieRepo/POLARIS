import type { AssetRepository } from "../asset-repository";
import type { AssetListFilters, AssetRow } from "../types/asset.types";
import type { UseCaseResult } from "@/core/errors/application-errors";
import { requireUserContext } from "@/infrastructure/auth/auth-context";
import type { UserContextResult } from "@/core/types/auth-context.types";

/**
 * Use case: Retrieve a filtered list of physical assets.
 *
 * Responsibilities:
 * - Verify authenticated, active caller identity via UserContext.
 * - Delegate to AssetRepository with approved filter criteria.
 * - Return a deterministic, typed UseCaseResult discriminated union.
 */
export class ListAssetsUseCase {
  constructor(
    private readonly repository: AssetRepository,
    private readonly userContextResolver: () => Promise<UserContextResult> = requireUserContext
  ) {}

  /**
   * Executes filtered asset catalog listing.
   *
   * @param filters - Optional criteria: station_id, status, category, criticality.
   * @returns Discriminated union with AssetRow[] on success or typed ApplicationError on failure.
   */
  async execute(
    filters?: AssetListFilters
  ): Promise<
    UseCaseResult<
      AssetRow[],
      "UNAUTHENTICATED" | "ACCOUNT_DEACTIVATED" | "INFRASTRUCTURE_ERROR"
    >
  > {
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
      const assets = await this.repository.list(filters);

      return {
        success: true,
        data: assets,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: "INFRASTRUCTURE_ERROR",
          message: `Failed to list assets: ${message}`,
        },
      };
    }
  }
}
