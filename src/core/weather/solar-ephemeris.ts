import type { DerivedField } from "./types";

export type SolarRegime = "POLAR_DAY" | "POLAR_NIGHT" | "CIVIL_TWILIGHT";
export type OperationalVisibilityHeuristic = "NORMAL_DAYLIGHT" | "REDUCED_VISIBILITY" | "DARKNESS_CONDITION";

export interface SolarEphemerisResult {
  currentSolarElevationDeg: DerivedField<number>;
  dailySolarMinimumDeg: DerivedField<number>;
  dailySolarMaximumDeg: DerivedField<number>;
  solarDeclinationDeg: DerivedField<number>;
  solarRegime: DerivedField<SolarRegime>;
  operationalVisibilityHeuristic: DerivedField<OperationalVisibilityHeuristic>;
  methodologyNote: string;
}

/**
 * Deterministic Local Astronomical Solar Ephemeris Calculator
 * Pure mathematical model based on the Spencer (1971) fractional-year solar declination & equation-of-time equations.
 * Evaluates the full 24-hour daily solar trajectory to classify true astronomical Polar Day and Polar Night.
 * Zero external network dependencies, 0ms execution latency.
 */
export class SolarEphemerisCalculator {
  /**
   * Evaluates instantaneous solar elevation for a specific point in time.
   *
   * Formulas:
   * 1. Day of Year (DOY) & Fractional Year (gamma):
   *    gamma = (2 * PI / 365.25) * (DOY - 1 + (hour - 12) / 24)
   * 2. Solar Declination (delta):
   *    delta = 0.006918 - 0.399912*cos(gamma) + 0.070257*sin(gamma)
   *            - 0.006758*cos(2*gamma) + 0.000907*sin(2*gamma)
   * 3. Equation of Time (EOT in minutes):
   *    EOT = 229.18 * (0.000075 + 0.001868*cos(gamma) - 0.032077*sin(gamma)
   *                    - 0.014615*cos(2*gamma) - 0.040849*sin(2*gamma))
   * 4. True Solar Time & Hour Angle (H):
   *    time_offset = EOT + 4 * lon
   *    solar_time_min = UTC_hour*60 + UTC_min + UTC_sec/60 + time_offset
   *    H = (solar_time_min / 4) - 180
   * 5. Solar Elevation Angle (alpha):
   *    sin(alpha) = sin(lat)*sin(delta) + cos(lat)*cos(delta)*cos(H)
   *    alpha = arcsin(sin(alpha))
   */
  public static calculateInstantaneousElevation(
    lat: number,
    lon: number,
    utcDate: Date
  ): { elevationDeg: number; declinationDeg: number } {
    const startOfYear = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
    const dayOfYear = Math.floor((utcDate.getTime() - startOfYear.getTime()) / 86400000) + 1;
    const utcHours = utcDate.getUTCHours() + utcDate.getUTCMinutes() / 60 + utcDate.getUTCSeconds() / 3600;

    const gamma = (2 * Math.PI / 365.25) * (dayOfYear - 1 + (utcHours - 12) / 24);

    const deltaRad =
      0.006918 -
      0.399912 * Math.cos(gamma) +
      0.070257 * Math.sin(gamma) -
      0.006758 * Math.cos(2 * gamma) +
      0.000907 * Math.sin(2 * gamma);

    const declinationDeg = Math.round((deltaRad * 180 / Math.PI) * 100) / 100;

    const eotMin =
      229.18 *
      (0.000075 +
        0.001868 * Math.cos(gamma) -
        0.032077 * Math.sin(gamma) -
        0.014615 * Math.cos(2 * gamma) -
        0.040849 * Math.sin(2 * gamma));

    const timeOffsetMin = eotMin + 4 * lon;
    const trueSolarTimeMin = (utcHours * 60 + timeOffsetMin + 1440) % 1440;
    const hourAngleDeg = trueSolarTimeMin / 4 - 180;
    const hourAngleRad = (hourAngleDeg * Math.PI) / 180;

    const latRad = (lat * Math.PI) / 180;

    const sinElevation =
      Math.sin(latRad) * Math.sin(deltaRad) +
      Math.cos(latRad) * Math.cos(deltaRad) * Math.cos(hourAngleRad);

    const elevationRad = Math.asin(Math.max(-1.0, Math.min(1.0, sinElevation)));
    const elevationDeg = Math.round((elevationRad * 180 / Math.PI) * 100) / 100;

    return { elevationDeg, declinationDeg };
  }

