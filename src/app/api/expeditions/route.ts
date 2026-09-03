import { createAuthenticatedServerClient } from "@/infrastructure/auth/supabase-auth-server";
import { ExpeditionRepository } from "@/modules/expedition/expedition-repository";
import type { ExpeditionStatus } from "@/modules/expedition/types/expedition.types";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/expeditions
 * Lists all polar expeditions with optional status filtering.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createAuthenticatedServerClient();
    const repository = new ExpeditionRepository(supabase);

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") as ExpeditionStatus) ?? undefined;

    const expeditions = await repository.list({ status });

    return NextResponse.json({ data: expeditions }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
