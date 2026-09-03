import { createAuthenticatedServerClient } from "@/infrastructure/auth/supabase-auth-server";
import { AssetRepository } from "@/modules/asset/asset-repository";
import { AssignAssetUseCase } from "@/modules/asset/use-cases/assign-asset";
import { NextRequest, NextResponse } from "next/server";
import type { AssignAssetInput } from "@/modules/asset/types/asset.types";

/**
 * POST /api/assets/assign
 * Atomically executes the assign_asset workflow RPC.
 */
export async function POST(request: NextRequest) {
  try {
    const body: AssignAssetInput = await request.json();
    const supabase = await createAuthenticatedServerClient();
    const repository = new AssetRepository(supabase);
    const useCase = new AssignAssetUseCase(repository);

    const result = await useCase.execute(body);

    if (!result.success) {
      const statusMap: Record<string, number> = {
        UNAUTHENTICATED: 401,
        ACCOUNT_DEACTIVATED: 403,
        UNAUTHORIZED: 403,
        INVALID_ASSET_INPUT: 422,
        ASSET_NOT_FOUND: 404,
        ASSET_NOT_AVAILABLE: 409,
        ASSET_ALREADY_ASSIGNED: 409,
        ASSET_RETIRED: 400,
        STATION_NOT_FOUND: 404,
        EXPEDITION_NOT_FOUND: 404,
        INFRASTRUCTURE_ERROR: 500,
      };
      return NextResponse.json(
        { error: result.error.message, code: result.error.code },
        { status: statusMap[result.error.code] || 400 }
      );
    }

    return NextResponse.json({ data: result.data }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
