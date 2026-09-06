import { createServerClient } from "@/infrastructure/db/supabase-server";
import type { StationWeather } from "./types";

export interface PersistedWeatherObservation {
  id: string;
  stationCode: string;
  observedAt: string;
  temperatureC: number;
  relativeHumidityPct: number | null;
  pressureHpa: number;
  windSpeedKmh: number;
  apparentTempC: number;
  solarElevationDeg: number | null;
  provenanceTier: string;
}

export interface RealHistoricalTrendResult {
  stationCode: string;
  hasSufficientData: boolean;
  totalPersistedPoints: number;
  currentPressureHpa: number;
  pressureDelta6h: number | null;
  cyclonicTrendStatus: "STABLE" | "FALLING_SLOW" | "RAPID_DROP_STORM_ALERT" | "INSUFFICIENT_DATA";
  points: {
    timestampIso: string;
    hourLabel: string;
    temperatureC: number;
    pressureHpa: number;
    windSpeedKmH: number;
    apparentTempC: number;
  }[];
  minTemp24h: number | null;
  maxTemp24h: number | null;
  peakWind24h: number | null;
  statusMessage: string;
}

// In-memory throttling map to prevent excessive duplicate archive writes within the same 15 minutes
const LAST_ARCHIVE_MS: Record<string, number> = {};

export class WeatherHistoryService {
  /**
   * Archives a live observation into public.weather_telemetry_history.
   * Throttles duplicate writes for the same station within 10 minutes.
   */
  public static async archiveObservation(weather: StationWeather): Promise<boolean> {
    const code = weather.stationCode;
    const now = Date.now();
    const lastArchive = LAST_ARCHIVE_MS[code] || 0;

    // Minimum 10 minutes between automated archives
    if (now - lastArchive < 10 * 60 * 1000) {
      return false;
    }

    try {
      const supabase = createServerClient();
      const tempVal = weather.measurements.temperatureC.value;
      const pressVal = weather.measurements.pressureHpa.value;
      const windVal = weather.measurements.windSpeedKmH.value;
      const rhVal = weather.measurements.relativeHumidityPercent.value;
      const apparentVal = weather.derivedCalculations.apparentTemperatureC.value;
      const solarVal = weather.derivedCalculations.currentSolarElevationDeg.value;

      if (tempVal === null || pressVal === null || windVal === null) {
        return false;
      }

      const { error } = await supabase.from("weather_telemetry_history").insert({
        station_code: code,
        observed_at: new Date(now).toISOString(),
        temperature_c: tempVal,
        relative_humidity_pct: rhVal,
        pressure_hpa: pressVal,
        wind_speed_kmh: windVal,
        apparent_temp_c: apparentVal,
        solar_elevation_deg: solarVal,
        provenance_tier: weather.provenanceTier,
      });

      if (error) {
        console.error(`Failed to archive weather for ${code}:`, error);
        return false;
      }

      LAST_ARCHIVE_MS[code] = now;
      return true;
    } catch (err) {
      console.error(`Exception archiving weather observation for ${code}:`, err);
      return false;
    }
  }

