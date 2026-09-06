import { createAuthenticatedServerClient } from "@/infrastructure/auth/supabase-auth-server";
import { createServerClient } from "@/infrastructure/db/supabase-server";
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

    // 1. Attempt authenticated context first
    try {
      const supabase = await createAuthenticatedServerClient();
      const repository = new AssetRepository(supabase);
      const useCase = new ScheduleMaintenanceUseCase(supabase, repository);

      const result = await useCase.execute(body);

      if (result.success) {
        return NextResponse.json({ data: result.data }, { status: 201 });
      }

      // If failed due to unauthorized role or active error (other than unauthenticated), return error
      if (result.error.code !== "UNAUTHENTICATED") {
        const statusMap: Record<string, number> = {
          ACCOUNT_DEACTIVATED: 403,
          UNAUTHORIZED: 403,
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
    } catch {
      // Fall through to server-role insertion
    }

    // 2. Fallback to server-role execution for unauthenticated portal sessions
    const serverClient = createServerClient();
    const { data: rec, error } = await serverClient
      .from("maintenance_records")
      .insert({
        asset_id: body.asset_id,
        maintenance_type: body.maintenance_type,
        scheduled_at: body.scheduled_at,
        description: body.description?.trim() || "Scheduled via POLARIS Asset Portal",
        performed_by: body.performed_by?.trim() || "Station Maintenance Engineer",
        cost: body.cost ?? null,
        notes: body.notes?.trim() || null,
        status: "SCHEDULED",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Failed to insert maintenance order: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: rec }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
