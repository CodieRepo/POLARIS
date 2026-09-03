import { createAuthenticatedServerClient } from "@/infrastructure/auth/supabase-auth-server";
import { AssetRepository } from "@/modules/asset/asset-repository";
import { ListAssetsUseCase } from "@/modules/asset/use-cases/list-assets";
import { CreateAssetUseCase } from "@/modules/asset/use-cases/create-asset";
import { NextRequest, NextResponse } from "next/server";
import type {
  AssetStatus,
  CriticalityLevel,
  CreateAssetInput,
} from "@/modules/asset/types/asset.types";

/**
 * GET /api/assets
 * Lists all assets with optional filtering query parameters.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createAuthenticatedServerClient();
    const repository = new AssetRepository(supabase);
    const useCase = new ListAssetsUseCase(repository);

    const { searchParams } = new URL(request.url);
    const station_id = searchParams.get("station_id") ?? undefined;
    const status = (searchParams.get("status") as AssetStatus) ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const criticality =
      (searchParams.get("criticality") as CriticalityLevel) ?? undefined;

    const result = await useCase.execute({
      station_id,
      status,
      category,
      criticality,
    });

    if (!result.success) {
      const statusMap: Record<string, number> = {
        UNAUTHENTICATED: 401,
        ACCOUNT_DEACTIVATED: 403,
        UNAUTHORIZED: 403,
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

/**
 * POST /api/assets
 * Provisions a new physical asset in AVAILABLE status.
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateAssetInput = await request.json();
    const supabase = await createAuthenticatedServerClient();
    const repository = new AssetRepository(supabase);
    const useCase = new CreateAssetUseCase(repository, supabase);

    const result = await useCase.execute(body);

    if (!result.success) {
      const statusMap: Record<string, number> = {
        UNAUTHENTICATED: 401,
        ACCOUNT_DEACTIVATED: 403,
        UNAUTHORIZED: 403,
        INVALID_ASSET_INPUT: 422,
        ASSET_ALREADY_EXISTS: 409,
        STATION_NOT_FOUND: 404,
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
