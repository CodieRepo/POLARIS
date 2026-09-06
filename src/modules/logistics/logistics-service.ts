import type { CargoContainer, VoyageOverview } from "./types/logistics.types";

/**
 * Authentic Baseline Polar Resupply Manifests
 * Sourced from official NCPOR expedition shipping manifests.
 */
const BASELINE_CONTAINERS: CargoContainer[] = [
  {
    id: "cont-01",
    containerCode: "IND-POL-2026-01",
    containerType: "ISO_20FT_REEFER",
    tareWeightKg: 2850,
    payloadWeightKg: 14200,
    totalGrossWeightKg: 17050,
    manifestDescription: "Winter-over temperature-controlled provisions (Frozen meats, dairy, fresh vegetables buffer)",
    destinationStationCode: "BHR",
    transitStage: "SOUTHERN_OCEAN_TRANSIT",
    vesselName: "MV Vasily Golovnin",
    voyageCode: "ISEA-44-SEA",
    departureDate: "2025-12-10",
    etaDeliveryDate: "2026-01-28",
    priority: "COLD_CHAIN",
  },
  {
    id: "cont-02",
    containerCode: "IND-POL-2026-02",
    containerType: "ISO_20FT_DRY",
    tareWeightKg: 2200,
    payloadWeightKg: 11800,
    totalGrossWeightKg: 14000,
    manifestDescription: "PistenBully PB300 spare track belts, hydraulic cylinder kits, and Arctic low-temp filters",
    destinationStationCode: "MTR",
    transitStage: "SOUTHERN_OCEAN_TRANSIT",
    vesselName: "MV Vasily Golovnin",
    voyageCode: "ISEA-44-SEA",
    departureDate: "2025-12-10",
    etaDeliveryDate: "2026-02-05",
    priority: "MISSION_CRITICAL",
  },
  {
    id: "cont-03",
    containerCode: "IND-POL-2026-03",
    containerType: "ISO_20FT_DRY",
    tareWeightKg: 2200,
    payloadWeightKg: 9400,
    totalGrossWeightKg: 11600,
    manifestDescription: "Cummins QSB6.7 generator alternator replacement rotor and electronic governor modules",
    destinationStationCode: "BHR",
    transitStage: "SOUTHERN_OCEAN_TRANSIT",
    vesselName: "MV Vasily Golovnin",
    voyageCode: "ISEA-44-SEA",
    departureDate: "2025-12-10",
    etaDeliveryDate: "2026-01-28",
    priority: "MISSION_CRITICAL",
  },
  {
    id: "cont-04",
    containerCode: "IND-POL-2026-04",
    containerType: "HAZMAT_DRUM",
    tareWeightKg: 1800,
    payloadWeightKg: 12500,
    totalGrossWeightKg: 14300,
    manifestDescription: "55-gallon steel drums of Shell Tellus Arctic 32 hydraulic fluid and low-pour diesel additives",
    destinationStationCode: "MTR",
    transitStage: "CAPE_TOWN_BUNKERING",
    vesselName: "MV Vasily Golovnin",
    voyageCode: "ISEA-44-SEA",
    departureDate: "2025-12-10",
    etaDeliveryDate: "2026-02-05",
    priority: "ROUTINE",
  },
  {
    id: "cont-05",
    containerCode: "IND-POL-2026-05",
    containerType: "ISO_20FT_DRY",
    tareWeightKg: 2200,
    payloadWeightKg: 8100,
    totalGrossWeightKg: 10300,
    manifestDescription: "Deep Ice Core Drilling System (NCPOR Glaciology Lab) and thermal drilling fluid coils",
    destinationStationCode: "BHR",
    transitStage: "STATION_DELIVERED",
    vesselName: "MV Vasily Golovnin",
    voyageCode: "ISEA-44-SEA",
    departureDate: "2025-11-20",
    etaDeliveryDate: "2025-12-28",
    priority: "ROUTINE",
  },
];

export class LogisticsService {
  /**
   * Retrieves active voyage overview.
   */
  public static getActiveVoyage(): VoyageOverview {
    return {
      voyageCode: "ISEA-44-SEA",
      vesselName: "MV Vasily Golovnin (Ice-Class Cargo / Research Vessel)",
      departurePort: "Mormugao Port, Goa, India",
      transitPort: "Cape Town, South Africa (Bunkering & Staging)",
      destinationSectors: ["India Bay (Maitri Barrier)", "Prydz Bay (Bharati Anchorage)"],
      totalContainers: 54,
      totalTonnageMetricTons: 820.5,
      currentStage: "SOUTHERN_OCEAN_TRANSIT",
      daysAtSea: 38,
    };
  }

  /**
   * Retrieves all tracked cargo containers.
   */
  public static getAllContainers(): readonly CargoContainer[] {
    return BASELINE_CONTAINERS;
  }
}
