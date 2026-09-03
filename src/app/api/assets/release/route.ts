import { createAuthenticatedServerClient } from "@/infrastructure/auth/supabase-auth-server";
import { AssetRepository } from "@/modules/asset/asset-repository";
import { ReleaseAssetUseCase } from "@/modules/asset/use-cases/release-asset";
import { NextRequest, NextResponse } from "next/server";
import type { ReleaseAssetInput } from "@/modules/asset/types/asset.types";

/**
 * POST /api/assets/release
 * Atomically executes the release_asset_assignment workflow RPC.
 */
export async function POST(request: NextRequest) {
  try {
    const body: ReleaseAssetInput = await request.json();
    const supabase = await createAuthenticatedServerClient();
    const repository = new AssetRepository(supabase);
    const useCase = new ReleaseAssetUseCase(repository);

    const result = await useCase.execute(body.assignment_id);

    if (!result.success) {
      const statusMap: Record<string, number> = {
        UNAUTHENTICATED: 401,
        ACCOUNT_DEACTIVATED: 403,
        UNAUTHORIZED: 403,
        INVALID_ASSET_INPUT: 422,
        ASSIGNMENT_NOT_FOUND: 404,
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
