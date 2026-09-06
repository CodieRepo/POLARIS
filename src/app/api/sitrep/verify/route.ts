import { NextRequest, NextResponse } from "next/server";
import { SitrepRepository } from "@/core/sitrep/sitrep-repository";
import { requireActionPermission, handleAuthError } from "@/infrastructure/auth/role-guard";

export const dynamic = "force-dynamic";

/**
 * POST /api/sitrep/verify
 * Re-evaluates the SHA-256 document integrity hash against persisted record values.
 * Read-only cryptographic verification permitted for all authenticated roles.
 */
export async function POST(request: NextRequest) {
  try {
    await requireActionPermission("SITREP_VERIFY");
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing required field: id" },
        { status: 400 }
      );
    }

    const verification = await SitrepRepository.verifySitrep(id);

    return NextResponse.json({
      success: true,
      verification,
    });
  } catch (err) {
    const authRes = handleAuthError(err);
    if (authRes) return authRes;

    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to verify SITREP integrity" },
      { status: 500 }
    );
  }
}
