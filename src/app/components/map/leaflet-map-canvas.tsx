"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type {
  PolarMapStation,
  MapSector,
  LayerVisibilityState,
} from "./map-types";
import {
  createCoastlineLayer,
  createTraverseLayerGroup,
  createHazardsLayerGroup,
  createMaritimeVoyageLayerGroup,
  createGeodesicBaselineLayer,
  createLeafletSeaIceLayer,
} from "./map-layers";
import { createStationIcon, createStationPopupHtml } from "./map-markers";
import { MapControls } from "./map-controls";
import { MapLayerPanel } from "./map-layer-panel";
import { MapLegend } from "./map-legend";
import { LogisticsService } from "@/modules/logistics/logistics-service";
import type { TraverseCorridor, HazardZone } from "@/core/spatial/traverse-routes";
import type { VoyageOverview } from "@/modules/logistics/types/logistics.types";
import type { StationWeather } from "@/core/weather/types";

interface LeafletMapCanvasProps {
  readonly stations: readonly PolarMapStation[];
  readonly weatherTelemetry?: Record<string, StationWeather> | null;
  readonly selectedStation: PolarMapStation | null;
  readonly onSelectStation: (station: PolarMapStation | null) => void;
  readonly onSelectCorridor: (corridor: TraverseCorridor) => void;
  readonly onSelectHazard: (hazard: HazardZone) => void;
  readonly onSelectVessel?: (voyage: VoyageOverview) => void;
  readonly activeSector?: MapSector;
  readonly onSectorChange?: (sector: MapSector) => void;
}

