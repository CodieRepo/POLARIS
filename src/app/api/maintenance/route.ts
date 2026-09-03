import { createAuthenticatedServerClient } from "@/infrastructure/auth/supabase-auth-server";
import { AssetRepository } from "@/modules/asset/asset-repository";
import { ScheduleMaintenanceUseCase } from "@/modules/asset/use-cases/schedule-maintenance";
import { NextRequest, NextResponse } from "next/server";
import type { ScheduleMaintenanceInput } from "@/modules/asset/types/asset.types";

/**
 * POST /api/maintenance
 * Logs a new scheduled or corrective maintenance work order for an asset.
 */
export async function POST(request: NextRequest) {
  try {
    const body: ScheduleMaintenanceInput = await request.json();
    const supabase = await createAuthenticatedServerClient();
    const repository = new AssetRepository(supabase);
    const useCase = new ScheduleMaintenanceUseCase(supabase, repository);

    const result = await useCase.execute(body);

    if (!result.success) {
      const statusMap: Record<string, number> = {
        UNAUTHENTICATED: 401,
        UNAUTHORIZED: 403,
        ACCOUNT_DEACTIVATED: 403,
        INVALID_ASSET_INPUT: 422,
        ASSET_NOT_FOUND: 404,
        ASSET_RETIRED: 400,
        INFRASTRUCTURE_ERROR: 500,
      };
      return NextResponse.json(
        { error: result.error.message, code: result.error.code },
        { status: statusMap[result.error.code] || 400 }
      );
    }

    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
