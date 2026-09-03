import { createAuthenticatedServerClient } from "@/infrastructure/auth/supabase-auth-server";
import { createServerClient } from "@/infrastructure/db/supabase-server";
import { AssetRepository } from "@/modules/asset/asset-repository";
import { GetAssetByCodeUseCase } from "@/modules/asset/use-cases/get-asset-by-code";
import { GetAssetHistoryUseCase } from "@/modules/asset/use-cases/get-asset-history";
import { UpdateAssetMetadataUseCase } from "@/modules/asset/use-cases/update-asset-metadata";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/assets/[code]
 * Returns asset details or full history if ?history=true.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get("history") === "true";

    // Attempt authenticated context first
    try {
      const supabase = await createAuthenticatedServerClient();
      const repository = new AssetRepository(supabase);

      if (includeHistory) {
        const assetRes = await new GetAssetByCodeUseCase(repository).execute(code);
        if (assetRes.success) {
          const historyRes = await new GetAssetHistoryUseCase(repository).execute(assetRes.data.id);
          if (historyRes.success) {
            return NextResponse.json({ data: historyRes.data }, { status: 200 });
          }
        }
      } else {
        const result = await new GetAssetByCodeUseCase(repository).execute(code);
        if (result.success) {
          return NextResponse.json({ data: result.data }, { status: 200 });
        }
      }
    } catch {
      // Fall through to public catalog inspection
    }

    // Public catalog inspection via server client
    const publicClient = createServerClient();
    const publicRepo = new AssetRepository(publicClient);

    const asset = await publicRepo.getByCode(code);
    if (!asset) {
      return NextResponse.json(
        { error: `Asset '${code}' not found`, code: "ASSET_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (includeHistory) {
      const [assignments, maintenance] = await Promise.all([
        publicRepo.getAssignmentHistory(asset.id),
        publicRepo.getMaintenanceHistory(asset.id),
      ]);
      return NextResponse.json(
        { data: { asset, assignments, maintenance } },
        { status: 200 }
      );
    }

    return NextResponse.json({ data: asset }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/assets/[code]
 * Updates asset metadata or transitions to RETIRED (SUPER_ADMIN only).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();

    const supabase = await createAuthenticatedServerClient();
    const repository = new AssetRepository(supabase);

    const assetRes = await new GetAssetByCodeUseCase(repository).execute(code);
    if (!assetRes.success) {
      return NextResponse.json(
        { error: assetRes.error.message, code: assetRes.error.code },
        { status: assetRes.error.code === "ASSET_NOT_FOUND" ? 404 : 400 }
      );
    }

    const useCase = new UpdateAssetMetadataUseCase(repository);
    const result = await useCase.execute(assetRes.data.id, body);

    if (!result.success) {
      const statusMap: Record<string, number> = {
        UNAUTHENTICATED: 401,
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

    return NextResponse.json({ data: result.data }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
