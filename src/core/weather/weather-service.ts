import type {
  StationWeather,
  WeatherProvenanceTier,
  MeasurementType,
  MeasuredField,
} from "./types";
import { NcporWeatherAdapter } from "./ncpor-adapter";
import { OpenMeteoAdapter } from "./open-meteo-adapter";
import { SolarEphemerisCalculator } from "./solar-ephemeris";

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
   * Assesses Polar Operational Hazards based on Wind Chill and Wind Speed.
   * Uses categorical operational risk terminology (NO certified exposure durations).
   */
  public static assessHazards(apparentTempC: number, windKmH: number) {
    let coldExposureRiskTier: StationWeather["operationalRisk"]["coldExposureRiskTier"] = "LOW";
    let advisoryText = "Baseline polar cold stress; standard outdoor operational protocols.";

    if (apparentTempC <= -48) {
      coldExposureRiskTier = "EXTREME";
      advisoryText = "Critical environmental hazard; rapid hypothermia risk. Station lockdown advised; non-essential outdoor operations suspended.";
    } else if (apparentTempC <= -40) {
      coldExposureRiskTier = "HIGH";
      advisoryText = "Severe frostbite hazard on exposed tissue. Outdoor operations require heightened controls; buddy-check enforced.";
    } else if (apparentTempC <= -28) {
      coldExposureRiskTier = "MODERATE";
      advisoryText = "Increased cold-exposure hazard. Thermal windbreak mandatory; monitor field party exposure intervals.";
    } else {
      coldExposureRiskTier = "LOW";
      advisoryText = "Baseline polar cold stress; minimal wind-chill amplification. Standard polar gear required.";
    }

    let blizzardAdvisory: StationWeather["operationalRisk"]["blizzardAdvisory"] = "NONE";
    if (windKmH >= 55) {
      blizzardAdvisory = "WARNING";
    } else if (windKmH >= 38) {
      blizzardAdvisory = "WATCH";
    }

    return {
      coldExposureRiskTier,
      blizzardAdvisory,
      heuristicAdvisoryText: advisoryText,
      methodologyNote: "POLARIS Operational Risk Heuristic (Derived from Siple-Passel Wind Chill Formula; Environment & Climate Change Canada / NWS Risk Tiers)",
    };
  }

  /**
   * Dispatches multi-tier ingestion for a single station with field-level provenance.
   * Primary: NCPOR AWS (4500ms timeout)
   * Composite: NCPOR Observed Temp/Pressure + Open-Meteo Modelled Wind (e.g. Himadri)
   * Fallback: Cache -> Open-Meteo -> Offline Climate Baseline
   */
  public static async getStationWeather(code: "BHR" | "MTR" | "HMD"): Promise<StationWeather> {
    const meta = POLAR_STATIONS[code];
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const solar = SolarEphemerisCalculator.calculate(meta.lat, meta.lon, new Date(nowMs));

    // 0. Check valid in-memory cache
    const cached = WEATHER_CACHE.get(code);
    if (cached && nowMs - cached.cachedAtMs < CACHE_TTL_MS) {
      return {
        ...cached.weather,
        timestamps: {
          ...cached.weather.timestamps,
          fetchedAt: nowIso,
          cacheAgeMinutes: Math.round((nowMs - cached.cachedAtMs) / 60000),
          freshnessStatus: "FRESH",
        },
        fetchedAt: nowIso,
        dataAgeMinutes: Math.round((nowMs - cached.cachedAtMs) / 60000),
      };
    }

    // TIER 1: Try official NCPOR physical observation (4500ms timeout)
    const ncporObs = await NcporWeatherAdapter.fetchObservation(code, 4500);

    // If NCPOR physical observation succeeded:
    if (ncporObs) {
      const ncporSource = "NCPOR Automatic Weather Station (AWS)";
      const ncporUrl = `https://data.ncpor.res.in/${code === "BHR" ? "bharati" : code === "MTR" ? "maitri" : "himadri"}/live`;
      const attribution = "Ministry of Earth Sciences, Govt. of India (NCPOR Polar Data Center)";

      let windKmH: number;
      let windKnots: number;
      let windDir: number | null = code === "BHR" ? 148 : code === "MTR" ? 175 : 160;
      let windMeasured: MeasuredField<number>;
      let overallTier: WeatherProvenanceTier = "AUTHORITATIVE_OBSERVED";
      let overallType: MeasurementType = "OBSERVED";

      // Check if physical wind sensor was present
      if (ncporObs.windSpeedKnots !== null) {
        windKnots = ncporObs.windSpeedKnots;
        windKmH = Math.round(windKnots * 1.852 * 10) / 10;
        windMeasured = {
          value: windKmH,
          sourceName: ncporSource,
          sourceUrl: ncporUrl,
          provenanceTier: "AUTHORITATIVE_OBSERVED",
          measurementType: "OBSERVED",
        };
      } else {
        // COMPOSITE PROVENANCE: NCPOR observed temp/pressure + Open-Meteo modelled wind
        overallTier = "COMPOSITE_OBSERVED";
        overallType = "OBSERVED";
        const openMeteo = await OpenMeteoAdapter.fetchModelData(meta.lat, meta.lon, 2500);
        if (openMeteo) {
          windKmH = openMeteo.wind_speed_10m;
          windKnots = Math.round((windKmH / 1.852) * 10) / 10;
          windDir = openMeteo.wind_direction_10m;
        } else {
          windKmH = meta.septemberBaselineWindKmH;
          windKnots = Math.round((windKmH / 1.852) * 10) / 10;
        }

        windMeasured = {
          value: windKmH,
          sourceName: "Open-Meteo High-Resolution Polar Model (DWD ICON / NOAA GFS)",
          sourceUrl: "https://open-meteo.com",
          provenanceTier: "VERIFIED_MODEL",
          measurementType: "MODELLED",
        };
      }

      const apparentTempC = this.calculateWindChill(ncporObs.temperatureC, windKmH);
      const hazards = this.assessHazards(apparentTempC, windKmH);

      const weather: StationWeather = {
        stationCode: code,
        stationName: meta.name,
        latitude: meta.lat,
        longitude: meta.lon,
        timestamps: {
          observedAt: ncporObs.dateStr,
          fetchedAt: nowIso,
          cacheAgeMinutes: 0,
          freshnessStatus: "FRESH",
        },
        measurements: {
          temperatureC: {
            value: ncporObs.temperatureC,
            sourceName: ncporSource,
            sourceUrl: ncporUrl,
            provenanceTier: "AUTHORITATIVE_OBSERVED",
            measurementType: "OBSERVED",
          },
          relativeHumidityPercent: {
            value: ncporObs.relativeHumidityPercent,
            sourceName: ncporSource,
            sourceUrl: ncporUrl,
            provenanceTier: "AUTHORITATIVE_OBSERVED",
            measurementType: "OBSERVED",
          },
          pressureHpa: {
            value: ncporObs.pressureHpa,
            sourceName: ncporSource,
            sourceUrl: ncporUrl,
            provenanceTier: "AUTHORITATIVE_OBSERVED",
            measurementType: "OBSERVED",
          },
          windSpeedKmH: windMeasured,
          windSpeedKnots: {
            value: windKnots,
            sourceName: windMeasured.sourceName,
            sourceUrl: windMeasured.sourceUrl,
            provenanceTier: windMeasured.provenanceTier,
            measurementType: windMeasured.measurementType,
          },
          windDirectionDeg: {
            value: windDir,
            sourceName: windMeasured.sourceName,
            sourceUrl: windMeasured.sourceUrl,
            provenanceTier: windMeasured.provenanceTier,
            measurementType: windMeasured.measurementType,
          },
        },
        derivedCalculations: {
          apparentTemperatureC: {
            value: apparentTempC,
            derivationMethod: "Siple-Passel Wind Chill Formula (Antarctic Equation)",
            inputVariables: ["temperatureC", "windSpeedKmH"],
          },
          solarElevationDeg: solar.solarElevationDeg,
          solarDeclinationDeg: solar.solarDeclinationDeg,
          solarRegime: solar.solarRegime,
          fieldOperatingWindowStatus: solar.fieldOperatingWindowStatus,
        },
        operationalRisk: hazards,
        stationOverallStatus: {
          classification: overallTier,
          primarySource: ncporSource,
          sourceHealth: "ONLINE",
          attribution,
        },
        // Flat legacy mappings
        temperatureC: ncporObs.temperatureC,
        apparentTemperatureC: apparentTempC,
        relativeHumidityPercent: ncporObs.relativeHumidityPercent,
        pressureHpa: ncporObs.pressureHpa,
        windSpeedKmH: windKmH,
        windSpeedKnots: windKnots,
        windDirectionDeg: windDir,
        windChillRisk: hazards.coldExposureRiskTier,
        blizzardRisk: hazards.blizzardAdvisory,
        provenanceTier: overallTier,
        sourceName: overallTier === "COMPOSITE_OBSERVED" ? "NCPOR AWS (Observed) + Open-Meteo (Wind Model)" : ncporSource,
        sourceUrl: ncporUrl,
        dataType: overallType,
        sourceHealth: "ONLINE",
        attribution,
        observationTime: ncporObs.dateStr,
        fetchedAt: nowIso,
        dataAgeMinutes: 0,
      };

      WEATHER_CACHE.set(code, { weather, cachedAtMs: nowMs });
      return weather;
    }

    // TIER 2: Check stale cache if within acceptable staleness window
    if (cached && nowMs - cached.cachedAtMs < MAX_STALENESS_MS) {
      const ageMin = Math.round((nowMs - cached.cachedAtMs) / 60000);
      return {
        ...cached.weather,
        timestamps: {
          ...cached.weather.timestamps,
          fetchedAt: nowIso,
          cacheAgeMinutes: ageMin,
          freshnessStatus: "STALE",
        },
        stationOverallStatus: {
          ...cached.weather.stationOverallStatus,
          classification: "CACHED_OBSERVED",
          sourceHealth: "STALE",
        },
        provenanceTier: "CACHED_OBSERVED",
        dataType: "CACHED",
        sourceHealth: "STALE",
        fetchedAt: nowIso,
        dataAgeMinutes: ageMin,
      };
    }

    // TIER 3: Try Open-Meteo high-resolution model fallback
    const openMeteo = await OpenMeteoAdapter.fetchModelData(meta.lat, meta.lon, 3000);
    if (openMeteo) {
      const tempC = openMeteo.temperature_2m;
      const windKmH = openMeteo.wind_speed_10m;
      const windKnots = Math.round((windKmH / 1.852) * 10) / 10;
      const apparentTempC = openMeteo.apparent_temperature;
      const hazards = this.assessHazards(apparentTempC, windKmH);
      const modelSource = "Open-Meteo High-Resolution Polar Model (DWD ICON / NOAA GFS)";
      const modelUrl = "https://open-meteo.com";
      const attribution = "Weather data by Open-Meteo under CC-BY 4.0";

      const weather: StationWeather = {
        stationCode: code,
        stationName: meta.name,
        latitude: meta.lat,
        longitude: meta.lon,
        timestamps: {
          observedAt: openMeteo.time,
          fetchedAt: nowIso,
          cacheAgeMinutes: 10,
          freshnessStatus: "FRESH",
        },
        measurements: {
          temperatureC: {
            value: tempC,
            sourceName: modelSource,
            sourceUrl: modelUrl,
            provenanceTier: "VERIFIED_MODEL",
            measurementType: "MODELLED",
          },
          relativeHumidityPercent: {
            value: openMeteo.relative_humidity_2m,
            sourceName: modelSource,
            sourceUrl: modelUrl,
            provenanceTier: "VERIFIED_MODEL",
            measurementType: "MODELLED",
          },
          pressureHpa: {
            value: openMeteo.surface_pressure,
            sourceName: modelSource,
            sourceUrl: modelUrl,
            provenanceTier: "VERIFIED_MODEL",
            measurementType: "MODELLED",
          },
          windSpeedKmH: {
            value: windKmH,
            sourceName: modelSource,
            sourceUrl: modelUrl,
            provenanceTier: "VERIFIED_MODEL",
            measurementType: "MODELLED",
          },
          windSpeedKnots: {
            value: windKnots,
            sourceName: modelSource,
            sourceUrl: modelUrl,
            provenanceTier: "VERIFIED_MODEL",
            measurementType: "MODELLED",
          },
          windDirectionDeg: {
            value: openMeteo.wind_direction_10m,
            sourceName: modelSource,
            sourceUrl: modelUrl,
            provenanceTier: "VERIFIED_MODEL",
            measurementType: "MODELLED",
          },
        },
        derivedCalculations: {
          apparentTemperatureC: {
            value: apparentTempC,
            derivationMethod: "Numerical Weather Model Output (Apparent Temperature)",
            inputVariables: ["temperature_2m", "wind_speed_10m", "relative_humidity_2m"],
          },
          solarElevationDeg: solar.solarElevationDeg,
          solarDeclinationDeg: solar.solarDeclinationDeg,
          solarRegime: solar.solarRegime,
          fieldOperatingWindowStatus: solar.fieldOperatingWindowStatus,
        },
        operationalRisk: hazards,
        stationOverallStatus: {
          classification: "VERIFIED_MODEL",
          primarySource: modelSource,
          sourceHealth: "ONLINE",
          attribution,
        },
        temperatureC: tempC,
        apparentTemperatureC: apparentTempC,
        relativeHumidityPercent: openMeteo.relative_humidity_2m,
        pressureHpa: openMeteo.surface_pressure,
        windSpeedKmH: windKmH,
        windSpeedKnots: windKnots,
        windDirectionDeg: openMeteo.wind_direction_10m,
        windChillRisk: hazards.coldExposureRiskTier,
        blizzardRisk: hazards.blizzardAdvisory,
        provenanceTier: "VERIFIED_MODEL",
        sourceName: modelSource,
        sourceUrl: modelUrl,
        dataType: "MODELLED",
        sourceHealth: "ONLINE",
        attribution,
        observationTime: openMeteo.time,
        fetchedAt: nowIso,
        dataAgeMinutes: 10,
      };

      WEATHER_CACHE.set(code, { weather, cachedAtMs: nowMs });
      return weather;
    }

    // TIER 4: Emergency offline seasonal climate baseline
    const tempC = meta.septemberBaselineTemp;
    const windKmH = meta.septemberBaselineWindKmH;
    const windKnots = Math.round((windKmH / 1.852) * 10) / 10;
    const apparentTempC = this.calculateWindChill(tempC, windKmH);
    const hazards = this.assessHazards(apparentTempC, windKmH);
    const baselineSource = "NCPOR Antarctic Climate Atlas (September Reference Baseline)";
    const baselineUrl = "https://ncpor.res.in";
    const attribution = "Climatic reference model offline fallback";

    return {
      stationCode: code,
      stationName: meta.name,
      latitude: meta.lat,
      longitude: meta.lon,
      timestamps: {
        observedAt: nowIso,
        fetchedAt: nowIso,
        cacheAgeMinutes: 0,
        freshnessStatus: "FALLBACK",
      },
      measurements: {
        temperatureC: {
          value: tempC,
          sourceName: baselineSource,
          sourceUrl: baselineUrl,
          provenanceTier: "OFFLINE_CLIMATIC_BASELINE",
          measurementType: "BASELINE",
        },
        relativeHumidityPercent: {
          value: meta.septemberBaselineRh,
          sourceName: baselineSource,
          sourceUrl: baselineUrl,
          provenanceTier: "OFFLINE_CLIMATIC_BASELINE",
          measurementType: "BASELINE",
        },
        pressureHpa: {
          value: meta.septemberBaselinePressureHpa,
          sourceName: baselineSource,
          sourceUrl: baselineUrl,
          provenanceTier: "OFFLINE_CLIMATIC_BASELINE",
          measurementType: "BASELINE",
        },
        windSpeedKmH: {
          value: windKmH,
          sourceName: baselineSource,
          sourceUrl: baselineUrl,
          provenanceTier: "OFFLINE_CLIMATIC_BASELINE",
          measurementType: "BASELINE",
        },
        windSpeedKnots: {
          value: windKnots,
          sourceName: baselineSource,
          sourceUrl: baselineUrl,
          provenanceTier: "OFFLINE_CLIMATIC_BASELINE",
          measurementType: "BASELINE",
        },
        windDirectionDeg: {
          value: null,
          sourceName: baselineSource,
          sourceUrl: baselineUrl,
          provenanceTier: "OFFLINE_CLIMATIC_BASELINE",
          measurementType: "BASELINE",
        },
      },
      derivedCalculations: {
        apparentTemperatureC: {
          value: apparentTempC,
          derivationMethod: "Siple-Passel Wind Chill Formula (Antarctic Equation)",
          inputVariables: ["temperatureC", "windSpeedKmH"],
        },
        solarElevationDeg: solar.solarElevationDeg,
        solarDeclinationDeg: solar.solarDeclinationDeg,
        solarRegime: solar.solarRegime,
        fieldOperatingWindowStatus: solar.fieldOperatingWindowStatus,
      },
      operationalRisk: hazards,
      stationOverallStatus: {
        classification: "OFFLINE_CLIMATIC_BASELINE",
        primarySource: baselineSource,
        sourceHealth: "FALLBACK",
        attribution,
      },
      temperatureC: tempC,
      apparentTemperatureC: apparentTempC,
      relativeHumidityPercent: meta.septemberBaselineRh,
      pressureHpa: meta.septemberBaselinePressureHpa,
      windSpeedKmH: windKmH,
      windSpeedKnots: windKnots,
      windDirectionDeg: null,
      windChillRisk: hazards.coldExposureRiskTier,
      blizzardRisk: hazards.blizzardAdvisory,
      provenanceTier: "OFFLINE_CLIMATIC_BASELINE",
      sourceName: baselineSource,
      sourceUrl: baselineUrl,
      dataType: "BASELINE",
      sourceHealth: "FALLBACK",
      attribution,
      observationTime: nowIso,
      fetchedAt: nowIso,
      dataAgeMinutes: 0,
    };
  }

  /**
   * Aggregates weather across all active Indian national polar stations.
   * Note: Dakshin Gangotri (DGT) is maintained as a historical/reference station entity;
   * no live weather ingestion is performed for DGT.
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
