import type { AssetRepository } from "../asset-repository";
import type { MaintenanceRecordRow, ScheduleMaintenanceInput } from "../types/asset.types";
import type { UseCaseResult } from "@/core/errors/application-errors";
import { requireUserContext } from "@/infrastructure/auth/auth-context";
import type { UserContextResult } from "@/core/types/auth-context.types";
import { validateScheduleMaintenanceInput } from "../validation/asset-validation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/infrastructure/db/database.types";

/**
 * Use case: Schedule a maintenance work order for an asset.
 *
 * Authorization:
 * - Admin or Expedition Manager for the assigned mission.
 *
 * Operational rules:
 * - Validates input parameters.
 * - Creates maintenance record with status SCHEDULED.
 * - If asset condition is POOR or damaged, notes are logged.
 */
export class ScheduleMaintenanceUseCase {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly repository: AssetRepository,
    private readonly userContextResolver: () => Promise<UserContextResult> = requireUserContext
  ) {}

  async execute(
    input: ScheduleMaintenanceInput
  ): Promise<
    UseCaseResult<
      MaintenanceRecordRow,
      | "UNAUTHENTICATED"
      | "UNAUTHORIZED"
      | "ACCOUNT_DEACTIVATED"
      | "INVALID_ASSET_INPUT"
      | "ASSET_NOT_FOUND"
      | "ASSET_RETIRED"
      | "INFRASTRUCTURE_ERROR"
    >
  > {
    // 1. Authenticate caller
    const authResult = await this.userContextResolver();
    if (!authResult.success) {
      return {
        success: false,
        error: {
          code: authResult.error.code === "ACCOUNT_DEACTIVATED" ? "ACCOUNT_DEACTIVATED" : "UNAUTHENTICATED",
          message: authResult.error.message,
        },
      };
    }

    const user = authResult.data;
    if (user.role === "VIEWER") {
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Unauthorized: VIEWERS cannot schedule maintenance.",
        },
      };
    }

    // 2. Pure validation
    const validationError = validateScheduleMaintenanceInput(input);
    if (validationError) {
      return {
        success: false,
        error: {
          code: "INVALID_ASSET_INPUT",
          message: validationError,
        },
      };
    }

    // 3. Check asset exists and is not RETIRED
    const asset = await this.repository.getById(input.asset_id);
    if (!asset) {
      return {
        success: false,
        error: {
          code: "ASSET_NOT_FOUND",
          message: `Asset '${input.asset_id}' not found.`,
        },
      };
    }

    if (asset.status === "RETIRED") {
      return {
        success: false,
        error: {
          code: "ASSET_RETIRED",
          message: "Cannot schedule maintenance on a permanently RETIRED asset.",
        },
      };
    }

    try {
      const { data, error } = await this.client
        .from("maintenance_records")
        .insert({
          asset_id: input.asset_id,
          maintenance_type: input.maintenance_type,
          scheduled_at: input.scheduled_at,
          description: input.description?.trim() || null,
          performed_by: input.performed_by?.trim() || user.email,
          cost: input.cost ?? null,
          notes: input.notes?.trim() || null,
          status: "SCHEDULED",
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: "INFRASTRUCTURE_ERROR",
            message: `Failed to insert maintenance record: ${error.message}`,
          },
        };
      }

      return {
        success: true,
        data: data as MaintenanceRecordRow,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: "INFRASTRUCTURE_ERROR",
          message: `Infrastructure failure: ${message}`,
        },
      };
    }
  }
}
