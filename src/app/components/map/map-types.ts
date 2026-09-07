import type { TraverseCorridor, HazardZone } from "@/core/spatial/traverse-routes";
import type { VoyageOverview } from "@/modules/logistics/types/logistics.types";
import type { StationWeather } from "@/core/weather/types";
import type { OperationalReadinessResult } from "@/core/readiness/operational-readiness";

export interface PolarMapStation {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly status: string;
  readonly capacity: number | null;
  readonly region: string | null;
}

export interface PolarMapExpedition {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: string;
}

export type MapSector = "ANTARCTICA" | "ARCTIC" | "MARITIME";

export interface LayerVisibilityState {
  readonly coastline: boolean;
  readonly seaIce: boolean;
  readonly stations: boolean;
  readonly traverseRoutes: boolean;
  readonly hazards: boolean;
  readonly maritimeVoyage: boolean;
  readonly geodesicVector: boolean;
}

export type SelectedMapEntity =
  | { readonly type: "STATION"; readonly data: PolarMapStation }
  | { readonly type: "CORRIDOR"; readonly data: TraverseCorridor }
  | { readonly type: "HAZARD"; readonly data: HazardZone }
  | { readonly type: "VESSEL"; readonly data: VoyageOverview };

export interface PolarOperationalMapProps {
  readonly stations: readonly PolarMapStation[];
  readonly expeditions: readonly PolarMapExpedition[];
  readonly weatherTelemetry?: Record<string, StationWeather> | null;
  readonly readiness?: OperationalReadinessResult | null;
}
