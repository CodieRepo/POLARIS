import type { AssetRepository } from "../asset-repository";
import type { AssetRow } from "../types/asset.types";
import type { UseCaseResult } from "@/core/errors/application-errors";
import { requireUserContext } from "@/infrastructure/auth/auth-context";
import type { UserContextResult } from "@/core/types/auth-context.types";

/**
 * Use case: Retrieve a physical asset by its unique alphanumeric asset code (e.g., 'GEN-01').
 *
 * Responsibilities:
 * - Validate input code string semantics.
 * - Verify authenticated, active caller identity via UserContext.
 * - Delegate to AssetRepository for RLS-scoped data retrieval.
 * - Return a deterministic, typed UseCaseResult discriminated union.
 * - Prevent existence leakage by returning ASSET_NOT_FOUND for non-existent or RLS-hidden records.
 */
export class GetAssetByCodeUseCase {
  constructor(
    private readonly repository: AssetRepository,
    private readonly userContextResolver: () => Promise<UserContextResult> = requireUserContext
  ) {}

  /**
   * Executes asset retrieval by code.
   *
   * @param assetCode - Unique alphanumeric asset tag/code.
   * @returns Discriminated union with AssetRow on success or typed ApplicationError on failure.
   */
  async execute(
    assetCode: string
  ): Promise<
    UseCaseResult<
      AssetRow,
      | "ASSET_NOT_FOUND"
      | "UNAUTHENTICATED"
      | "ACCOUNT_DEACTIVATED"
      | "INFRASTRUCTURE_ERROR"
    >
  > {
    const normalizedCode = assetCode?.trim();

    if (!normalizedCode) {
      return {
        success: false,
        error: {
          code: "ASSET_NOT_FOUND",
          message: "Asset code must be a non-empty string.",
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
      const asset = await this.repository.getByCode(normalizedCode);

      if (!asset) {
        return {
          success: false,
          error: {
            code: "ASSET_NOT_FOUND",
            message: `Asset with code '${normalizedCode}' not found.`,
          },
        };
      }

      return {
        success: true,
        data: asset,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: "INFRASTRUCTURE_ERROR",
          message: `Failed to retrieve asset '${normalizedCode}': ${message}`,
        },
      };
    }
  }
}
