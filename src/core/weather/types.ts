export type MeasurementType = "OBSERVED" | "MODELLED" | "CACHED" | "BASELINE";

export type WeatherProvenanceTier =
  | "AUTHORITATIVE_OBSERVED"  // Direct physical AWS sensor observation (NCPOR)
  | "COMPOSITE_OBSERVED"      // Physical observation supplemented with verified model for unmonitored sub-fields
  | "VERIFIED_MODEL"          // High-resolution numerical model (Open-Meteo DWD ICON / NOAA GFS)
  | "CACHED_OBSERVED"         // Previously validated observation within staleness window
  | "OFFLINE_CLIMATIC_BASELINE"; // Seasonal historical climate reference (Emergency fallback)

export interface MeasuredField<T> {
  value: T;
  sourceName: string;
  sourceUrl?: string;
  provenanceTier: WeatherProvenanceTier;
  measurementType: MeasurementType;
}

export interface DerivedField<T> {
  value: T;
  derivationMethod: string;
  inputVariables: string[];
}

export interface StationWeather {
  stationCode: "BHR" | "MTR" | "HMD";
  stationName: string;
  latitude: number;
  longitude: number;

  timestamps: {
    observedAt: string;        // Official station observation publication date/time
    fetchedAt: string;         // UTC timestamp when POLARIS retrieved data
    cacheAgeMinutes: number;
    freshnessStatus: "FRESH" | "STALE" | "FALLBACK";
  };

  // Field-level measured meteorological variables
  measurements: {
    temperatureC: MeasuredField<number>;
    relativeHumidityPercent: MeasuredField<number>;
    pressureHpa: MeasuredField<number>;
    windSpeedKmH: MeasuredField<number>;
    windSpeedKnots: MeasuredField<number>;
    windDirectionDeg: MeasuredField<number | null>;
  };

  // Derived calculations (Deterministic local mathematical models)
  derivedCalculations: {
    apparentTemperatureC: DerivedField<number>; // Siple-Passel Wind Chill Formula
  };

  // Categorical Decision Support (POLARIS Operational Risk Heuristic)
  operationalRisk: {
    coldExposureRiskTier: "LOW" | "MODERATE" | "HIGH" | "EXTREME";
    blizzardAdvisory: "NONE" | "WATCH" | "WARNING";
    heuristicAdvisoryText: string;
    methodologyNote: string;
  };

  // Station-Level Composite Status
  stationOverallStatus: {
    classification: WeatherProvenanceTier;
    primarySource: string;
    sourceHealth: "ONLINE" | "STALE" | "FALLBACK";
    attribution: string;
  };

  // Legacy flat properties for backward compatibility with existing views
  temperatureC: number;
  apparentTemperatureC: number;
  relativeHumidityPercent: number;
  pressureHpa: number;
  windSpeedKmH: number;
  windSpeedKnots: number;
  windDirectionDeg: number | null;
  windChillRisk: "LOW" | "MODERATE" | "HIGH" | "EXTREME";
  blizzardRisk: "NONE" | "WATCH" | "WARNING";
  provenanceTier: WeatherProvenanceTier;
  sourceName: string;
  sourceUrl: string;
  dataType: MeasurementType;
  sourceHealth: "ONLINE" | "STALE" | "FALLBACK";
  attribution: string;
  observationTime: string;
  fetchedAt: string;
  dataAgeMinutes: number;
}

export interface WeatherApiResponse {
  success: boolean;
  timestamp: string;
  stations: Record<"BHR" | "MTR" | "HMD", StationWeather>;
  stationCoverageNote: string;
  summary: {
    coldestStation: string;
    highestWindStation: string;
    operationalAdvisory: string;
  };
}
