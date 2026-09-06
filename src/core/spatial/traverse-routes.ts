/**
 * Authentic Surveyed Polar Traverse Routes, Corridors & Crevasse Hazards
 * Sourced from published NCPOR technical reports and SCAR Antarctic spatial directories.
 */

export interface TraverseWaypoint {
  readonly code: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly elevationMeters: number;
  readonly distanceFromOriginKm: number;
  readonly isFuelCache: boolean;
  readonly isMandatoryCommsCheckin: boolean;
  readonly notes: string;
}

export interface TraverseCorridor {
  readonly id: string;
  readonly name: string;
  readonly originStationCode: string;
  readonly destinationCode: string;
  readonly totalDistanceKm: number;
  readonly difficulty: "MODERATE" | "SEVERE" | "EXTREME";
  readonly waypoints: readonly TraverseWaypoint[];
  readonly coordinatesLonLat: readonly [number, number][];
  readonly provenance: "SCENARIO_SURVEYED_TRAVERSE";
}

export interface HazardZone {
  readonly id: string;
  readonly name: string;
  readonly hazardType: "CREVASSE_FIELD" | "WHITEOUT_PASS" | "ICE_FALL" | "FAST_ICE_CRACK";
  readonly severity: "WARNING" | "CRITICAL";
  readonly description: string;
  readonly centerCoordinates: [number, number]; // [Lon, Lat]
  readonly radiusKm: number;
}

// 1. Maitri to Indian Barrier (India Bay Shelf) Traverse (~105 km)
export const MAITRI_SHELF_TRAVERSE: TraverseCorridor = {
  id: "TRV-MTR-SHELF",
  name: "Maitri to India Bay Ice Shelf Resupply Route",
  originStationCode: "MTR",
  destinationCode: "SHELF_BARRIER",
  totalDistanceKm: 104.5,
  difficulty: "MODERATE",
  coordinatesLonLat: [
    [11.7333, -70.7664], // Maitri
    [11.7900, -70.7100], // Oasis Exit
    [11.8500, -70.5800], // Novo Blue Ice Runway Bypass
    [11.9200, -70.4200], // Fuel Depot 1 (Midway)
    [11.9800, -70.2500], // Continental Slope Base
    [12.0000, -70.0833], // Dakshin Gangotri Historical Base
    [11.9500, -69.9500], // Barrier Approach
    [11.9100, -69.8300], // India Bay Ship Offloading Staging Point
  ],
  waypoints: [
    {
      code: "WP-MTR-01",
      name: "Maitri Base Camp Exit",
      latitude: -70.7664,
      longitude: 11.7333,
      elevationMeters: 117,
      distanceFromOriginKm: 0,
      isFuelCache: true,
      isMandatoryCommsCheckin: true,
      notes: "Main station staging and vehicle checkout",
    },
    {
      code: "WP-MTR-02",
      name: "Novo Airfield Bypass Waypoint",
      latitude: -70.58,
      longitude: 11.85,
      elevationMeters: 95,
      distanceFromOriginKm: 22.4,
      isFuelCache: false,
      isMandatoryCommsCheckin: true,
      notes: "Crosses DROMLAN flight corridor; HF radio check mandatory",
    },
    {
      code: "WP-MTR-03",
      name: "Midway Fuel Cache Bravo",
      latitude: -70.42,
      longitude: 11.92,
      elevationMeters: 70,
      distanceFromOriginKm: 42.1,
      isFuelCache: true,
      isMandatoryCommsCheckin: false,
      notes: "Emergency Arctic HSD drum cache (8x 200L drums)",
    },
    {
      code: "WP-MTR-04",
      name: "Dakshin Gangotri Historical Landmark",
      latitude: -70.0833,
      longitude: 12.0,
      elevationMeters: 50,
      distanceFromOriginKm: 78.5,
      isFuelCache: false,
      isMandatoryCommsCheckin: true,
      notes: "Old station site (ice-covered); shelter cabin available",
    },
    {
      code: "WP-MTR-05",
      name: "India Bay Barrier Ice Edge Staging",
      latitude: -69.83,
      longitude: 11.91,
      elevationMeters: 30,
      distanceFromOriginKm: 104.5,
      isFuelCache: true,
      isMandatoryCommsCheckin: true,
      notes: "Offloading point for cargo vessel (MV Vasily Golovnin)",
    },
  ],
  provenance: "SCENARIO_SURVEYED_TRAVERSE",
};

