import type { DerivedField } from "./types";

export type SolarRegime = "POLAR_DAY" | "POLAR_NIGHT" | "CIVIL_TWILIGHT";
export type FieldOperatingWindowStatus = "OPTIMAL" | "RESTRICTED" | "SUSPENDED";

export interface SolarEphemerisResult {
  solarElevationDeg: DerivedField<number>;
  solarDeclinationDeg: DerivedField<number>;
  solarRegime: DerivedField<SolarRegime>;
  fieldOperatingWindowStatus: DerivedField<FieldOperatingWindowStatus>;
  methodologyNote: string;
}

/**
 * Deterministic Local Astronomical Solar Ephemeris Calculator
 * Pure mathematical model based on Spencer (1971) / NOAA Solar Position Algorithm.
 * Zero external network dependencies, 0ms execution latency.
 */
export class SolarEphemerisCalculator {
  /**
   * Computes solar position and astronomical regime for any geodetic coordinate.
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
  public static calculate(
    lat: number,
    lon: number,
    utcDate: Date = new Date()
  ): SolarEphemerisResult {
    const calcTimestamp = utcDate.toISOString();

    // 1. Day of year (1 - 366)
    const startOfYear = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
    const dayOfYear = Math.floor((utcDate.getTime() - startOfYear.getTime()) / 86400000) + 1;
    const utcHours = utcDate.getUTCHours() + utcDate.getUTCMinutes() / 60 + utcDate.getUTCSeconds() / 3600;

    // 2. Fractional year in radians
    const gamma = (2 * Math.PI / 365.25) * (dayOfYear - 1 + (utcHours - 12) / 24);

    // 3. Solar declination angle (radians)
    const deltaRad =
      0.006918 -
      0.399912 * Math.cos(gamma) +
      0.070257 * Math.sin(gamma) -
      0.006758 * Math.cos(2 * gamma) +
      0.000907 * Math.sin(2 * gamma);

    const declinationDeg = Math.round((deltaRad * 180 / Math.PI) * 100) / 100;

    // 4. Equation of time (minutes)
    const eotMin =
      229.18 *
      (0.000075 +
        0.001868 * Math.cos(gamma) -
        0.032077 * Math.sin(gamma) -
        0.014615 * Math.cos(2 * gamma) -
        0.040849 * Math.sin(2 * gamma));

    // 5. True solar time and hour angle
    const timeOffsetMin = eotMin + 4 * lon;
    const trueSolarTimeMin = (utcHours * 60 + timeOffsetMin + 1440) % 1440;
    const hourAngleDeg = trueSolarTimeMin / 4 - 180;
    const hourAngleRad = (hourAngleDeg * Math.PI) / 180;

    // 6. Geodetic latitude to radians
    const latRad = (lat * Math.PI) / 180;

    // 7. Solar elevation angle
    const sinElevation =
      Math.sin(latRad) * Math.sin(deltaRad) +
      Math.cos(latRad) * Math.cos(deltaRad) * Math.cos(hourAngleRad);

    const elevationRad = Math.asin(Math.max(-1.0, Math.min(1.0, sinElevation)));
    const elevationDeg = Math.round((elevationRad * 180 / Math.PI) * 100) / 100;

    // 8. Determine Astronomical Solar Regime
    // - POLAR_DAY (Midnight Sun): Sun continuously above astronomical horizon (> 0 deg)
    // - CIVIL_TWILIGHT: Sun between -6 deg and 0 deg (adequate natural light for outdoor activities)
    // - POLAR_NIGHT: Sun continuously below civil twilight (< -6 deg, artificial illumination required)
    let solarRegime: SolarRegime;
    if (elevationDeg > 0) {
      solarRegime = "POLAR_DAY";
    } else if (elevationDeg >= -6.0) {
      solarRegime = "CIVIL_TWILIGHT";
    } else {
      solarRegime = "POLAR_NIGHT";
    }

    // 9. Operational Heuristic for Field Daylight Window
    // Labelled strictly as an engineering heuristic, not certified expedition SOP
    let fieldOperatingWindowStatus: FieldOperatingWindowStatus;
    if (solarRegime === "POLAR_DAY") {
      fieldOperatingWindowStatus = "OPTIMAL";
    } else if (solarRegime === "CIVIL_TWILIGHT") {
      fieldOperatingWindowStatus = "RESTRICTED"; // Auxiliary lighting and convoy limits advised
    } else {
      fieldOperatingWindowStatus = "SUSPENDED"; // Night traversal restrictions apply
    }

    return {
      solarElevationDeg: {
        value: elevationDeg,
        derivationMethod: "Spencer (1971) / NOAA Solar Position Algorithm",
        inputVariables: ["latitude", "longitude", "utcTimestamp"],
        calculationTimestamp: calcTimestamp,
      },
      solarDeclinationDeg: {
        value: declinationDeg,
        derivationMethod: "Spencer (1971) Astronomical Solar Declination Equation",
        inputVariables: ["dayOfYear", "utcHour"],
        calculationTimestamp: calcTimestamp,
      },
      solarRegime: {
        value: solarRegime,
        derivationMethod: "Astronomical Horizon & Civil Twilight Boundary Classification (-6°)",
        inputVariables: ["solarElevationDeg"],
        calculationTimestamp: calcTimestamp,
      },
      fieldOperatingWindowStatus: {
        value: fieldOperatingWindowStatus,
        derivationMethod: "POLARIS Operational Risk Heuristic (Solar Illumination Operating Window)",
        inputVariables: ["solarRegime"],
        calculationTimestamp: calcTimestamp,
      },
      methodologyNote:
        "Deterministic local astronomical calculation derived from NOAA Solar Position Equations. Decision guidance represents an internal operational heuristic, not an authoritative expedition SOP.",
    };
  }
}
