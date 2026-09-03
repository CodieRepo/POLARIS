import type { StationWeather, WeatherProvenanceTier } from "@/core/weather/types";

export type ReadinessQualityStatus =
  | "AUTHORITATIVE_VERIFIED"
  | "COMPOSITE_OBSERVED"
  | "DEGRADED_MODEL"
  | "DEGRADED_BASELINE"
  | "DATA_UNAVAILABLE";

export interface ReadinessDeduction {
  readonly reason: string;
  readonly pointsDeducted: number;
  readonly inputField: string;
  readonly provenance: string;
  readonly methodology: string;
  readonly triggeringStation?: string;
  readonly triggeringValue?: number | string;
}

export interface CategoryBreakdown {
  readonly category:
    | "CRITICAL_ASSET_HEALTH"
    | "STATION_POWER_REDUNDANCY"
    | "MAINTENANCE_BACKLOG_HEALTH"
    | "ENVIRONMENTAL_HAZARD_SEVERITY";
  readonly score: number;
  readonly maxScore: number;
  readonly inputs: Record<string, unknown>;
  readonly deductions: ReadinessDeduction[];
  readonly qualityStatus: ReadinessQualityStatus;
  readonly aggregationMethod?: string;
}

export interface ReadinessFactor {
  readonly label: string;
  readonly impact: number; // positive or negative points
  readonly reason: string;
}

export interface OperationalReadinessResult {
  readonly score: number; // 0 to 100 clamped
  readonly status: "OPTIMAL" | "OPERATIONAL" | "DEGRADED" | "CRITICAL";
  readonly modelType: "POLARIS_OPERATIONAL_READINESS_HEURISTIC";
  readonly disclaimer: string;
  readonly calculatedAt: string;
  readonly categoryScores: {
    readonly assetHealth: number;       // Max 35
    readonly powerRedundancy: number;   // Max 25
    readonly maintenanceHealth: number; // Max 20
    readonly environmentalRisk: number; // Max 20
  };
  readonly categoryBreakdowns: Record<string, CategoryBreakdown>;
  readonly overallQualityStatus: ReadinessQualityStatus;
  readonly summary: string;
  readonly factors: readonly ReadinessFactor[];
}

export interface RawAssetMetrics {
  readonly status: string;
  readonly criticality?: string | null;
  readonly category: string;
  readonly condition: string;
}

export interface RawMaintenanceMetrics {
  readonly status: string;
  readonly maintenance_type: string;
}

export interface RawStationMetrics {
  readonly status: string;
}

/**
 * POLARIS Operational Readiness Heuristic Engine (Phase 3D.1 Refined)
 *
 * Weight Distribution:
 * 1. Critical Asset Health: 35 pts
 * 2. Station Power Redundancy: 25 pts
 * 3. Maintenance Backlog Health: 20 pts
 * 4. Environmental Hazard Severity: 20 pts
 *
 * Refined Governance & Semantics:
 * - Differentiates between Verified Zero vs Missing/Unavailable data across all categories.
 * - Power redundancy framed as "Configured Power Redundancy Heuristic" (avoids certifying N+1 load capacity).
 * - "Single-generator / no-standby redundancy condition" replaces authoritative "Single Point of Failure" claims.
 * - Environmental scoring explicitly exposes aggregationMethod: "WORST_CASE_ACTIVE_STATION" and pinpoints triggering stations.
 * - Bounded [0, 100], fully deterministic, decision-support advisory.
 */