export default function LeafletMapCanvas({
  stations,
  weatherTelemetry,
  selectedStation,
  onSelectStation,
  onSelectCorridor,
  onSelectHazard,
  onSelectVessel,
  activeSector: controlledSector,
  onSectorChange: controlledOnSectorChange,
}: LeafletMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Layer references
  const coastlineLayerRef = useRef<L.Polygon | null>(null);
  const seaIceLayerRef = useRef<L.TileLayer.WMS | null>(null);
  const stationsGroupRef = useRef<L.LayerGroup | null>(null);
  const traverseGroupRef = useRef<L.LayerGroup | null>(null);
  const hazardsGroupRef = useRef<L.LayerGroup | null>(null);
  const maritimeGroupRef = useRef<L.LayerGroup | null>(null);
  const geodesicGroupRef = useRef<L.LayerGroup | null>(null);

  // Sector and overlay UI states
  const [internalSector, setInternalSector] = useState<MapSector>("ANTARCTICA");
  const activeSector = controlledSector ?? internalSector;
  const setSector = controlledOnSectorChange ?? setInternalSector;

  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);

  // Layer visibility state
  const [visibility, setVisibility] = useState<LayerVisibilityState>({
    coastline: true,
    seaIce: true,
    stations: true,
    traverseRoutes: true,
    hazards: true,
    maritimeVoyage: true,
    geodesicVector: true,
  });

  const toggleLayer = useCallback((layerKey: keyof LayerVisibilityState) => {
    setVisibility((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  }, []);

  // 1. Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [-71.5, 45.0],
      zoom: 3,
      minZoom: 2,
      maxZoom: 13,
      zoomControl: false,
      attributionControl: true,
    });

    // Clean, high-contrast institutional basemap (CartoDB Positron)
    const baseTileLayer = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }
    );
    baseTileLayer.addTo(map);

    // Metric scale line
    L.control.scale({ imperial: false, position: "bottomleft", maxWidth: 120 }).addTo(map);

    // Instantiate Layer Groups
    const coastlineLayer = createCoastlineLayer();
    coastlineLayerRef.current = coastlineLayer;

    const seaIceLayer = createLeafletSeaIceLayer(0.55);
    seaIceLayerRef.current = seaIceLayer;

    const traverseGroup = createTraverseLayerGroup(onSelectCorridor);
    traverseGroupRef.current = traverseGroup;

    const hazardsGroup = createHazardsLayerGroup(onSelectHazard);
    hazardsGroupRef.current = hazardsGroup;

    const activeVoyage = LogisticsService.getActiveVoyage();
    const maritimeGroup = createMaritimeVoyageLayerGroup(activeVoyage, (v) => {
      if (onSelectVessel) onSelectVessel(v);
    });
    maritimeGroupRef.current = maritimeGroup;

    const bhrStation = stations.find((s) => s.code === "BHR");
    const mtrStation = stations.find((s) => s.code === "MTR");
    const geodesicGroup = createGeodesicBaselineLayer(bhrStation, mtrStation);
    geodesicGroupRef.current = geodesicGroup;

    const stationsGroup = L.layerGroup();
    stationsGroupRef.current = stationsGroup;

    // Attach initial layers based on visibility
    if (visibility.seaIce) seaIceLayer.addTo(map);
    if (visibility.coastline) coastlineLayer.addTo(map);
    if (visibility.geodesicVector) geodesicGroup.addTo(map);
    if (visibility.traverseRoutes) traverseGroup.addTo(map);
    if (visibility.maritimeVoyage) maritimeGroup.addTo(map);
    if (visibility.hazards) hazardsGroup.addTo(map);
    if (visibility.stations) stationsGroup.addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Update Stations layer reactively
  useEffect(() => {
    const group = stationsGroupRef.current;
    if (!group) return;

    group.clearLayers();

    stations.forEach((st) => {
      const isSelected = selectedStation?.code === st.code;
      const weather = weatherTelemetry ? weatherTelemetry[st.code] : null;
      const icon = createStationIcon(st, isSelected, weather);
      const marker = L.marker([st.latitude, st.longitude], {
        icon,
        zIndexOffset: isSelected ? 1000 : 100,
      });

      marker.bindPopup(createStationPopupHtml(st, weather), {
        maxWidth: 300,
        className: "polaris-custom-popup",
      });

      marker.on("click", () => {
        onSelectStation(st);
      });

      group.addLayer(marker);
    });
  }, [stations, selectedStation, weatherTelemetry, onSelectStation]);

  // 3. React to Layer Visibility Toggles
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Coastline
    if (coastlineLayerRef.current) {
      if (visibility.coastline) coastlineLayerRef.current.addTo(map);
      else coastlineLayerRef.current.remove();
    }
    // Sea Ice
    if (seaIceLayerRef.current) {
      if (visibility.seaIce) seaIceLayerRef.current.addTo(map);
      else seaIceLayerRef.current.remove();
    }
    // Traverse
    if (traverseGroupRef.current) {
      if (visibility.traverseRoutes) traverseGroupRef.current.addTo(map);
      else traverseGroupRef.current.remove();
    }
    // Hazards
    if (hazardsGroupRef.current) {
      if (visibility.hazards) hazardsGroupRef.current.addTo(map);
      else hazardsGroupRef.current.remove();
    }
    // Maritime
    if (maritimeGroupRef.current) {
      if (visibility.maritimeVoyage) maritimeGroupRef.current.addTo(map);
      else maritimeGroupRef.current.remove();
    }
    // Geodesic
    if (geodesicGroupRef.current) {
      if (visibility.geodesicVector) geodesicGroupRef.current.addTo(map);
      else geodesicGroupRef.current.remove();
    }
    // Stations
    if (stationsGroupRef.current) {
      if (visibility.stations) stationsGroupRef.current.addTo(map);
      else stationsGroupRef.current.remove();
    }
  }, [visibility]);

  // 4. Sector Navigation Handler
  const handleSectorChange = (sector: MapSector) => {
    setSector(sector);
    const map = mapRef.current;
    if (!map) return;

    if (sector === "ANTARCTICA") {
      map.flyTo([-71.5, 45.0], 3, { duration: 1.2 });
    } else if (sector === "ARCTIC") {
      map.flyTo([78.92, 11.93], 6.5, { duration: 1.2 });
    } else if (sector === "MARITIME") {
      map.flyTo([-32.0, 42.0], 2.5, { duration: 1.2 });
    }
  };

  const handleResetView = () => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo([-71.5, 45.0], 3, { duration: 1.0 });
  };

  const handleFitStations = () => {
    const map = mapRef.current;
    if (!map) return;
    const antarcticCoords = stations
      .filter((s) => s.latitude < 0)
      .map((s) => [s.latitude, s.longitude] as [number, number]);

    if (antarcticCoords.length > 0) {
      map.fitBounds(L.latLngBounds(antarcticCoords), {
        padding: [60, 60],
        maxZoom: 5.5,
      });
    }
  };

  const handleFocusStation = (st: PolarMapStation) => {
    onSelectStation(st);
    const map = mapRef.current;
    if (!map) return;
    map.flyTo([st.latitude, st.longitude], 5.5, { duration: 1.0 });
  };

  return (
    <div className="relative w-full h-[620px] rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shadow-xs">
      {/* Map DOM target */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Operational GIS Status Banner (Top-Left) */}
      <div className="absolute top-3 left-3 bg-white/95 border border-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-mono text-slate-700 shadow-xs z-[1000] pointer-events-none backdrop-blur-xs">
        <div className="flex items-center gap-1.5 font-bold text-sky-800">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>POLARIS OPERATIONAL GIS</span>
        </div>
        <span className="text-slate-500">CartoDB Positron Basemap • WGS 84 Dynamic Coordinate System</span>
      </div>

      {/* Custom Map Controls */}
      <MapControls
        activeSector={activeSector}
        onSectorChange={handleSectorChange}
        onResetView={handleResetView}
        onFitStations={handleFitStations}
        isLayerPanelOpen={isLayerPanelOpen}
        onToggleLayerPanel={() => {
          setIsLayerPanelOpen((p) => !p);
          setIsLegendOpen(false);
        }}
        isLegendOpen={isLegendOpen}
        onToggleLegend={() => {
          setIsLegendOpen((p) => !p);
          setIsLayerPanelOpen(false);
        }}
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
      />

      {/* Layer Management Drawer / Panel */}
      <MapLayerPanel
        isOpen={isLayerPanelOpen}
        onClose={() => setIsLayerPanelOpen(false)}
        visibility={visibility}
        onToggleLayer={toggleLayer}
      />

      {/* Cartographic Symbology Legend */}
      <MapLegend isOpen={isLegendOpen} onClose={() => setIsLegendOpen(false)} />

      {/* Quick Station Focus Chips (Bottom-Right) */}
      <div className="absolute bottom-6 right-3 flex gap-1.5 bg-white/95 p-1.5 rounded-lg border border-slate-200 shadow-xs z-[1000] backdrop-blur-xs">
        {stations.map((st) => (
          <button
            key={st.code}
            onClick={() => handleFocusStation(st)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
              selectedStation?.code === st.code
                ? "bg-sky-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900"
            }`}
            title={`Focus ${st.name} (${st.code})`}
          >
            {st.code}
          </button>
        ))}
      </div>

      {/* Data Provenance & Source Attribution Footer Strip */}
      <div className="absolute bottom-0 left-0 right-0 bg-white/92 border-t border-slate-200 px-3 py-1 text-[9px] font-mono text-slate-500 flex justify-between pointer-events-none z-[1000] backdrop-blur-xs">
        <span className="text-emerald-700 font-bold flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          SYSTEM OF RECORD ACTIVE
        </span>
        <span className="hidden sm:inline">
          DATA SOURCES: NASA GIBS (AMSR2 SEA ICE) • SCAR ADD • NCPOR IN-SITU AWS
        </span>
      </div>
    </div>
  );
}
