"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { PolarMapStation } from "./polar-operational-map";
import {
  MAITRI_SHELF_TRAVERSE,
  BHARATI_AMERY_TRAVERSE,
  POLAR_HAZARD_ZONES,
  type HazardZone,
  type TraverseCorridor,
} from "@/core/spatial/traverse-routes";
import type { StationWeather } from "@/core/weather/types";

interface LeafletOperationalMapProps {
  readonly stations: readonly PolarMapStation[];
  readonly weatherTelemetry?: Record<string, StationWeather> | null;
  readonly selectedStation: PolarMapStation | null;
  readonly onSelectStation: (station: PolarMapStation) => void;
  readonly onSelectCorridor: (corridor: TraverseCorridor) => void;
  readonly onSelectHazard: (hazard: HazardZone) => void;
  readonly showSeaIce?: boolean;
  readonly showTraverseRoutes?: boolean;
  readonly showHazards?: boolean;
  readonly showStations?: boolean;
}

export default function LeafletOperationalMap({
  stations,
  weatherTelemetry,
  selectedStation,
  onSelectStation,
  onSelectCorridor,
  onSelectHazard,
  showTraverseRoutes = true,
  showHazards = true,
  showStations = true,
}: LeafletOperationalMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);

  const [activeSector, setActiveSector] = useState<"ANTARCTICA" | "ARCTIC" | "GLOBAL">("ANTARCTICA");

  // Initialize Leaflet Map
  useEffect(() => {
    if (!containerRef.current) return;
    if (mapInstanceRef.current) return;

    // Create Leaflet map centered on Antarctica
    const map = L.map(containerRef.current, {
      center: [-72.0, 45.0],
      zoom: 3,
      minZoom: 2,
      maxZoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    // High-resolution clean institutional tiles (CartoDB Positron)
    const baseTileLayer = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 19,
      }
    );
    baseTileLayer.addTo(map);

    // Add scale bar in bottom-left
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

    // Add zoom control top-left
    L.control.zoom({ position: "topleft" }).addTo(map);

    // Layer group for operational features
    const layerGroup = L.layerGroup().addTo(map);
    layersGroupRef.current = layerGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Map Layers dynamically based on props
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. Traverse Corridors
    if (showTraverseRoutes) {
      // Maitri to Shelf Corridor
      const mtrCoords: [number, number][] = MAITRI_SHELF_TRAVERSE.coordinatesLonLat.map(([lon, lat]) => [
        lat,
        lon,
      ]);
      const mtrPolyline = L.polyline(mtrCoords, {
        color: "#0284c7",
        weight: 3.5,
        opacity: 0.9,
        dashArray: "6, 6",
      });
      mtrPolyline.bindTooltip(
        `<strong>${MAITRI_SHELF_TRAVERSE.name}</strong><br/>Route: Maitri → Shelf Barrier (${MAITRI_SHELF_TRAVERSE.totalDistanceKm} km)`,
        { sticky: true }
      );
      mtrPolyline.on("click", () => onSelectCorridor(MAITRI_SHELF_TRAVERSE));
      group.addLayer(mtrPolyline);

      // Bharati to Amery Ice Shelf Corridor
      const bhrCoords: [number, number][] = BHARATI_AMERY_TRAVERSE.coordinatesLonLat.map(([lon, lat]) => [
        lat,
        lon,
      ]);
      const bhrPolyline = L.polyline(bhrCoords, {
        color: "#0d9488",
        weight: 3.5,
        opacity: 0.9,
        dashArray: "6, 6",
      });
      bhrPolyline.bindTooltip(
        `<strong>${BHARATI_AMERY_TRAVERSE.name}</strong><br/>Route: Bharati → Amery Ice Shelf (${BHARATI_AMERY_TRAVERSE.totalDistanceKm} km)`,
        { sticky: true }
      );
      bhrPolyline.on("click", () => onSelectCorridor(BHARATI_AMERY_TRAVERSE));
      group.addLayer(bhrPolyline);

      // Render waypoints as circle markers
      [...MAITRI_SHELF_TRAVERSE.waypoints, ...BHARATI_AMERY_TRAVERSE.waypoints].forEach((wp) => {
        const wpMarker = L.circleMarker([wp.latitude, wp.longitude], {
          radius: 4,
          fillColor: "#ffffff",
          color: "#0284c7",
          weight: 2,
          fillOpacity: 1,
        });
        wpMarker.bindTooltip(`Waypoint: ${wp.name}`, { direction: "top" });
        group.addLayer(wpMarker);
      });
    }

    // 2. Crevasse Hazards
    if (showHazards) {
      POLAR_HAZARD_ZONES.forEach((hazard) => {
        const hazardCenter: [number, number] = [
          hazard.centerCoordinates[1],
          hazard.centerCoordinates[0],
        ];
        const circle = L.circle(hazardCenter, {
          radius: hazard.radiusKm * 1000,
          color: hazard.severity === "CRITICAL" ? "#e11d48" : "#f59e0b",
          fillColor: hazard.severity === "CRITICAL" ? "#fb7185" : "#fcd34d",
          fillOpacity: 0.25,
          weight: 1.5,
          dashArray: "4, 4",
        });
        circle.bindTooltip(
          `<strong>${hazard.name}</strong><br/>Severity: ${hazard.severity}<br/>Zone: ${hazard.description}`,
          { sticky: true }
        );
        circle.on("click", () => onSelectHazard(hazard));
        group.addLayer(circle);
      });
    }

    // 3. Stations Markers
    if (showStations) {
      stations.forEach((st) => {
        const isHistorical = st.code === "DGT";
        const isArctic = st.latitude > 0;
        const color = isHistorical ? "#d97706" : isArctic ? "#0284c7" : "#059669";
        const isSelected = selectedStation?.code === st.code;

        // Custom DivIcon for institutional badge pin
        const customIcon = L.divIcon({
          className: "custom-station-pin",
          html: `
            <div style="
              display: flex;
              align-items: center;
              gap: 4px;
              background: white;
              border: ${isSelected ? "2px solid #0284c7" : "1px solid #cbd5e1"};
              padding: 2px 6px;
              border-radius: 6px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.12);
              font-family: monospace;
              font-size: 11px;
              font-weight: bold;
              white-space: nowrap;
              transform: translate(-50%, -100%);
              cursor: pointer;
            ">
              <span style="
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: ${color};
                display: inline-block;
              "></span>
              <span style="color: #0f172a;">${st.code}</span>
            </div>
          `,
          iconSize: [0, 0],
        });

        const marker = L.marker([st.latitude, st.longitude], { icon: customIcon });

        // Build popup content
        const weather = weatherTelemetry ? weatherTelemetry[st.code] : null;
        const weatherSnippet = weather
          ? `
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-size: 10px; font-family: monospace;">
              <div><strong>Temp:</strong> ${weather.measurements.temperatureC?.value ?? "--"}°C (Wind Chill: ${weather.derivedCalculations.apparentTemperatureC?.value ?? "--"}°C)</div>
              <div><strong>Wind:</strong> ${weather.measurements.windSpeedKmH?.value ?? "--"} km/h | <strong>Pressure:</strong> ${weather.measurements.pressureHpa?.value ?? "--"} hPa</div>
            </div>
          `
          : "";

        marker.bindPopup(`
          <div style="font-family: sans-serif; min-width: 180px;">
            <div style="font-weight: bold; font-size: 13px; color: #0f172a;">${st.name} (${st.code})</div>
            <div style="font-size: 11px; color: #64748b; font-family: monospace;">${st.region || "Polar Sector"}</div>
            <div style="font-size: 11px; color: #334155; margin-top: 4px;">
              Coordinates: ${st.latitude.toFixed(2)}°, ${st.longitude.toFixed(2)}°
            </div>
            <div style="font-size: 11px; color: #334155;">
              Status: <span style="font-weight: bold; color: ${color};">${st.status}</span>
            </div>
            ${weatherSnippet}
          </div>
        `);

        marker.on("click", () => onSelectStation(st));
        group.addLayer(marker);
      });
    }
  }, [
    stations,
    weatherTelemetry,
    selectedStation,
    showTraverseRoutes,
    showHazards,
    showStations,
    onSelectStation,
    onSelectCorridor,
    onSelectHazard,
  ]);

  // Quick sector navigation handlers
  const handleSetSector = (sector: "ANTARCTICA" | "ARCTIC" | "GLOBAL") => {
    setActiveSector(sector);
    const map = mapInstanceRef.current;
    if (!map) return;

    if (sector === "ANTARCTICA") {
      map.flyTo([-72.0, 45.0], 3, { duration: 1.2 });
    } else if (sector === "ARCTIC") {
      map.flyTo([78.92, 11.93], 7, { duration: 1.2 });
    } else {
      map.flyTo([-20.0, 30.0], 2, { duration: 1.2 });
    }
  };

  const handleFocusStation = (st: PolarMapStation) => {
    onSelectStation(st);
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo([st.latitude, st.longitude], 6, { duration: 1 });
  };

  return (
    <div className="relative w-full h-[620px] rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shadow-xs">
      <div ref={containerRef} className="w-full h-full" />

      {/* Tactical Leaflet Badge Overlay (Top-Left) */}
      <div className="absolute top-3 left-3 bg-white/95 border border-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-mono text-slate-700 shadow-xs z-[1000] backdrop-blur-xs">
        <div className="flex items-center gap-1.5 font-bold text-sky-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>LEAFLET.JS TACTICAL GIS ENGINE</span>
        </div>
        <span className="text-slate-500">CartoDB Positron Tiles • WGS 84 Dynamic Projection</span>
      </div>

      {/* Sector Focus Buttons (Top-Center) */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/95 border border-slate-200 p-1 rounded-lg shadow-xs z-[1000] flex gap-1 font-mono text-[11px] backdrop-blur-xs">
        <button
          onClick={() => handleSetSector("ANTARCTICA")}
          className={`px-2.5 py-1 rounded transition-colors cursor-pointer font-bold ${
            activeSector === "ANTARCTICA"
              ? "bg-sky-600 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          Antarctic Hub
        </button>
        <button
          onClick={() => handleSetSector("ARCTIC")}
          className={`px-2.5 py-1 rounded transition-colors cursor-pointer font-bold ${
            activeSector === "ARCTIC"
              ? "bg-sky-600 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          Arctic (Himadri)
        </button>
        <button
          onClick={() => handleSetSector("GLOBAL")}
          className={`px-2.5 py-1 rounded transition-colors cursor-pointer font-bold ${
            activeSector === "GLOBAL"
              ? "bg-sky-600 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          Global Transit
        </button>
      </div>

      {/* Station Quick Focus Chips (Bottom-Right) */}
      <div className="absolute bottom-6 right-3 flex gap-1.5 bg-white/95 p-1.5 rounded-lg border border-slate-200 shadow-xs z-[1000] backdrop-blur-xs">
        {stations.map((st) => (
          <button
            key={st.code}
            onClick={() => handleFocusStation(st)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer ${
              selectedStation?.code === st.code
                ? "bg-sky-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {st.code}
          </button>
        ))}
      </div>
    </div>
  );
}
