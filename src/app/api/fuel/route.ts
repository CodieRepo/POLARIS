import { NextRequest, NextResponse } from "next/server";
import { FuelRepository } from "@/core/fuel/fuel-repository";

export const dynamic = "force-dynamic";

/**
 * GET /api/fuel
 * Retrieves persistent fuel tank profiles and autonomy days from PostgreSQL.
 */
export async function GET() {
  try {
    const profiles = await FuelRepository.getAllStationFuelProfiles();
    return NextResponse.json({
      success: true,
      dataProvenance: "SEEDED_OPERATIONAL_BASELINE",
      profiles,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load fuel profiles" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fuel
 * Records an authentic manual fuel dip measurement for a tank in PostgreSQL.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tankCode, newLevelLiters } = body;

    if (!tankCode || newLevelLiters === undefined || newLevelLiters === null) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: tankCode and newLevelLiters" },
        { status: 400 }
      );
    }

    const numLevel = parseFloat(newLevelLiters);
    if (isNaN(numLevel) || numLevel < 0) {
      return NextResponse.json(
        { success: false, error: "newLevelLiters must be a non-negative number" },
        { status: 400 }
      );
    }

    const result = await FuelRepository.recordFuelDip(tankCode, numLevel);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to update fuel dip reading" },
        { status: 400 }
      );
    }

    // Return updated global profiles
    const updatedProfiles = await FuelRepository.getAllStationFuelProfiles();

    return NextResponse.json({
      success: true,
      message: `Fuel dip measurement for ${tankCode} recorded successfully in public.station_fuel_tanks`,
      updatedTank: result.updatedTank,
      profiles: updatedProfiles,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to record fuel dip" },
      { status: 500 }
    );
  }
}
