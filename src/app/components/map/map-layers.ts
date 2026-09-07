import L from "leaflet";
import { ANTARCTIC_COASTLINE_LON_LAT } from "@/core/spatial/antarctic-coastline";
import {
  MAITRI_SHELF_TRAVERSE,
  BHARATI_AMERY_TRAVERSE,
  POLAR_HAZARD_ZONES,
  type HazardZone,
  type TraverseCorridor,
} from "@/core/spatial/traverse-routes";
import { deriveSpatialMetrics } from "@/core/spatial/geodesic";
import { createWaypointIcon, createVesselIcon, createHazardPopupHtml } from "./map-markers";
import { createLeafletSeaIceLayer } from "@/core/spatial/sea-ice-layer";
import type { PolarMapStation } from "./map-types";
import type { VoyageOverview } from "@/modules/logistics/types/logistics.types";

/**
 * Spatial Layer Builders for POLARIS Leaflet Map
 */

// 1. Coastline Polygon (Natural Earth WGS84 converted to [Lat, Lon] for Leaflet)
export function createCoastlineLayer(): L.Polygon {
  const latLngs: [number, number][] = ANTARCTIC_COASTLINE_LON_LAT.map(([lon, lat]) => [lat, lon]);
  return L.polygon(latLngs, {
    color: "#0284c7",
    weight: 1.5,
    opacity: 0.8,
    fillColor: "#ffffff",
    fillOpacity: 0.6,
    interactive: false,
    className: "polaris-coastline-poly",
  });
}

// 2. Overland Traverse Corridors & Waypoints
export function createTraverseLayerGroup(
  onSelectCorridor: (corridor: TraverseCorridor) => void
): L.LayerGroup {
  const group = L.layerGroup();

  // Maitri to Shelf Corridor
  const mtrCoords: [number, number][] = MAITRI_SHELF_TRAVERSE.coordinatesLonLat.map(([lon, lat]) => [
    lat,
    lon,
  ]);
  const mtrLine = L.polyline(mtrCoords, {
    color: "#0284c7",
    weight: 3,
    opacity: 0.9,
    dashArray: "6, 5",
  });
  mtrLine.bindTooltip(
    `<strong>${MAITRI_SHELF_TRAVERSE.name}</strong><br/>Route: Maitri → Shelf Barrier (${MAITRI_SHELF_TRAVERSE.totalDistanceKm} km)<br/><span style="color:#64748b; font-size:10px;">PROVENANCE: NCPOR SURVEY</span>`,
    { sticky: true }
  );
  mtrLine.on("click", () => onSelectCorridor(MAITRI_SHELF_TRAVERSE));
  group.addLayer(mtrLine);

  // Bharati to Amery Corridor
  const bhrCoords: [number, number][] = BHARATI_AMERY_TRAVERSE.coordinatesLonLat.map(([lon, lat]) => [
    lat,
    lon,
  ]);
  const bhrLine = L.polyline(bhrCoords, {
    color: "#0d9488",
    weight: 3,
    opacity: 0.9,
    dashArray: "6, 5",
  });
  bhrLine.bindTooltip(
    `<strong>${BHARATI_AMERY_TRAVERSE.name}</strong><br/>Route: Bharati → Amery Ice Shelf (${BHARATI_AMERY_TRAVERSE.totalDistanceKm} km)<br/><span style="color:#64748b; font-size:10px;">PROVENANCE: NCPOR SURVEY</span>`,
    { sticky: true }
  );
  bhrLine.on("click", () => onSelectCorridor(BHARATI_AMERY_TRAVERSE));
  group.addLayer(bhrLine);

  // Waypoints
  const waypoints = [...MAITRI_SHELF_TRAVERSE.waypoints, ...BHARATI_AMERY_TRAVERSE.waypoints];
  waypoints.forEach((wp) => {
    const icon = createWaypointIcon(wp);
    const marker = L.marker([wp.latitude, wp.longitude], { icon });
    marker.bindTooltip(
      `<strong>${wp.code} - ${wp.name}</strong><br/>${wp.isFuelCache ? "⛽ Emergency Fuel Depot<br/>" : ""}${wp.notes}<br/><span style="color:#64748b; font-size:10px;">PROVENANCE: NCPOR SURVEY</span>`,
      { direction: "top", offset: [0, -10] }
    );
    group.addLayer(marker);
  });

  return group;
}

// 3. Cryospheric Hazards (Crevasses & Whiteouts)
export function createHazardsLayerGroup(
  onSelectHazard: (hazard: HazardZone) => void
): L.LayerGroup {
  const group = L.layerGroup();

  POLAR_HAZARD_ZONES.forEach((hazard) => {
    const centerLatLng: [number, number] = [
      hazard.centerCoordinates[1],
      hazard.centerCoordinates[0],
    ];
    const isCritical = hazard.severity === "CRITICAL";
    const circle = L.circle(centerLatLng, {
      radius: hazard.radiusKm * 1000,
      color: isCritical ? "#e11d48" : "#d97706",
      weight: 1.8,
      dashArray: "4, 4",
      fillColor: isCritical ? "#fb7185" : "#fcd34d",
      fillOpacity: isCritical ? 0.22 : 0.18,
    });

    circle.bindPopup(createHazardPopupHtml(hazard), { maxWidth: 280 });
    circle.bindTooltip(
      `<strong>⚠️ ${hazard.name}</strong> (${hazard.severity})<br/>Radius: ${hazard.radiusKm} km • ${hazard.hazardType}`,
      { sticky: true }
    );
    circle.on("click", () => onSelectHazard(hazard));
    group.addLayer(circle);
  });

  return group;
}

