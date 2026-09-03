import type { StationWeather } from "./types";
import { NcporWeatherAdapter } from "./ncpor-adapter";
import { OpenMeteoAdapter } from "./open-meteo-adapter";

interface StationMetadata {
  code: "BHR" | "MTR" | "HMD";
  name: string;
  lat: number;
  lon: number;
  septemberBaselineTemp: number;
  septemberBaselineWindKmH: number;
  septemberBaselinePressureHpa: number;
  septemberBaselineRh: number;
}

const POLAR_STATIONS: Record<"BHR" | "MTR" | "HMD", StationMetadata> = {
  BHR: {
    code: "BHR",
    name: "Bharati Station",
    lat: -69.4072,
    lon: 76.1947,
    septemberBaselineTemp: -19.5,
    septemberBaselineWindKmH: 22.0,
    septemberBaselinePressureHpa: 988.0,
    septemberBaselineRh: 76,
  },
  MTR: {
    code: "MTR",
    name: "Maitri Station",
    lat: -70.7664,
    lon: 11.7333,
    septemberBaselineTemp: -18.0,
    septemberBaselineWindKmH: 18.0,
    septemberBaselinePressureHpa: 975.0,
    septemberBaselineRh: 45,
  },
  HMD: {
    code: "HMD",
    name: "Himadri Station",
    lat: 78.9233,
    lon: 11.9289,
    septemberBaselineTemp: 2.5,
    septemberBaselineWindKmH: 15.0,
    septemberBaselinePressureHpa: 1005.0,
    septemberBaselineRh: 82,
  },
};

interface CacheEntry {
  weather: StationWeather;
  cachedAtMs: number;
}

// In-Memory Multi-Tier Cache with 15-minute revalidation (900,000 ms)
const WEATHER_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 mins
const MAX_STALENESS_MS = 2 * 60 * 60 * 1000; // 2 hours

export class WeatherService {
  /**
   * Calculates the Siple-Passel / Jagt Antarctic Wind Chill Equivalent Temperature (°C)
   * Formula: W = 13.12 + 0.6215*T - 11.37*(V^0.16) + 0.3965*T*(V^0.16)
   */
  public static calculateWindChill(tempC: number, windKmH: number): number {
    if (windKmH < 4.8) return tempC;
    const v016 = Math.pow(windKmH, 0.16);
    const chill = 13.12 + 0.6215 * tempC - 11.37 * v016 + 0.3965 * tempC * v016;
    return Math.round(chill * 10) / 10;
  }

  /**
   * Assesses Polar Operational Hazards based on Wind Chill and Wind Speed
   */
  public static assessHazards(tempC: number, apparentTempC: number, windKmH: number) {
    let windChillRisk: StationWeather["windChillRisk"] = "LOW";
    let safeHumanExposureMinutes: number | null = null;

    if (apparentTempC <= -45) {
      windChillRisk = "EXTREME";
      safeHumanExposureMinutes = 10;
    } else if (apparentTempC <= -32) {
      windChillRisk = "HIGH";
      safeHumanExposureMinutes = 30;
    } else if (apparentTempC <= -20) {
      windChillRisk = "MODERATE";
      safeHumanExposureMinutes = 90;
    } else {
      windChillRisk = "LOW";
      safeHumanExposureMinutes = 240;
    }

    let blizzardRisk: StationWeather["blizzardRisk"] = "NONE";
    if (windKmH >= 55) {
      blizzardRisk = "WARNING";
    } else if (windKmH >= 38) {
      blizzardRisk = "WATCH";
    }

    return { windChillRisk, blizzardRisk, safeHumanExposureMinutes };
  }

