export interface ReadinessFactor {
  readonly label: string;
  readonly impact: number; // positive or negative points
  readonly reason: string;
}

export interface OperationalReadinessResult {
  readonly score: number; // 0 to 100
  readonly status: "OPTIMAL" | "OPERATIONAL" | "DEGRADED" | "CRITICAL";
  readonly summary: string;
  readonly factors: readonly ReadinessFactor[];
}

interface RawAssetMetrics {
  readonly status: string;
  readonly criticality: string;
  readonly category: string;
  readonly condition: string;
}

interface RawMaintenanceMetrics {
  readonly status: string;
  readonly maintenance_type: string;
}

interface RawStationMetrics {
  readonly status: string;
}

/**
 * Deterministic Operational Readiness Calculator
 *
 * Scoring Formula:
 * - Base: 100 points
 * - Deductions:
 *   - Critical asset not operational (in MAINTENANCE, DAMAGED, or RETIRED): -12 pts each
 *   - Active corrective maintenance order: -8 pts each
 *   - Active preventive maintenance order: -3 pts each
 *   - Power generator or satellite comms unavailable: -15 pts
 * - Additions / Redundancy:
 *   - Redundant generators available: +5 pts
 *   - All stations active with operational communication gear: +5 pts
 *
 * Guaranteed range: 0 - 100
 */
export function calculateOperationalReadiness(
  assets: readonly RawAssetMetrics[],
  maintenance: readonly RawMaintenanceMetrics[],
  stations: readonly RawStationMetrics[]
): OperationalReadinessResult {
  let score = 100;
  const factors: ReadinessFactor[] = [];

  // 1. Critical Asset Availability
  const criticalAssets = assets.filter((a) => a.criticality === "CRITICAL");
  const impairedCritical = criticalAssets.filter(
    (a) => a.status === "MAINTENANCE" || a.condition === "POOR" || a.status === "RETIRED"
  );

  if (impairedCritical.length > 0) {
    const deduction = impairedCritical.length * 12;
    score -= deduction;
    factors.push({
      label: "Critical Asset Impairment",
      impact: -deduction,
      reason: `${impairedCritical.length} mission-critical asset(s) under maintenance or sub-optimal condition`,
    });
  } else {
    factors.push({
      label: "Critical Equipment Health",
      impact: 0,
      reason: "All mission-critical equipment (power, comms, heavy transport) operational",
    });
  }

  // 2. Power Systems & Redundancy
  const generators = assets.filter((a) => a.category === "POWER_SYSTEMS");
  const availableGenerators = generators.filter(
    (a) => a.status === "AVAILABLE" || a.status === "IN_USE" || a.status === "ASSIGNED"
  );

  if (availableGenerators.length >= 2) {
    factors.push({
      label: "Power Grid Redundancy",
      impact: 5,
      reason: `${availableGenerators.length} primary/backup diesel generators operational across bases`,
    });
    score += 5;
  } else if (availableGenerators.length === 1) {
    factors.push({
      label: "Single Point of Failure (Power)",
      impact: -10,
      reason: "Only 1 active power generator operational; redundancy buffer compromised",
    });
    score -= 10;
  }

  // 3. Active Maintenance Work Orders
  const activeCorrective = maintenance.filter(
    (m) => (m.status === "SCHEDULED" || m.status === "IN_PROGRESS") && m.maintenance_type === "CORRECTIVE"
  );
  if (activeCorrective.length > 0) {
    const deduction = activeCorrective.length * 8;
    score -= deduction;
    factors.push({
      label: "Unscheduled Emergency Repairs",
      impact: -deduction,
      reason: `${activeCorrective.length} corrective emergency work order(s) open in polar field bases`,
    });
  }

  const activePreventive = maintenance.filter(
    (m) => (m.status === "SCHEDULED" || m.status === "IN_PROGRESS") && m.maintenance_type === "PREVENTIVE"
  );
  if (activePreventive.length > 0) {
    const deduction = activePreventive.length * 3;
    score -= deduction;
    factors.push({
      label: "Routine Cold-Weather Servicing",
      impact: -deduction,
      reason: `${activePreventive.length} scheduled preventive servicing order(s) pending completion`,
    });
  }

  // 4. Station Operational Readiness
  const activeStations = stations.filter((s) => s.status === "ACTIVE");
  if (activeStations.length > 0) {
    factors.push({
      label: "Station Base Readiness",
      impact: 5,
      reason: `${activeStations.length} primary Antarctic/Arctic bases fully staffed and operational`,
    });
    score += 5;
  }

  // Clamp 0-100
  score = Math.max(0, Math.min(100, score));

  let status: "OPTIMAL" | "OPERATIONAL" | "DEGRADED" | "CRITICAL" = "OPTIMAL";
  let summary = "Polar operational infrastructure fully ready for deep-field scientific traverse.";

  if (score < 50) {
    status = "CRITICAL";
    summary = "Critical operational degradation: vital life-support or power infrastructure impaired.";
  } else if (score < 70) {
    status = "DEGRADED";
    summary = "Operational capability reduced: key transport or redundant systems in maintenance.";
  } else if (score < 85) {
    status = "OPERATIONAL";
    summary = "Standard polar operational readiness: minor scheduled servicing in progress.";
  }

  return {
    score,
    status,
    summary,
    factors,
  };
}
