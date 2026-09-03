import type { AssetRepository } from "../asset-repository";
import type { AssetRow, UpdateAssetMetadataInput } from "../types/asset.types";
import type { UseCaseResult } from "@/core/errors/application-errors";
import { requireUserContext } from "@/infrastructure/auth/auth-context";
import type { UserContextResult } from "@/core/types/auth-context.types";
import { isValidUuid, validateUpdateAssetMetadataInput } from "../validation/asset-validation";

/**
 * Use case: Update descriptive metadata, physical condition, and operational criticality of an asset.
 *
 * Immutability Rules:
 * - `id`, `asset_code`, `data_classification`, and `station_id` are strictly immutable.
 * - General status transitions are rejected here.
 * - Special Retirement Rule: `status = 'RETIRED'` may ONLY be set by `SUPER_ADMIN`.
 * - Once an asset is `RETIRED`, all metadata mutations and reactivation attempts are permanently rejected.
 */
export class UpdateAssetMetadataUseCase {
  constructor(
    private readonly repository: AssetRepository,
    private readonly userContextResolver: () => Promise<UserContextResult> = requireUserContext
  ) {}

  /**
   * Executes asset metadata update workflow.
   *
   * @param assetId - Asset UUID.
   * @param input - Partial metadata fields to update.
   * @returns Discriminated union with updated AssetRow on success or typed ApplicationError on failure.
   */
  async execute(
    assetId: string,
    input: UpdateAssetMetadataInput
  ): Promise<
    UseCaseResult<
      AssetRow,
      | "UNAUTHENTICATED"
      | "UNAUTHORIZED"
      | "ACCOUNT_DEACTIVATED"
      | "INVALID_ASSET_INPUT"
      | "ASSET_NOT_FOUND"
      | "ASSET_RETIRED"
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

    const validationError = validateUpdateAssetMetadataInput(input);
    if (validationError) {
      return {
        success: false,
        error: {
          code: "INVALID_ASSET_INPUT",
          message: validationError,
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

    const { role } = authResult.data;

    // Evaluate special status transition rule
    if (input.status !== undefined) {
      if (input.status !== "RETIRED") {
        return {
          success: false,
          error: {
            code: "INVALID_ASSET_INPUT",
            message: "General status transitions are not supported in metadata updates. Only retirement to 'RETIRED' is permitted.",
          },
        };
      }

      if (role !== "SUPER_ADMIN") {
        return {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Only SUPER_ADMIN is authorized to retire assets.",
          },
        };
      }
    }

    try {
      const existingAsset = await this.repository.getById(normalizedId);

      if (!existingAsset) {
        return {
          success: false,
          error: {
            code: "ASSET_NOT_FOUND",
            message: `Asset with ID '${normalizedId}' not found.`,
          },
        };
      }

      // Terminal RETIRED protection
      if (existingAsset.status === "RETIRED") {
        return {
          success: false,
          error: {
            code: "ASSET_RETIRED",
            message: "Cannot update metadata or status for a permanently RETIRED asset.",
          },
        };
      }

      const updatedAsset = await this.repository.update(normalizedId, input);

      return {
        success: true,
        data: updatedAsset,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: "INFRASTRUCTURE_ERROR",
          message: `Failed to update asset '${normalizedId}': ${message}`,
        },
      };
    }
  }
}