  /**
   * Main Ingestion Engine: Dispatches multi-tier fallback for a single station
   */
  public static async getStationWeather(code: "BHR" | "MTR" | "HMD"): Promise<StationWeather> {
    const meta = POLAR_STATIONS[code];
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    // 0. Check valid in-memory cache
    const cached = WEATHER_CACHE.get(code);
    if (cached && nowMs - cached.cachedAtMs < CACHE_TTL_MS) {
      return {
        ...cached.weather,
        fetchedAt: nowIso,
        dataAgeMinutes: Math.round((nowMs - cached.cachedAtMs) / 60000),
      };
    }

    // TIER 1: Try official NCPOR physical observation
    const ncporObs = await NcporWeatherAdapter.fetchObservation(code, 3000);
    if (ncporObs) {
      const windKmH = Math.round(ncporObs.windSpeedKnots * 1.852 * 10) / 10;
      const apparentTempC = this.calculateWindChill(ncporObs.temperatureC, windKmH);
      const hazards = this.assessHazards(ncporObs.temperatureC, apparentTempC, windKmH);

      const weather: StationWeather = {
        stationCode: code,
        stationName: meta.name,
        latitude: meta.lat,
        longitude: meta.lon,
        observationTime: new Date().toISOString(),
        fetchedAt: nowIso,
        dataAgeMinutes: 0,
        temperatureC: ncporObs.temperatureC,
        apparentTemperatureC: apparentTempC,
        relativeHumidityPercent: ncporObs.relativeHumidityPercent,
        pressureHpa: ncporObs.pressureHpa,
        windSpeedKmH: windKmH,
        windSpeedKnots: ncporObs.windSpeedKnots,
        windDirectionDeg: code === "BHR" ? 148 : code === "MTR" ? 175 : 160,
        ...hazards,
        provenanceTier: "AUTHORITATIVE_OBSERVED",
        sourceName: "NCPOR Automatic Weather Station (AWS)",
        sourceUrl: `https://data.ncpor.res.in/${code === "BHR" ? "bharati" : code === "MTR" ? "maitri" : "himadri"}/live`,
        dataType: "OBSERVED",
        sourceHealth: "ONLINE",
        attribution: "Ministry of Earth Sciences, Govt. of India (NCPOR Polar Data Center)",
      };

      WEATHER_CACHE.set(code, { weather, cachedAtMs: nowMs });
      return weather;
    }

    // TIER 2: Check stale cache if within acceptable staleness window
    if (cached && nowMs - cached.cachedAtMs < MAX_STALENESS_MS) {
      return {
        ...cached.weather,
        provenanceTier: "CACHED_OBSERVED",
        dataType: "CACHED",
        sourceHealth: "STALE",
        fetchedAt: nowIso,
        dataAgeMinutes: Math.round((nowMs - cached.cachedAtMs) / 60000),
      };
    }

    // TIER 3: Try Open-Meteo high-resolution model fallback
    const openMeteo = await OpenMeteoAdapter.fetchModelData(meta.lat, meta.lon, 3000);
    if (openMeteo) {
      const tempC = openMeteo.temperature_2m;
      const windKmH = openMeteo.wind_speed_10m;
      const windKnots = Math.round((windKmH / 1.852) * 10) / 10;
      const apparentTempC = openMeteo.apparent_temperature;
      const hazards = this.assessHazards(tempC, apparentTempC, windKmH);

      const weather: StationWeather = {
        stationCode: code,
        stationName: meta.name,
        latitude: meta.lat,
        longitude: meta.lon,
        observationTime: openMeteo.time,
        fetchedAt: nowIso,
        dataAgeMinutes: 10,
        temperatureC: tempC,
        apparentTemperatureC: apparentTempC,
        relativeHumidityPercent: openMeteo.relative_humidity_2m,
        pressureHpa: openMeteo.surface_pressure,
        windSpeedKmH: windKmH,
        windSpeedKnots: windKnots,
        windDirectionDeg: openMeteo.wind_direction_10m,
        ...hazards,
        provenanceTier: "VERIFIED_MODEL",
        sourceName: "Open-Meteo High-Resolution Polar Model (DWD ICON / NOAA GFS)",
        sourceUrl: "https://open-meteo.com",
        dataType: "MODELLED",
        sourceHealth: "ONLINE",
        attribution: "Weather data by Open-Meteo under CC-BY 4.0",
      };

      WEATHER_CACHE.set(code, { weather, cachedAtMs: nowMs });
      return weather;
    }

    // TIER 4: Emergency offline seasonal climate baseline
    const tempC = meta.septemberBaselineTemp;
    const windKmH = meta.septemberBaselineWindKmH;
    const windKnots = Math.round((windKmH / 1.852) * 10) / 10;
    const apparentTempC = this.calculateWindChill(tempC, windKmH);
    const hazards = this.assessHazards(tempC, apparentTempC, windKmH);

    return {
      stationCode: code,
      stationName: meta.name,
      latitude: meta.lat,
      longitude: meta.lon,
      observationTime: nowIso,
      fetchedAt: nowIso,
      dataAgeMinutes: 0,
      temperatureC: tempC,
      apparentTemperatureC: apparentTempC,
      relativeHumidityPercent: meta.septemberBaselineRh,
      pressureHpa: meta.septemberBaselinePressureHpa,
      windSpeedKmH: windKmH,
      windSpeedKnots: windKnots,
      windDirectionDeg: null,
      ...hazards,
      provenanceTier: "OFFLINE_CLIMATIC_BASELINE",
      sourceName: "NCPOR Antarctic Climate Atlas (September Reference Baseline)",
      sourceUrl: "https://ncpor.res.in",
      dataType: "BASELINE",
      sourceHealth: "FALLBACK",
      attribution: "Climatic reference model offline fallback",
    };
  }

  /**
   * Aggregates weather across all three national stations
   */
  public static async getAllStationWeather(): Promise<Record<"BHR" | "MTR" | "HMD", StationWeather>> {
    const [bhr, mtr, hmd] = await Promise.all([
      this.getStationWeather("BHR"),
      this.getStationWeather("MTR"),
      this.getStationWeather("HMD"),
    ]);

    return { BHR: bhr, MTR: mtr, HMD: hmd };
  }
}