export function calculateOperationalReadiness(
  assets: readonly RawAssetMetrics[] | null | undefined,
  maintenance: readonly RawMaintenanceMetrics[] | null | undefined,
  stations: readonly RawStationMetrics[] | null | undefined,
  weatherTelemetry?: Record<string, StationWeather> | null
): OperationalReadinessResult {
  const calcTimestamp = new Date().toISOString();
  const factors: ReadinessFactor[] = [];
  const breakdowns: Record<string, CategoryBreakdown> = {};

  // =========================================================================
  // 1. CRITICAL ASSET HEALTH (Max 35 points)
  // =========================================================================
  let assetScore = 0;
  const assetDeductions: ReadinessDeduction[] = [];
  let assetQuality: ReadinessQualityStatus = "AUTHORITATIVE_VERIFIED";

  if (assets === null || assets === undefined) {
    // State B: Critical asset data is missing or unavailable
    assetScore = 0;
    assetQuality = "DATA_UNAVAILABLE";
    assetDeductions.push({
      reason: "Asset registry telemetry is unavailable; zero health assumption forbidden",
      pointsDeducted: 35,
      inputField: "assets",
      provenance: "DATABASE_UNAVAILABLE",
      methodology: "Missing asset records score 0/35 points with DATA_UNAVAILABLE quality tier",
    });
    factors.push({
      label: "Asset Registry Unavailable",
      impact: -35,
      reason: "Asset database records unavailable; category score set to 0",
    });
  } else if (assets.length === 0) {
    // State A: Verified database state with zero assets cataloged
    assetScore = 0;
    assetQuality = "AUTHORITATIVE_VERIFIED";
    assetDeductions.push({
      reason: "Verified database state: zero operational assets cataloged in inventory",
      pointsDeducted: 35,
      inputField: "assets.length",
      provenance: "DATABASE_OBSERVED",
      methodology: "Verified empty asset registry scores 0/35 points with AUTHORITATIVE_VERIFIED quality tier",
    });
    factors.push({
      label: "Zero Station Assets Cataloged",
      impact: -35,
      reason: "Verified 0 total assets cataloged across station bases",
    });
  } else {
    // Assets exist in DB: inspect criticality tags
    const classifiedAssets = assets.filter((a) => a.criticality !== null && a.criticality !== undefined && a.criticality !== "");
    const criticalAssets = assets.filter((a) => a.criticality === "CRITICAL");
    const nonRetiredCritical = criticalAssets.filter((a) => a.status !== "RETIRED");

    if (classifiedAssets.length === 0) {
      // Criticality classification missing from records
      assetScore = 0;
      assetQuality = "DATA_UNAVAILABLE";
      assetDeductions.push({
        reason: "Asset criticality classifications missing from catalog; unable to verify critical inventory health",
        pointsDeducted: 35,
        inputField: "assets.criticality",
        provenance: "DATABASE_UNAVAILABLE",
        methodology: "Absence of asset criticality tagging treated as missing data (0/35 pts)",
      });
      factors.push({
        label: "Asset Criticality Unclassified",
        impact: -35,
        reason: "Asset records lack required criticality classification tags",
      });
    } else if (nonRetiredCritical.length === 0) {
      // Verified zero non-retired critical assets exist in the active base inventory
      assetScore = 0;
      assetQuality = "AUTHORITATIVE_VERIFIED";
      assetDeductions.push({
        reason: "Verified database state: 0 active mission-critical assets cataloged",
        pointsDeducted: 35,
        inputField: "criticalAssets.length",
        provenance: "DATABASE_OBSERVED",
        methodology: "Verified zero active critical-tier assets yields 0/35 points with AUTHORITATIVE_VERIFIED tier",
      });
      factors.push({
        label: "Zero Critical Assets Configured",
        impact: -35,
        reason: "Verified zero active critical-tier assets present in inventory",
      });
    } else {
      const operationalCritical = nonRetiredCritical.filter(
        (a) => (a.status === "AVAILABLE" || a.status === "IN_USE" || a.status === "ASSIGNED") && a.condition !== "POOR"
      );
      const impairedCritical = nonRetiredCritical.filter(
        (a) => a.status === "MAINTENANCE" || a.status === "DAMAGED" || a.condition === "POOR"
      );

      const ratio = operationalCritical.length / nonRetiredCritical.length;
      assetScore = Math.round(ratio * 35);

      if (impairedCritical.length > 0) {
        const deduction = 35 - assetScore;
        assetDeductions.push({
          reason: `${impairedCritical.length} of ${nonRetiredCritical.length} mission-critical asset(s) impaired or under maintenance`,
          pointsDeducted: deduction,
          inputField: "criticalAssets.impaired",
          provenance: "DATABASE_OBSERVED",
          methodology: "Proportional scaling: (Operational Critical / Non-Retired Critical) * 35",
        });
        factors.push({
          label: "Critical Asset Impairment",
          impact: -deduction,
          reason: `${impairedCritical.length} mission-critical asset(s) under maintenance or sub-optimal condition`,
        });
      } else {
        factors.push({
          label: "Critical Equipment Health",
          impact: 0,
          reason: `All ${nonRetiredCritical.length} mission-critical assets operational`,
        });
      }
    }
  }

  assetScore = Math.max(0, Math.min(35, assetScore));
  breakdowns["CRITICAL_ASSET_HEALTH"] = {
    category: "CRITICAL_ASSET_HEALTH",
    score: assetScore,
    maxScore: 35,
    inputs: { totalAssets: assets?.length ?? 0 },
    deductions: assetDeductions,
    qualityStatus: assetQuality,
  };

  // =========================================================================
  // 2. STATION POWER REDUNDANCY (Max 25 points)
  // =========================================================================
  let powerScore = 0;
  const powerDeductions: ReadinessDeduction[] = [];
  let powerQuality: ReadinessQualityStatus = "AUTHORITATIVE_VERIFIED";

  if (assets === null || assets === undefined) {
    // Missing generator telemetry
    powerScore = 0;
    powerQuality = "DATA_UNAVAILABLE";
    powerDeductions.push({
      reason: "Power generation telemetry unavailable from database",
      pointsDeducted: 25,
      inputField: "category.POWER_SYSTEMS",
      provenance: "DATABASE_UNAVAILABLE",
      methodology: "Missing power generation records score 0/25 with DATA_UNAVAILABLE quality tier",
    });
    factors.push({
      label: "Power Telemetry Unavailable",
      impact: -25,
      reason: "Generator status unverified; conservative score set to 0",
    });
  } else {
    // Verified asset catalog exists: check POWER_SYSTEMS category
    const generators = assets.filter((a) => a.category === "POWER_SYSTEMS" && a.status !== "RETIRED");
    const operationalGens = generators.filter(
      (a) => (a.status === "AVAILABLE" || a.status === "IN_USE" || a.status === "ASSIGNED") && a.condition !== "POOR"
    );

    if (operationalGens.length >= 2) {
      powerScore = 25;
      factors.push({
        label: "Configured Power Redundancy Heuristic",
        impact: 0,
        reason: `${operationalGens.length} primary/backup generator units operational (multi-generator heuristic met)`,
      });
    } else if (operationalGens.length === 1) {
      powerScore = 10;
      powerDeductions.push({
        reason: "Only 1 operational generator detected; single-generator / no-standby redundancy condition active",
        pointsDeducted: 15,
        inputField: "generators.operationalCount",
        provenance: "DATABASE_OBSERVED",
        methodology: "Single operational generator yields 10/25 pts under configured redundancy heuristic (-15 pts)",
      });
      factors.push({
        label: "No-Standby Power Redundancy Condition",
        impact: -15,
        reason: "Single active generator running without immediate online backup unit",
      });
    } else {
      // Verified database state with 0 active generators
      powerScore = 0;
      powerQuality = "AUTHORITATIVE_VERIFIED";
      powerDeductions.push({
        reason: "Verified database state: 0 active operational power generators cataloged",
        pointsDeducted: 25,
        inputField: "generators.operationalCount",
        provenance: "DATABASE_OBSERVED",
        methodology: "Verified zero active generators yields 0/25 points with AUTHORITATIVE_VERIFIED quality tier",
      });
      factors.push({
        label: "Zero Active Power Buffer",
        impact: -25,
        reason: "Verified 0 active generators available across station bases",
      });
    }
  }

  powerScore = Math.max(0, Math.min(25, powerScore));
  breakdowns["STATION_POWER_REDUNDANCY"] = {
    category: "STATION_POWER_REDUNDANCY",
    score: powerScore,
    maxScore: 25,
    inputs: { operationalGenerators: assets ? assets.filter((a) => a.category === "POWER_SYSTEMS" && a.status !== "RETIRED").length : 0 },
    deductions: powerDeductions,
    qualityStatus: powerQuality,
  };

  // =========================================================================
  // 3. MAINTENANCE BACKLOG HEALTH (Max 20 points)
  // =========================================================================
  let maintenanceScore = 20;
  const maintDeductions: ReadinessDeduction[] = [];
  let maintQuality: ReadinessQualityStatus = "AUTHORITATIVE_VERIFIED";

  if (maintenance === null || maintenance === undefined) {
    maintenanceScore = 8;
    maintQuality = "DATA_UNAVAILABLE";
    maintDeductions.push({
      reason: "Maintenance logs unavailable; conservative degraded backlog posture assumed",
      pointsDeducted: 12,
      inputField: "maintenance_records",
      provenance: "DATABASE_UNAVAILABLE",
      methodology: "Missing maintenance logs penalized by 12 points to prevent silent health assumption",
    });
    factors.push({
      label: "Maintenance Logs Unavailable",
      impact: -12,
      reason: "Maintenance database table unavailable; score degraded to 8/20",
    });
  } else {
    const activeCorrective = maintenance.filter(
      (m) => (m.status === "SCHEDULED" || m.status === "IN_PROGRESS") && m.maintenance_type === "CORRECTIVE"
    );
    const activePreventive = maintenance.filter(
      (m) => (m.status === "SCHEDULED" || m.status === "IN_PROGRESS") && m.maintenance_type === "PREVENTIVE"
    );

    const correctivePenalty = activeCorrective.length * 6;
    const preventivePenalty = activePreventive.length * 2;
    const totalMaintPenalty = correctivePenalty + preventivePenalty;

    maintenanceScore = Math.max(0, 20 - totalMaintPenalty);

    if (activeCorrective.length > 0) {
      maintDeductions.push({
        reason: `${activeCorrective.length} open corrective emergency repair work order(s)`,
        pointsDeducted: correctivePenalty,
        inputField: "maintenance.CORRECTIVE",
        provenance: "DATABASE_OBSERVED",
        methodology: "6 points deducted per open corrective emergency repair",
      });
      factors.push({
        label: "Unscheduled Emergency Repairs",
        impact: -correctivePenalty,
        reason: `${activeCorrective.length} corrective work orders pending in field bases`,
      });
    }

    if (activePreventive.length > 0) {
      maintDeductions.push({
        reason: `${activePreventive.length} scheduled preventive servicing order(s) open`,
        pointsDeducted: preventivePenalty,
        inputField: "maintenance.PREVENTIVE",
        provenance: "DATABASE_OBSERVED",
        methodology: "2 points deducted per active scheduled preventive servicing order",
      });
      factors.push({
        label: "Routine Servicing In Progress",
        impact: -preventivePenalty,
        reason: `${activePreventive.length} preventive maintenance orders open`,
      });
    }

    if (totalMaintPenalty === 0) {
      factors.push({
        label: "Maintenance Backlog Clear",
        impact: 0,
        reason: "Zero open corrective repair orders across station equipment",
      });
    }
  }

  maintenanceScore = Math.max(0, Math.min(20, maintenanceScore));
  breakdowns["MAINTENANCE_BACKLOG_HEALTH"] = {
    category: "MAINTENANCE_BACKLOG_HEALTH",
    score: maintenanceScore,
    maxScore: 20,
    inputs: { activeWorkOrders: maintenance?.length ?? 0 },
    deductions: maintDeductions,
    qualityStatus: maintQuality,
  };

  // =========================================================================
  // 4. ENVIRONMENTAL HAZARD SEVERITY (Max 20 points)
  // =========================================================================
  let envScore = 20;
  const envDeductions: ReadinessDeduction[] = [];
  let envQuality: ReadinessQualityStatus = "AUTHORITATIVE_VERIFIED";

  if (!weatherTelemetry || Object.keys(weatherTelemetry).length === 0) {
    envScore = 10;
    envQuality = "DATA_UNAVAILABLE";
    envDeductions.push({
      reason: "Live meteorological telemetry unavailable across stations",
      pointsDeducted: 10,
      inputField: "weatherTelemetry",
      provenance: "DATA_UNAVAILABLE",
      methodology: "Missing meteorological inputs degrade environmental score to 10/20 pts (conservative posture)",
    });
    factors.push({
      label: "Meteorological Telemetry Unavailable",
      impact: -10,
      reason: "Live weather feeds unavailable; environmental readiness degraded to baseline",
    });
  } else {
    const stationsList = Object.values(weatherTelemetry);
    let maxColdPenalty = 0;
    let maxWindPenalty = 0;
    let worstProvenance: WeatherProvenanceTier = "AUTHORITATIVE_OBSERVED";

    let coldTriggerStation = "";
    let coldTriggerValue = 0;
    let windTriggerStation = "";
    let windTriggerValue = 0;

    for (const st of stationsList) {
      const apparentTemp = st.derivedCalculations?.apparentTemperatureC?.value ?? st.apparentTemperatureC;
      const windKmH = st.measurements?.windSpeedKmH?.value ?? st.windSpeedKmH;
      const tier = st.stationOverallStatus?.classification ?? st.provenanceTier;

      // Track provenance quality
      if (tier === "OFFLINE_CLIMATIC_BASELINE") {
        worstProvenance = "OFFLINE_CLIMATIC_BASELINE";
      } else if (tier === "VERIFIED_MODEL" && worstProvenance !== "OFFLINE_CLIMATIC_BASELINE") {
        worstProvenance = "VERIFIED_MODEL";
      } else if (tier === "COMPOSITE_OBSERVED" && worstProvenance === "AUTHORITATIVE_OBSERVED") {
        worstProvenance = "COMPOSITE_OBSERVED";
      }

      // Wind chill cold stress penalty
      let stationColdPenalty = 0;
      if (apparentTemp <= -45) {
        stationColdPenalty = 8;
      } else if (apparentTemp <= -35) {
        stationColdPenalty = 5;
      } else if (apparentTemp <= -25) {
        stationColdPenalty = 2;
      }

      if (stationColdPenalty > maxColdPenalty) {
        maxColdPenalty = stationColdPenalty;
        coldTriggerStation = st.stationCode ?? st.stationName;
        coldTriggerValue = apparentTemp;
      }

      // Blizzard / high wind severity penalty
      let stationWindPenalty = 0;
      if (windKmH >= 55) {
        stationWindPenalty = 6;
      } else if (windKmH >= 38) {
        stationWindPenalty = 3;
      }

      if (stationWindPenalty > maxWindPenalty) {
        maxWindPenalty = stationWindPenalty;
        windTriggerStation = st.stationCode ?? st.stationName;
        windTriggerValue = windKmH;
      }
    }

    if (worstProvenance === "OFFLINE_CLIMATIC_BASELINE") {
      envQuality = "DEGRADED_BASELINE";
    } else if (worstProvenance === "VERIFIED_MODEL") {
      envQuality = "DEGRADED_MODEL";
    } else if (worstProvenance === "COMPOSITE_OBSERVED") {
      envQuality = "COMPOSITE_OBSERVED";
    }

    if (maxColdPenalty > 0) {
      envScore -= maxColdPenalty;
      envDeductions.push({
        reason: `Cold exposure penalty: apparent temperature ${coldTriggerValue}°C at ${coldTriggerStation} (<= -25°C threshold)`,
        pointsDeducted: maxColdPenalty,
        inputField: "apparentTemperatureC",
        provenance: worstProvenance,
        methodology: "Siple-Passel wind chill cold stress tier deduction",
        triggeringStation: coldTriggerStation,
        triggeringValue: coldTriggerValue,
      });
      factors.push({
        label: "Sub-Zero Cold Stress",
        impact: -maxColdPenalty,
        reason: `Apparent chill of ${coldTriggerValue}°C at station ${coldTriggerStation} (${worstProvenance})`,
      });
    }

    if (maxWindPenalty > 0) {
      envScore -= maxWindPenalty;
      envDeductions.push({
        reason: `Surface wind penalty: wind speed ${windTriggerValue} km/h at ${windTriggerStation} (>= 38 km/h threshold)`,
        pointsDeducted: maxWindPenalty,
        inputField: "windSpeedKmH",
        provenance: worstProvenance,
        methodology: "Surface wind penalty for Blizzard Watch (>=38 km/h) or Warning (>=55 km/h)",
        triggeringStation: windTriggerStation,
        triggeringValue: windTriggerValue,
      });
      factors.push({
        label: "Elevated Surface Winds",
        impact: -maxWindPenalty,
        reason: `Surface winds of ${windTriggerValue} km/h at station ${windTriggerStation}`,
      });
    }

    if (maxColdPenalty === 0 && maxWindPenalty === 0) {
      factors.push({
        label: "Environmental Operating Window",
        impact: 0,
        reason: `Station weather conditions within standard polar operational baselines (${worstProvenance})`,
      });
    }
  }

  envScore = Math.max(0, Math.min(20, envScore));
  breakdowns["ENVIRONMENTAL_HAZARD_SEVERITY"] = {
    category: "ENVIRONMENTAL_HAZARD_SEVERITY",
    score: envScore,
    maxScore: 20,
    inputs: { activeStationsCount: weatherTelemetry ? Object.keys(weatherTelemetry).length : 0 },
    deductions: envDeductions,
    qualityStatus: envQuality,
    aggregationMethod: "WORST_CASE_ACTIVE_STATION",
  };

  // =========================================================================
  // OVERALL AGGREGATION & CLAMPING [0, 100]
  // =========================================================================
  const totalScore = Math.max(0, Math.min(100, assetScore + powerScore + maintenanceScore + envScore));

  let status: OperationalReadinessResult["status"] = "OPTIMAL";
  let summary = "Polar operational infrastructure fully ready for deep-field scientific traverse.";

  if (totalScore < 50) {
    status = "CRITICAL";
    summary = "Critical operational degradation: vital life-support, power, or critical assets impaired.";
  } else if (totalScore < 70) {
    status = "DEGRADED";
    summary = "Operational capability reduced: key transport, power buffers, or environmental severity impacted.";
  } else if (totalScore < 85) {
    status = "OPERATIONAL";
    summary = "Standard polar operational posture: scheduled servicing or sub-optimal environmental conditions.";
  }

  // Determine Overall Quality Status
  let overallQualityStatus: ReadinessQualityStatus = "AUTHORITATIVE_VERIFIED";
  if (
    assetQuality === "DATA_UNAVAILABLE" ||
    powerQuality === "DATA_UNAVAILABLE" ||
    maintQuality === "DATA_UNAVAILABLE" ||
    envQuality === "DATA_UNAVAILABLE"
  ) {
    overallQualityStatus = "DATA_UNAVAILABLE";
  } else if (envQuality === "DEGRADED_BASELINE") {
    overallQualityStatus = "DEGRADED_BASELINE";
  } else if (envQuality === "DEGRADED_MODEL") {
    overallQualityStatus = "DEGRADED_MODEL";
  } else if (envQuality === "COMPOSITE_OBSERVED") {
    overallQualityStatus = "COMPOSITE_OBSERVED";
  }

  return {
    score: totalScore,
    status,
    modelType: "POLARIS_OPERATIONAL_READINESS_HEURISTIC",
    disclaimer: "POLARIS Operational Readiness Heuristic — decision support only. Not a certified governmental readiness standard.",
    calculatedAt: calcTimestamp,
    categoryScores: {
      assetHealth: assetScore,
      powerRedundancy: powerScore,
      maintenanceHealth: maintenanceScore,
      environmentalRisk: envScore,
    },
    categoryBreakdowns: breakdowns,
    overallQualityStatus,
    summary,
    factors,
  };
}
