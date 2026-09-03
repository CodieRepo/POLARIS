import type { AssetRepository } from "../asset-repository";
import { AssetConflictError } from "../asset-repository";
import type { CreateAssetInput, AssetRow } from "../types/asset.types";
import type { UseCaseResult } from "@/core/errors/application-errors";
import { requireUserContext } from "@/infrastructure/auth/auth-context";
import type { UserContextResult } from "@/core/types/auth-context.types";
import { StationRepository } from "@/core/station/station-repository";
import { validateCreateAssetInput } from "../validation/asset-validation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/infrastructure/db/database.types";

/**
 * Use case: Provision a new physical asset in AVAILABLE status.
 *
 * Authorization:
 * - Restricted to COMMAND_ADMIN and SUPER_ADMIN roles.
 *
 * Lifecycle Rules:
 * - Assets ALWAYS initialize in AVAILABLE status (status is not caller-controlled).
 * - If station_id is supplied, the referenced station must exist and be ACTIVE.
 * - Database UNIQUE(asset_code) constraint provides race-safe conflict detection.
 */
export class CreateAssetUseCase {
  constructor(
    private readonly repository: AssetRepository,
    private readonly client?: SupabaseClient<Database>,
    private readonly stationRepository?: StationRepository,
    private readonly userContextResolver: () => Promise<UserContextResult> = requireUserContext
  ) {}

  /**
   * Executes asset provisioning workflow.
   *
   * @param input - Asset creation input contract.
   * @returns Discriminated union with AssetRow on success or typed ApplicationError on failure.
   */
  async execute(
    input: CreateAssetInput
  ): Promise<
    UseCaseResult<
      AssetRow,
      | "UNAUTHENTICATED"
      | "UNAUTHORIZED"
      | "ACCOUNT_DEACTIVATED"
      | "INVALID_ASSET_INPUT"
      | "STATION_NOT_FOUND"
      | "ASSET_ALREADY_EXISTS"
      | "INFRASTRUCTURE_ERROR"
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

    const { role } = authResult.data;

    if (role !== "SUPER_ADMIN" && role !== "COMMAND_ADMIN") {
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Only COMMAND_ADMIN and SUPER_ADMIN roles are authorized to provision assets.",
        },
      };
    }

    const validationError = validateCreateAssetInput(input);
    if (validationError) {
      return {
        success: false,
        error: {
          code: "INVALID_ASSET_INPUT",
          message: validationError,
        },
      };
    }

    // If station_id is specified, verify it exists and is ACTIVE
    if (input.station_id) {
      try {
        const stationRepo =
          this.stationRepository ??
          (this.client ? new StationRepository(this.client) : new StationRepository());
        const station = await stationRepo.getById(input.station_id);

        if (!station || station.status !== "ACTIVE") {
          return {
            success: false,
            error: {
              code: "STATION_NOT_FOUND",
              message: `Station '${input.station_id}' was not found or is not active.`,
            },
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          error: {
            code: "INFRASTRUCTURE_ERROR",
            message: `Failed to verify station '${input.station_id}': ${message}`,
          },
        };
      }
    }

    try {
      const asset = await this.repository.create(input);

      return {
        success: true,
        data: asset,
      };
    } catch (err) {
      if (err instanceof AssetConflictError) {
        return {
          success: false,
          error: {
            code: "ASSET_ALREADY_EXISTS",
            message: err.message,
          },
        };
      }

      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: "INFRASTRUCTURE_ERROR",
          message: `Failed to create asset: ${message}`,
        },
      };
    }
  }
}
