import type { StationWeather, WeatherProvenanceTier } from "@/core/weather/types";

export type ReadinessQualityStatus = "AUTHORITATIVE_VERIFIED" | "COMPOSITE_OBSERVED" | "DEGRADED_MODEL" | "DEGRADED_BASELINE" | "DATA_UNAVAILABLE";

export interface CategoryBreakdown {
  readonly category: "CRITICAL_ASSET_HEALTH" | "STATION_POWER_REDUNDANCY" | "MAINTENANCE_BACKLOG_HEALTH" | "ENVIRONMENTAL_HAZARD_SEVERITY";
  readonly score: number;
  readonly maxScore: number;
  readonly inputs: Record<string, unknown>;
  readonly deductions: Array<{
    readonly reason: string;
    readonly pointsDeducted: number;
    readonly inputField: string;
    readonly provenance: string;
    readonly methodology: string;
  }>;
  readonly qualityStatus: ReadinessQualityStatus;
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
  readonly criticality: string;
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
 * POLARIS Operational Readiness Heuristic Engine
 *
 * Architecture:
 * - Deterministic, category-weighted mathematical heuristic.
 * - Score range: Strictly clamped [0, 100].
 * - Weights:
 *   1. Critical Asset Health (35 pts)
 *   2. Station Power Redundancy (25 pts)
 *   3. Maintenance Backlog Health (20 pts)
 *   4. Environmental Hazard Risk (20 pts)
 *
 * Missing / Degraded Data Rule:
 * - Unknown or missing inputs are NEVER assumed healthy.
 * - If asset counts are null/empty, asset score degrades to 0 with UNKNOWN_DATA status.
 * - If generators are 0 or unverified, power score degrades to 0.
 * - If environmental weather telemetry is missing/stale, environmental score degrades to 10/20 with DEGRADED status.
 *
 * Governance:
 * - Strictly decision-support heuristic; NOT a medical, safety, or government-certified standard.
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
  const assetDeductions: CategoryBreakdown["deductions"] = [];
  let assetQuality: ReadinessQualityStatus = "AUTHORITATIVE_VERIFIED";