// 4. Maritime Resupply Corridor (MV Vasily Golovnin) - Explicitly SIMULATED
export function createMaritimeVoyageLayerGroup(
  voyage: VoyageOverview,
  onSelectVessel: (voyage: VoyageOverview) => void
): L.LayerGroup {
  const group = L.layerGroup();

  // Transit Route Coordinates: Goa -> Cape Town -> Southern Ocean -> India Bay -> Prydz Bay
  const routeCoords: [number, number][] = [
    [15.40, 73.80],   // Mormugao Port, Goa, India (Departure)
    [-33.92, 18.42],  // Cape Town Bunkering
    [-52.50, 28.00],  // Current Vessel Position (Southern Ocean Roaring Forties/Furious Fifties)
    [-69.83, 11.91],  // India Bay (Maitri Barrier)
    [-69.40, 76.20],  // Prydz Bay (Bharati Anchorage)
  ];

  // Route Polyline
  const maritimeLine = L.polyline(routeCoords, {
    color: "#6366f1",
    weight: 2.2,
    dashArray: "5, 5",
    opacity: 0.75,
  });
  maritimeLine.bindTooltip(
    `<strong>Maritime Resupply Corridor (${voyage.voyageCode})</strong><br/>` +
    `Transit: Mormugao → Cape Town → Antarctica<br/>` +
    `<span style="color:#d97706; font-size:10px; font-weight:bold;">[SIMULATED SCENARIO ROUTE]</span>`,
    { sticky: true }
  );
  group.addLayer(maritimeLine);

  // Vessel Marker at Current Position
  const vesselPos: [number, number] = [-52.50, 28.00];
  const vesselIcon = createVesselIcon(voyage.vesselName);
  const vesselMarker = L.marker(vesselPos, { icon: vesselIcon });

  vesselMarker.bindPopup(`
    <div style="font-family: system-ui, sans-serif; min-width: 220px; font-size: 12px; color: #0f172a;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 6px;">
        <span style="font-weight: 800; font-size: 13px;">🚢 ${voyage.vesselName.split(" (")[0]}</span>
        <span style="background: #fef3c7; color: #b45309; border: 1px solid #fcd34d; font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 4px; font-family: monospace;">
          SIMULATED
        </span>
      </div>
      <div style="font-size: 11px; color: #475569; margin-bottom: 6px;">
        <div>Voyage: <strong>${voyage.voyageCode}</strong></div>
        <div>Stage: <strong>${voyage.currentStage.replace(/_/g, " ")}</strong></div>
        <div>Days at Sea: <strong>${voyage.daysAtSea} days</strong></div>
        <div>Cargo Load: <strong>${voyage.totalContainers} containers (${voyage.totalTonnageMetricTons} MT)</strong></div>
      </div>
      <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 4px; padding: 4px 6px; font-size: 10px; color: #92400e;">
        ⚠️ <em>Seeded resupply scenario. Real-time satellite AIS transponders not active.</em>
      </div>
    </div>
  `);

  vesselMarker.on("click", () => onSelectVessel(voyage));
  group.addLayer(vesselMarker);

  return group;
}

// 5. Inter-Station Geodesic Baseline (Bharati to Maitri)
export function createGeodesicBaselineLayer(
  bhrStation?: PolarMapStation,
  mtrStation?: PolarMapStation
): L.LayerGroup {
  const group = L.layerGroup();
  if (!bhrStation || !mtrStation) return group;

  const baselineCoords: [number, number][] = [
    [bhrStation.latitude, bhrStation.longitude],
    [mtrStation.latitude, mtrStation.longitude],
  ];

  const spatial = deriveSpatialMetrics(
    { lat: bhrStation.latitude, lon: bhrStation.longitude },
    { lat: mtrStation.latitude, lon: mtrStation.longitude }
  );

  const baselineLine = L.polyline(baselineCoords, {
    color: "#8b5cf6",
    weight: 1.8,
    dashArray: "3, 6",
    opacity: 0.8,
  });

  baselineLine.bindTooltip(
    `<strong>Geodesic Baseline (${bhrStation.code} ↔ ${mtrStation.code})</strong><br/>` +
    `Great-Circle Distance: <strong>${spatial.distanceKm.toLocaleString()} km</strong><br/>` +
    `Forward Azimuth: <strong>${spatial.initialBearingDeg}° (${spatial.compassDirection})</strong><br/>` +
    `<span style="color:#7c3aed; font-size:10px; font-weight:bold;">PROVENANCE: MATHEMATICALLY DERIVED</span>`,
    { sticky: true }
  );

  group.addLayer(baselineLine);
  return group;
}

export { createLeafletSeaIceLayer };
