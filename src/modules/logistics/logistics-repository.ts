import { createServerClient } from "@/infrastructure/db/supabase-server";
import type { CargoContainer, CargoContainerType, LogisticsTransitStage, VoyageOverview } from "./types/logistics.types";

const STATION_ID_TO_CODE: Record<string, "BHR" | "MTR" | "HMD"> = {
  "b0000000-0000-0000-0000-000000000001": "BHR",
  "b0000000-0000-0000-0000-000000000002": "MTR",
  "b0000000-0000-0000-0000-000000000003": "HMD",
};

export class LogisticsRepository {
  /**
   * Retrieves active voyage overview metadata.
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
   * Queries cargo containers from public.cargo_containers in PostgreSQL.
   */
  public static async getAllContainers(): Promise<CargoContainer[]> {
    try {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from("cargo_containers")
        .select("*")
        .order("container_id", { ascending: true });

      if (error || !data || data.length === 0) {
        console.warn("Falling back to baseline cargo containers due to query error:", error?.message);
        return this.getFallbackContainers();
      }

      return data.map((row) => {
        const destCode: "BHR" | "MTR" | "HMD" =
          (row.destination_station_id && STATION_ID_TO_CODE[row.destination_station_id]) || "BHR";
        const tare = Number(row.tare_weight_kg) || 2200;
        const payload = Number(row.payload_weight_kg) || 10000;

        return {
          id: row.id,
          containerCode: row.container_id,
          containerType: row.container_type as CargoContainerType,
          tareWeightKg: tare,
          payloadWeightKg: payload,
          totalGrossWeightKg: tare + payload,
          manifestDescription: row.manifest_description,
          destinationStationCode: destCode,
          transitStage: row.transit_stage as LogisticsTransitStage,
          vesselName: row.vessel_name || "MV Vasily Golovnin",
          voyageCode: row.voyage_number || "ISEA-44-SEA",
          departureDate: row.shipped_at ? row.shipped_at.split("T")[0] : "2025-12-10",
          etaDeliveryDate: row.delivered_at ? row.delivered_at.split("T")[0] : "2026-01-28",
          priority: (row.priority as "ROUTINE" | "MISSION_CRITICAL" | "COLD_CHAIN") || "ROUTINE",
        };
      });
    } catch (err) {
      console.error("Failed to query cargo_containers:", err);
      return this.getFallbackContainers();
    }
  }

  /**
   * Updates transit stage for a specific container in PostgreSQL.
   */
  public static async updateTransitStage(
    containerCode: string,
    newStage: LogisticsTransitStage
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = createServerClient();
      const { error } = await supabase
        .from("cargo_containers")
        .update({
          transit_stage: newStage,
          updated_at: new Date().toISOString(),
          ...(newStage === "STATION_DELIVERED" ? { delivered_at: new Date().toISOString() } : {}),
        })
        .eq("container_id", containerCode);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error updating container" };
    }
  }

  private static getFallbackContainers(): CargoContainer[] {
    return [
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
  }
}