  if (!assets || !Array.isArray(assets) || assets.length === 0) {
    assetScore = 0;
    assetQuality = "DATA_UNAVAILABLE";
    assetDeductions.push({
      reason: "Asset registry telemetry missing or zero assets cataloged",
      pointsDeducted: 35,
      inputField: "assets.length",
      provenance: "DATABASE_UNAVAILABLE",
      methodology: "Missing asset inputs default to 0 points; zero health assumption forbidden",
    });
    factors.push({
      label: "Asset Registry Unavailable",
      impact: -35,
      reason: "Asset data unavailable; asset health score defaulted to 0",
    });
  } else {
    const criticalAssets = assets.filter((a) => a.criticality === "CRITICAL");
    const nonRetiredCritical = criticalAssets.filter((a) => a.status !== "RETIRED");

    if (nonRetiredCritical.length === 0) {
      assetScore = 15; // Partial credit if no critical assets configured
      assetDeductions.push({
        reason: "No active mission-critical assets designated in database",
        pointsDeducted: 20,
        inputField: "criticalAssets.length",
        provenance: "DATABASE_OBSERVED",
        methodology: "Absence of active critical tier assets caps category at 15 points",
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
  const powerDeductions: CategoryBreakdown["deductions"] = [];
  let powerQuality: ReadinessQualityStatus = "AUTHORITATIVE_VERIFIED";

  if (!assets || !Array.isArray(assets)) {
    powerScore = 0;
    powerQuality = "DATA_UNAVAILABLE";
    powerDeductions.push({
      reason: "Power generation metrics unavailable",
      pointsDeducted: 25,
      inputField: "category.POWER_SYSTEMS",
      provenance: "DATABASE_UNAVAILABLE",
      methodology: "Missing power telemetry defaults to 0 points (fail-safe rule)",
    });
  } else {
    const generators = assets.filter((a) => a.category === "POWER_SYSTEMS" && a.status !== "RETIRED");
    const operationalGens = generators.filter(
      (a) => (a.status === "AVAILABLE" || a.status === "IN_USE" || a.status === "ASSIGNED") && a.condition !== "POOR"
    );

    if (operationalGens.length >= 2) {
      powerScore = 25;
      factors.push({
        label: "Power Grid Redundancy",
        impact: 0,
        reason: `${operationalGens.length} primary/backup diesel generator units operational (N+1 redundant)`,
      });
    } else if (operationalGens.length === 1) {
      powerScore = 10;
      powerDeductions.push({
        reason: "Only 1 operational power generator unit detected; redundancy buffer compromised",
        pointsDeducted: 15,
        inputField: "generators.operationalCount",
        provenance: "DATABASE_OBSERVED",
        methodology: "Single operational generator grants 10/25 pts due to single-point-of-failure risk",
      });
      factors.push({
        label: "Single Point of Failure (Power)",
        impact: -15,
        reason: "Single generator operating without hot-standby redundancy",
      });
    } else {
      powerScore = 0;
      powerDeductions.push({
        reason: "Zero operational power generators available across stations",
        pointsDeducted: 25,
        inputField: "generators.operationalCount",
        provenance: "DATABASE_OBSERVED",
        methodology: "Zero generators results in complete power category forfeiture (0/25 pts)",
      });
      factors.push({
        label: "Critical Power Outage Risk",
        impact: -25,
        reason: "Zero active primary generators operational",
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
  const maintDeductions: CategoryBreakdown["deductions"] = [];
  let maintQuality: ReadinessQualityStatus = "AUTHORITATIVE_VERIFIED";

  if (!maintenance || !Array.isArray(maintenance)) {
    // Missing maintenance data should not be assumed healthy
    maintenanceScore = 8;
    maintQuality = "DATA_UNAVAILABLE";
    maintDeductions.push({
      reason: "Maintenance logs unavailable; assuming degraded backlog posture",
      pointsDeducted: 12,
      inputField: "maintenance_records",
      provenance: "DATABASE_UNAVAILABLE",
      methodology: "Missing maintenance logs penalized by 12 points to avoid silent health assumption",
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
  const envDeductions: CategoryBreakdown["deductions"] = [];
  let envQuality: ReadinessQualityStatus = "AUTHORITATIVE_VERIFIED";

  if (!weatherTelemetry || Object.keys(weatherTelemetry).length === 0) {
    // Missing real-time weather: fail-safe degraded posture
    envScore = 10;
    envQuality = "DATA_UNAVAILABLE";
    envDeductions.push({
      reason: "Live meteorological telemetry unavailable across stations",
      pointsDeducted: 10,
      inputField: "weatherTelemetry",
      provenance: "DATA_UNAVAILABLE",
      methodology: "Missing meteorological inputs degrade environmental score to 10/20 pts (fail-safe posture)",
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

    for (const st of stationsList) {
      const apparentTemp = st.derivedCalculations?.apparentTemperatureC?.value ?? st.apparentTemperatureC;
      const windKmH = st.measurements?.windSpeedKmH?.value ?? st.windSpeedKmH;
      const tier = st.stationOverallStatus?.classification ?? st.provenanceTier;

      // Track provenance quality: If any station uses model or baseline, degrade overall quality
      if (tier === "OFFLINE_CLIMATIC_BASELINE") {
        worstProvenance = "OFFLINE_CLIMATIC_BASELINE";
      } else if (tier === "VERIFIED_MODEL" && worstProvenance !== "OFFLINE_CLIMATIC_BASELINE") {
        worstProvenance = "VERIFIED_MODEL";
      } else if (tier === "COMPOSITE_OBSERVED" && worstProvenance === "AUTHORITATIVE_OBSERVED") {
        worstProvenance = "COMPOSITE_OBSERVED";
      }

      // Wind chill cold stress penalty
      if (apparentTemp <= -45) {
        maxColdPenalty = Math.max(maxColdPenalty, 8);
      } else if (apparentTemp <= -35) {
        maxColdPenalty = Math.max(maxColdPenalty, 5);
      } else if (apparentTemp <= -25) {
        maxColdPenalty = Math.max(maxColdPenalty, 2);
      }

      // Blizzard / high wind severity penalty
      if (windKmH >= 55) {
        maxWindPenalty = Math.max(maxWindPenalty, 6);
      } else if (windKmH >= 38) {
        maxWindPenalty = Math.max(maxWindPenalty, 3);
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
        reason: `Cold exposure risk penalty triggered by apparent temperatures <= -25°C`,
        pointsDeducted: maxColdPenalty,
        inputField: "apparentTemperatureC",
        provenance: worstProvenance,
        methodology: "Deduction derived from Siple-Passel wind chill cold stress tier",
      });
      factors.push({
        label: "Extreme Cold Hazard",
        impact: -maxColdPenalty,
        reason: `Sub-zero wind chill (${worstProvenance}) introduces convective cold stress`,
      });
    }

    if (maxWindPenalty > 0) {
      envScore -= maxWindPenalty;
      envDeductions.push({
        reason: `Surface wind penalty triggered by wind speeds >= 38 km/h`,
        pointsDeducted: maxWindPenalty,
        inputField: "windSpeedKmH",
        provenance: worstProvenance,
        methodology: "Deductions applied for Blizzard Watch (>=38 km/h) or Blizzard Warning (>=55 km/h)",
      });
      factors.push({
        label: "Elevated Polar Winds",
        impact: -maxWindPenalty,
        reason: `High surface wind velocity creates ground drift and traverse restrictions`,
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
