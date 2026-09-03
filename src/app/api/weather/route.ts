import { NextResponse } from "next/server";
import { WeatherService } from "@/core/weather/weather-service";
import type { WeatherApiResponse } from "@/core/weather/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/weather
 * Returns authenticated & normalized polar weather telemetry:
 * - Direct NCPOR AWS physical observations (Tier 1)
 * - Supplementary Open-Meteo polar numerical model (Tier 3)
 * - Transparent fallback to seasonal climate baselines (Tier 4)
 * - Decision Intelligence: Wind Chill, Hazard Level, Safe Exposure Duration
 */
export async function GET() {
  try {
    const stations = await WeatherService.getAllStationWeather();

    // Determine operational extremes
    const stationList = Object.values(stations);
    const coldest = stationList.reduce((min, s) => (s.temperatureC < min.temperatureC ? s : min), stationList[0]);
    const windiest = stationList.reduce((max, s) => (s.windSpeedKmH > max.windSpeedKmH ? s : max), stationList[0]);

    let operationalAdvisory = "Environmental conditions within normal polar operating baselines across all active stations.";
    if (coldest.apparentTemperatureC <= -35) {
      operationalAdvisory = `CRITICAL COLD ALERT: High wind chill at ${coldest.stationName} (${coldest.apparentTemperatureC}°C). Limit outdoor activities to <30 minutes.`;
    } else if (windiest.windSpeedKmH >= 40) {
      operationalAdvisory = `GALE ADVISORY: High surface winds at ${windiest.stationName} (${windiest.windSpeedKmH} km/h). Traverse windows restricted.`;
    }

    const payload: WeatherApiResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      stations,
      summary: {
        coldestStation: `${coldest.stationName} (${coldest.temperatureC}°C, Chill: ${coldest.apparentTemperatureC}°C)`,
        highestWindStation: `${windiest.stationName} (${windiest.windSpeedKmH} km/h)`,
        operationalAdvisory,
      },
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to resolve polar meteorological telemetry",
      },
      { status: 500 }
    );
  }
}
