import { NextResponse } from "next/server";
import { WeatherService } from "@/core/weather/weather-service";
import { WeatherHistoryService } from "@/core/weather/weather-history-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/weather/ingest
 * Ingestion trigger that scrapes current in-situ AWS observations and archives them to PostgreSQL.
 */
export async function POST() {
  try {
    const allWeather = await WeatherService.getAllStationWeather();
    const results: Record<string, boolean> = {};

    for (const [code, weather] of Object.entries(allWeather)) {
      results[code] = await WeatherHistoryService.archiveObservation(weather);
    }

    return NextResponse.json({
      success: true,
      message: "Weather observations ingested and archived to PostgreSQL",
      archived: results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to ingest weather" },
      { status: 500 }
    );
  }
}