  /**
   * Retrieves genuine persisted observations for the last 24 hours.
   * Does NOT fabricate data. If < 2 observations exist, reports hasSufficientData: false.
   */
  public static async getHistoricalTrend(
    stationCode: "BHR" | "MTR" | "HMD",
    fallbackCurrentPressure = 988.0
  ): Promise<RealHistoricalTrendResult> {
    try {
      const supabase = createServerClient();
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

      const { data: rows, error } = await supabase
        .from("weather_telemetry_history")
        .select("*")
        .eq("station_code", stationCode)
        .gte("observed_at", twentyFourHoursAgo)
        .order("observed_at", { ascending: true });

      if (error || !rows || rows.length < 2) {
        const count = rows ? rows.length : 0;
        return {
          stationCode,
          hasSufficientData: false,
          totalPersistedPoints: count,
          currentPressureHpa: rows && rows.length > 0 ? Number(rows[rows.length - 1].pressure_hpa) : fallbackCurrentPressure,
          pressureDelta6h: null,
          cyclonicTrendStatus: "INSUFFICIENT_DATA",
          points: rows
            ? rows.map((r) => {
                const d = new Date(r.observed_at);
                return {
                  timestampIso: r.observed_at,
                  hourLabel: `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}Z`,
                  temperatureC: Number(r.temperature_c),
                  pressureHpa: Number(r.pressure_hpa),
                  windSpeedKmH: Number(r.wind_speed_kmh),
                  apparentTempC: Number(r.apparent_temp_c),
                };
              })
            : [],
          minTemp24h: rows && rows.length > 0 ? Math.min(...rows.map((r) => Number(r.temperature_c))) : null,
          maxTemp24h: rows && rows.length > 0 ? Math.max(...rows.map((r) => Number(r.temperature_c))) : null,
          peakWind24h: rows && rows.length > 0 ? Math.max(...rows.map((r) => Number(r.wind_speed_kmh))) : null,
          statusMessage: `INSUFFICIENT HISTORICAL DATA (${count} logged in last 24h). Baseline telemetry logging active.`,
        };
      }

      // Convert rows to time points
      const points = rows.map((r) => {
        const d = new Date(r.observed_at);
        return {
          timestampIso: r.observed_at,
          hourLabel: `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}Z`,
          temperatureC: Number(r.temperature_c),
          pressureHpa: Number(r.pressure_hpa),
          windSpeedKmH: Number(r.wind_speed_kmh),
          apparentTempC: Number(r.apparent_temp_c),
        };
      });

      const currentPoint = points[points.length - 1];
      const nowMs = Date.now();

      // Find an observation closest to 6 hours ago (between 4h and 8h ago)
      const target6hMs = nowMs - 6 * 3600 * 1000;
      let closestPoint6h = points[0];
      let minDiff = Math.abs(new Date(closestPoint6h.timestampIso).getTime() - target6hMs);

      for (const p of points) {
        const diff = Math.abs(new Date(p.timestampIso).getTime() - target6hMs);
        if (diff < minDiff) {
          minDiff = diff;
          closestPoint6h = p;
        }
      }

      // Only calculate delta if we have a point within +/- 2.5 hours of 6h ago
      let pressureDelta6h: number | null = null;
      if (minDiff < 2.5 * 3600 * 1000) {
        pressureDelta6h = Math.round((currentPoint.pressureHpa - closestPoint6h.pressureHpa) * 10) / 10;
      }

      let cyclonicTrendStatus: RealHistoricalTrendResult["cyclonicTrendStatus"] = "STABLE";
      if (pressureDelta6h !== null) {
        if (pressureDelta6h <= -3.0) {
          cyclonicTrendStatus = "RAPID_DROP_STORM_ALERT";
        } else if (pressureDelta6h < -1.0) {
          cyclonicTrendStatus = "FALLING_SLOW";
        }
      }

      const temps = points.map((p) => p.temperatureC);
      const winds = points.map((p) => p.windSpeedKmH);

      return {
        stationCode,
        hasSufficientData: true,
        totalPersistedPoints: points.length,
        currentPressureHpa: currentPoint.pressureHpa,
        pressureDelta6h,
        cyclonicTrendStatus,
        points,
        minTemp24h: Math.min(...temps),
        maxTemp24h: Math.max(...temps),
        peakWind24h: Math.max(...winds),
        statusMessage: `AUTHENTIC OBSERVATIONS: ${points.length} telemetry points logged from in-situ AWS in last 24h.`,
      };
    } catch (err) {
      console.warn("Historical trend query caught exception:", err);
      return {
        stationCode,
        hasSufficientData: false,
        totalPersistedPoints: 0,
        currentPressureHpa: fallbackCurrentPressure,
        pressureDelta6h: null,
        cyclonicTrendStatus: "INSUFFICIENT_DATA",
        points: [],
        minTemp24h: null,
        maxTemp24h: null,
        peakWind24h: null,
        statusMessage: "INSUFFICIENT HISTORICAL DATA (Telemetry database connection offline).",
      };
    }
  }
}
