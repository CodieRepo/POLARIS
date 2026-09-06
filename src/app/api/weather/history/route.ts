import { NextRequest, NextResponse } from "next/server";
import { WeatherHistoryService } from "@/core/weather/weather-history-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/weather/history
 * Returns authentic persisted meteorological observation history from public.weather_telemetry_history.
 * If < 2 observations exist in 24h, flags hasSufficientData: false. Never fabricates fake history.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const station = (searchParams.get("station") as "BHR" | "MTR" | "HMD") || "BHR";

    const trend = await WeatherHistoryService.getHistoricalTrend(station);

    return NextResponse.json({
      success: true,
      station,
      trend,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to retrieve weather history" },
      { status: 500 }
    );
  }
}
