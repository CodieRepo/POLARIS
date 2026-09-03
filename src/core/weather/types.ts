export type WeatherProvenanceTier =
  | "AUTHORITATIVE_OBSERVED"  // Direct physical AWS sensor telemetry (NCPOR)
  | "VERIFIED_MODEL"          // Real-world numerical weather model (Open-Meteo DWD ICON / NOAA GFS)
  | "CACHED_OBSERVED"         // Previously validated observation within staleness window
  | "OFFLINE_CLIMATIC_BASELINE"; // Seasonal historical climate reference (Emergency fallback)

export interface StationWeather {
  stationCode: "BHR" | "MTR" | "HMD";
  stationName: string;
  latitude: number;
  longitude: number;
  observationTime: string; // ISO 8601
  fetchedAt: string;       // ISO 8601
  dataAgeMinutes: number;

  // Normalized Meteorological Variables
  temperatureC: number;
  apparentTemperatureC: number;
  relativeHumidityPercent: number;
  pressureHpa: number;
  windSpeedKmH: number;
  windSpeedKnots: number;
  windDirectionDeg: number | null;

  // Decision Intelligence
  windChillRisk: "LOW" | "MODERATE" | "HIGH" | "EXTREME";
  blizzardRisk: "NONE" | "WATCH" | "WARNING";
  safeHumanExposureMinutes: number | null; // e.g. <30 min in extreme wind chill

  // Provenance & Transparency Metadata
  provenanceTier: WeatherProvenanceTier;
  sourceName: string;
  sourceUrl: string;
  dataType: "OBSERVED" | "MODELLED" | "CACHED" | "BASELINE";
  sourceHealth: "ONLINE" | "STALE" | "FALLBACK";
  attribution: string;
}

export interface WeatherApiResponse {
  success: boolean;
  timestamp: string;
  stations: Record<"BHR" | "MTR" | "HMD", StationWeather>;
  summary: {
    coldestStation: string;
    highestWindStation: string;
    operationalAdvisory: string;
  };
}