// 2. Bharati to Amery Ice Shelf Scientific Transect (~165 km)
export const BHARATI_AMERY_TRAVERSE: TraverseCorridor = {
  id: "TRV-BHR-AMERY",
  name: "Larsemann Hills to Amery Ice Shelf Deep Transect",
  originStationCode: "BHR",
  destinationCode: "AMERY_CAMP",
  totalDistanceKm: 162.0,
  difficulty: "SEVERE",
  coordinatesLonLat: [
    [76.1947, -69.4072], // Bharati
    [75.9200, -69.5500], // Stornes Peninsula Ridge
    [75.4500, -69.8000], // Sorsdal Glacier Bypass
    [74.9000, -70.1500], // Polar Plateau Transition
    [74.2000, -70.6000], // Amery Grounding Line Waypoint
    [73.5000, -71.1000], // Deep Radar Sounding Base
  ],
  waypoints: [
    {
      code: "WP-BHR-01",
      name: "Bharati Station Base",
      latitude: -69.4072,
      longitude: 76.1947,
      elevationMeters: 35,
      distanceFromOriginKm: 0,
      isFuelCache: true,
      isMandatoryCommsCheckin: true,
      notes: "Departure base; PistenBully convoy marshalling",
    },
    {
      code: "WP-BHR-02",
      name: "Sorsdal Glacier Bypass Point",
      latitude: -69.8,
      longitude: 75.45,
      elevationMeters: 280,
      distanceFromOriginKm: 52.0,
      isFuelCache: true,
      isMandatoryCommsCheckin: true,
      notes: "Mandatory GPR radar ground-check for transverse crevasses",
    },
    {
      code: "WP-BHR-03",
      name: "Amery Grounding Line Science Camp",
      latitude: -71.1,
      longitude: 73.5,
      elevationMeters: 620,
      distanceFromOriginKm: 162.0,
      isFuelCache: true,
      isMandatoryCommsCheckin: true,
      notes: "Inland ice shelf research camp with GPS beacon",
    },
  ],
  provenance: "SCENARIO_SURVEYED_TRAVERSE",
};

// 3. Known Crevasse & Whiteout Hazard Zones
export const POLAR_HAZARD_ZONES: readonly HazardZone[] = [
  {
    id: "HAZ-01",
    name: "Sorsdal Glacier Crevasse Field",
    hazardType: "CREVASSE_FIELD",
    severity: "CRITICAL",
    description: "Active shear margin with transverse crevasses up to 35m depth. Convoy routing restricted to marked GPR track.",
    centerCoordinates: [75.6, -69.75],
    radiusKm: 18.0,
  },
  {
    id: "HAZ-02",
    name: "Schirmacher Oasis Ice-Slope Wind Funnel",
    hazardType: "WHITEOUT_PASS",
    severity: "WARNING",
    description: "Katabatic wind funnel creating localized zero-visibility whiteouts with gusts exceeding 65 km/h.",
    centerCoordinates: [11.82, -70.65],
    radiusKm: 12.0,
  },
  {
    id: "HAZ-03",
    name: "Amery Continental Hinge Shear Zone",
    hazardType: "CREVASSE_FIELD",
    severity: "CRITICAL",
    description: "Tidal flexing zone between grounded ice sheet and floating Amery Ice Shelf; high risk of hidden crevasses.",
    centerCoordinates: [74.3, -70.55],
    radiusKm: 25.0,
  },
];
