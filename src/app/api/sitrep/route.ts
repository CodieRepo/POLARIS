import { NextRequest, NextResponse } from "next/server";
import { SitrepRepository } from "@/core/sitrep/sitrep-repository";
import type { SitrepDraftInput, DailySitrepData } from "@/core/sitrep/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/sitrep
 * Retrieves persisted Daily Situation Reports from PostgreSQL.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const station = searchParams.get("station") as "BHR" | "MTR" | "HMD" | null;

    const data = await SitrepRepository.listSitreps(station || undefined);

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load SITREPs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sitrep
 * Persists a newly signed-off SITREP with canonical SHA-256 document integrity hash.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input: SitrepDraftInput = body.input;
    const weatherSummary: DailySitrepData["weatherSummary"] = body.weatherSummary;
    const reportDate: string | undefined = body.reportDate;

    if (!input || !input.stationCode || !input.commanderName) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: stationCode and commanderName" },
        { status: 400 }
      );
    }

    const saved = await SitrepRepository.createSitrep(input, weatherSummary, reportDate);

    return NextResponse.json({
      success: true,
      message: "SITREP successfully committed to system of record with SHA-256 integrity hash",
      data: saved,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to persist SITREP" },
      { status: 500 }
    );
  }
}
