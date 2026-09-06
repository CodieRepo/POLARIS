/**
 * POLARIS Maritime & Air Logistics Domain Types
 * Tracks ISO 20ft polar containers, voyage manifests, and resupply transit legs.
 */

export type CargoContainerType = "ISO_20FT_DRY" | "ISO_20FT_REEFER" | "BREAKBULK_PALLET" | "HAZMAT_DRUM";

export type LogisticsTransitStage =
  | "GOA_MOBILIZATION"
  | "CAPE_TOWN_BUNKERING"
  | "SOUTHERN_OCEAN_TRANSIT"
  | "ICE_SHELF_BARRIER"
  | "STATION_DELIVERED";

export interface CargoContainer {
  readonly id: string;
  readonly containerCode: string;
  readonly containerType: CargoContainerType;
  readonly tareWeightKg: number;
  readonly payloadWeightKg: number;
  readonly totalGrossWeightKg: number;
  readonly manifestDescription: string;
  readonly destinationStationCode: "BHR" | "MTR" | "HMD";
  readonly transitStage: LogisticsTransitStage;
  readonly vesselName: string;
  readonly voyageCode: string;
  readonly departureDate: string;
  readonly etaDeliveryDate: string;
  readonly priority: "ROUTINE" | "MISSION_CRITICAL" | "COLD_CHAIN";
}

export interface VoyageOverview {
  readonly voyageCode: string;
  readonly vesselName: string;
  readonly departurePort: string;
  readonly transitPort: string;
  readonly destinationSectors: readonly string[];
  readonly totalContainers: number;
  readonly totalTonnageMetricTons: number;
  readonly currentStage: LogisticsTransitStage;
  readonly daysAtSea: number;
}
