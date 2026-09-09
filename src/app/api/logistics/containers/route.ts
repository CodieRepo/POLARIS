import { NextResponse } from "next/server";
import { LogisticsRepository } from "@/modules/logistics/logistics-repository";
import type { LogisticsTransitStage } from "@/modules/logistics/types/logistics.types";

export async function GET() {
  try {
    const containers = await LogisticsRepository.getAllContainers();
    const voyage = LogisticsRepository.getActiveVoyage();

    return NextResponse.json({
      success: true,
      data: {
        voyage,
        containers,
        meta: {
          systemOfRecord: "Central Mission Logistics Manifest",
          provenance: "SCENARIO_LOGISTICS_MANIFEST",
          totalCount: containers.length,
          generatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Failed to fetch cargo containers:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load cargo manifests",
      },
      { status: 500 }
    );
  }
}

import { requireActionPermission, handleAuthError } from "@/infrastructure/auth/role-guard";

export async function PATCH(request: Request) {
  try {
    await requireActionPermission("LOGISTICS_UPDATE_STAGE");
    const body = await request.json();
    const { containerCode, newStage } = body;

    if (!containerCode || !newStage) {
      return NextResponse.json(
        { success: false, error: "containerCode and newStage are required" },
        { status: 400 }
      );
    }

    const validStages: LogisticsTransitStage[] = [
      "GOA_MOBILIZATION",
      "CAPE_TOWN_BUNKERING",
      "SOUTHERN_OCEAN_TRANSIT",
      "ICE_SHELF_BARRIER",
      "STATION_DELIVERED",
    ];

    if (!validStages.includes(newStage)) {
      return NextResponse.json(
        { success: false, error: `Invalid stage: ${newStage}` },
        { status: 400 }
      );
    }

    const result = await LogisticsRepository.updateTransitStage(containerCode, newStage);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to update transit stage" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Container ${containerCode} updated to stage ${newStage}`,
    });
  } catch (error) {
    const authRes = handleAuthError(error);
    if (authRes) return authRes;

    console.error("Failed to update container transit stage:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
