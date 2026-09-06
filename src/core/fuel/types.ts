/**
 * POLARIS Fuel & Station Life Support Autonomy Domain Types
 * Defines authentic polar fuel management, bulk storage, and consumption models.
 */

export type FuelType = "ARCTIC_HSD" | "JET_A1" | "LUBE_OIL" | "MOGAS";

export type TankType = "MAIN_BULK" | "DAY_TANK" | "RESERVE_CACHE" | "MOBILE_BOWSER";

export type FuelAutonomyStatus = "NORMAL" | "WATCH" | "RESUPPLY_REQUIRED" | "CRITICAL";

export interface FuelTankMetrics {
  readonly id: string;
  readonly tankCode: string;
  readonly tankName: string;
  readonly tankType: TankType;
  readonly fuelType: FuelType;
  readonly capacityLiters: number;
  readonly currentLevelLiters: number;
  readonly percentage: number;
  readonly dailyBurnRateLiters: number;
  readonly lastDipReadingAt: string;
}

export interface StationFuelProfile {
  readonly stationCode: string;
  readonly stationName: string;
  readonly totalCapacityLiters: number;
  readonly totalCurrentLiters: number;
  readonly aggregateDailyBurnLiters: number;
  readonly daysOfAutonomy: number;
  readonly autonomyStatus: FuelAutonomyStatus;
  readonly tanks: readonly FuelTankMetrics[];
  readonly lastAuditTimestamp: string;
  readonly dataProvenance: "SEEDED_OPERATIONAL_BASELINE" | "AUTHORITATIVE_SYSTEM_OF_RECORD" | "VERIFIED_EXTERNAL";
}
