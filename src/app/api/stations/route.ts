import { createServerClient } from "@/infrastructure/db/supabase-server";
import { StationRepository } from "@/core/station/station-repository";
import { NextResponse } from "next/server";

/**
 * GET /api/stations
 * Lists all polar research stations.
 */
export async function GET() {
  try {
    const supabase = createServerClient();
    const repository = new StationRepository(supabase);
    const stations = await repository.list();

    return NextResponse.json({ data: stations }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