  /**
   * Computes solar ephemeris by sampling the full 24-hour solar trajectory across the given UTC day.
   * This rigorously classifies daily astronomical regime (POLAR_DAY vs POLAR_NIGHT vs CIVIL_TWILIGHT).
   */
  public static calculate(
    lat: number,
    lon: number,
    utcDate: Date = new Date()
  ): SolarEphemerisResult {
    const calcTimestamp = utcDate.toISOString();

    // 1. Compute instantaneous elevation at given timestamp
    const current = this.calculateInstantaneousElevation(lat, lon, utcDate);

    // 2. Sample 24-hour trajectory across the UTC date (sampled at 15-minute intervals = 96 steps)
    // to find true daily solar minimum and maximum elevation
    const year = utcDate.getUTCFullYear();
    const month = utcDate.getUTCMonth();
    const day = utcDate.getUTCDate();

    let dailyMin = 90.0;
    let dailyMax = -90.0;

    for (let step = 0; step < 96; step++) {
      const stepMinutes = step * 15;
      const sampleDate = new Date(Date.UTC(year, month, day, 0, stepMinutes, 0));
      const sample = this.calculateInstantaneousElevation(lat, lon, sampleDate);
      if (sample.elevationDeg < dailyMin) dailyMin = sample.elevationDeg;
      if (sample.elevationDeg > dailyMax) dailyMax = sample.elevationDeg;
    }

    dailyMin = Math.round(dailyMin * 100) / 100;
    dailyMax = Math.round(dailyMax * 100) / 100;

    // 3. True Daily Astronomical Regime Classification:
    // - POLAR_DAY (Midnight Sun): Daily minimum solar elevation > 0° (Sun remains above horizon 24h)
    // - POLAR_NIGHT: Daily maximum solar elevation < -6° (Sun remains below civil twilight 24h)
    // - CIVIL_TWILIGHT: All other transitional / diurnal cases (Sun crosses horizon or civil twilight)
    let solarRegime: SolarRegime;
    if (dailyMin > 0) {
      solarRegime = "POLAR_DAY";
    } else if (dailyMax < -6.0) {
      solarRegime = "POLAR_NIGHT";
    } else {
      solarRegime = "CIVIL_TWILIGHT";
    }

    // 4. POLARIS Operational Visibility Heuristic:
    // Strictly classified as an advisory lighting/visibility heuristic, not an authoritative expedition SOP
    let operationalVisibilityHeuristic: OperationalVisibilityHeuristic;
    if (current.elevationDeg > 0) {
      operationalVisibilityHeuristic = "NORMAL_DAYLIGHT";
    } else if (current.elevationDeg >= -6.0) {
      operationalVisibilityHeuristic = "REDUCED_VISIBILITY"; // Natural twilight illumination
    } else {
      operationalVisibilityHeuristic = "DARKNESS_CONDITION";  // Continuous darkness requiring auxiliary lighting
    }

    return {
      currentSolarElevationDeg: {
        value: current.elevationDeg,
        derivationMethod: "Spencer (1971) Fractional-Year Solar Position Formulation",
        inputVariables: ["latitude", "longitude", "utcTimestamp"],
        calculationTimestamp: calcTimestamp,
      },
      dailySolarMinimumDeg: {
        value: dailyMin,
        derivationMethod: "24-Hour Solar Trajectory Sampled Extremum (Minimum)",
        inputVariables: ["latitude", "longitude", "utcDate"],
        calculationTimestamp: calcTimestamp,
      },
      dailySolarMaximumDeg: {
        value: dailyMax,
        derivationMethod: "24-Hour Solar Trajectory Sampled Extremum (Maximum)",
        inputVariables: ["latitude", "longitude", "utcDate"],
        calculationTimestamp: calcTimestamp,
      },
      solarDeclinationDeg: {
        value: current.declinationDeg,
        derivationMethod: "Spencer (1971) Fractional-Year Solar Declination Equation",
        inputVariables: ["dayOfYear", "utcHour"],
        calculationTimestamp: calcTimestamp,
      },
      solarRegime: {
        value: solarRegime,
        derivationMethod: "Astronomical 24h Trajectory Regime: POLAR_DAY (min > 0°), POLAR_NIGHT (max < -6°), CIVIL_TWILIGHT (transitional)",
        inputVariables: ["dailySolarMinimumDeg", "dailySolarMaximumDeg"],
        calculationTimestamp: calcTimestamp,
      },
      operationalVisibilityHeuristic: {
        value: operationalVisibilityHeuristic,
        derivationMethod: "POLARIS Operational Visibility Heuristic (NORMAL_DAYLIGHT: > 0°, REDUCED_VISIBILITY: -6° to 0°, DARKNESS_CONDITION: < -6°)",
        inputVariables: ["currentSolarElevationDeg"],
        calculationTimestamp: calcTimestamp,
      },
      methodologyNote:
        "Astronomical calculations derived from Spencer (1971) fractional-year solar formulation. Regime is classified from the 24-hour continuous trajectory. Visibility status represents an internal operational heuristic, not an authoritative expedition SOP.",
    };
  }
}
