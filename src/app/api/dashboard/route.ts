import { createServerClient } from "@/infrastructure/db/supabase-server";
import { calculateOperationalReadiness } from "@/core/readiness/operational-readiness";
import { WeatherService } from "@/core/weather/weather-service";
import { NextResponse } from "next/server";

/**
 * GET /api/dashboard
 * Aggregates live operational metrics across stations, expeditions, assets, maintenance,
 * and live polar meteorological telemetry for the Operational Readiness Heuristic.
 * Suitable for public/authenticated high-level overview.
 */
export async function GET() {
  try {
    const supabase = createServerClient();

    const [
      stationsRes,
      expeditionsRes,
      assetsRes,
      maintenanceRes,
      assignmentsRes,
      weatherTelemetry,
    ] = await Promise.all([
      supabase.from("stations").select("id, code, name, status, capacity, region"),
      supabase.from("expeditions").select("id, code, name, status, data_classification"),
      supabase.from("assets").select("id, asset_code, name, category, status, condition, criticality, station_id, data_classification"),
      supabase.from("maintenance_records").select("id, asset_id, status, maintenance_type, scheduled_at, started_at"),
      supabase.from("asset_assignments").select("id, asset_id, station_id, expedition_id, assignment_type, assigned_at, released_at").is("released_at", null),
      WeatherService.getAllStationWeather().catch(() => null),
    ]);

    const stations = stationsRes.data ?? [];
    const expeditions = expeditionsRes.data ?? [];
    const assets = assetsRes.data ?? [];
    const maintenance = maintenanceRes.data ?? [];
    const activeAssignments = assignmentsRes.data ?? [];

    const stats = {
      stations: {
        total: stations.length,
        active: stations.filter((s) => s.status === "ACTIVE").length,
        historical: stations.filter((s) => s.status === "HISTORICAL").length,
      },
      expeditions: {
        total: expeditions.length,
        active: expeditions.filter((e) => e.status === "ACTIVE").length,
        planned: expeditions.filter((e) => e.status === "PLANNED").length,
        draft: expeditions.filter((e) => e.status === "DRAFT").length,
      },
      assets: {
        total: assets.length,
        available: assets.filter((a) => a.status === "AVAILABLE").length,
        assigned: assets.filter((a) => a.status === "ASSIGNED").length,
        in_use: assets.filter((a) => a.status === "IN_USE").length,
        maintenance: assets.filter((a) => a.status === "MAINTENANCE").length,
        retired: assets.filter((a) => a.status === "RETIRED").length,
        critical: assets.filter((a) => a.criticality === "CRITICAL").length,
      },
      activeAssignmentsCount: activeAssignments.length,
      maintenanceActiveCount: maintenance.filter(
        (m) => m.status === "SCHEDULED" || m.status === "IN_PROGRESS"
      ).length,
    };

    const readiness = calculateOperationalReadiness(assets, maintenance, stations, weatherTelemetry);

    return NextResponse.json(
      {
        data: {
          stats,
          readiness,
          stations,
          expeditions,
          assets,
          activeAssignments,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
