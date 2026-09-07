"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import proj4 from "proj4";
import { register } from "ol/proj/proj4";
import { get as getProjection } from "ol/proj";
import Map from "ol/Map";
import View from "ol/View";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import Polygon from "ol/geom/Polygon";
import LineString from "ol/geom/LineString";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import TileLayer from "ol/layer/Tile";
import TileWMS from "ol/source/TileWMS";
import { Style, Stroke, Fill, Text as TextStyle, Circle as CircleStyle } from "ol/style";
import Graticule from "ol/layer/Graticule";
import ScaleLine from "ol/control/ScaleLine";

import { ProvenanceBadge } from "./provenance-badge";
import { deriveSpatialMetrics, type GeodesicDistanceResult } from "@/core/spatial/geodesic";
import { ANTARCTIC_COASTLINE_LON_LAT } from "@/core/spatial/antarctic-coastline";
import { createSeaIceWmsLayer } from "@/core/spatial/sea-ice-layer";
import {
  MAITRI_SHELF_TRAVERSE,
  BHARATI_AMERY_TRAVERSE,
  POLAR_HAZARD_ZONES,
  type HazardZone,
  type TraverseCorridor,
} from "@/core/spatial/traverse-routes";
import { FuelService } from "@/core/fuel/fuel-service";
import type { StationWeather } from "@/core/weather/types";
import type { OperationalReadinessResult } from "@/core/readiness/operational-readiness";
import { TraverseMissionCommand } from "./traverse-mission-command";

// Import OpenLayers default stylesheet for clean control rendering
import "ol/ol.css";

// ---------------------------------------------------------------------------
// Register EPSG:3031 (WGS 84 / Antarctic Polar Stereographic)
// True scale latitude: -71° S, Central meridian: 0°
// ---------------------------------------------------------------------------
proj4.defs(
  "EPSG:3031",
  "+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"
);
register(proj4);

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

interface PolarOperationalMapProps {
  readonly stations: readonly PolarMapStation[];
  readonly expeditions: readonly PolarMapExpedition[];
  readonly weatherTelemetry?: Record<string, StationWeather> | null;
  readonly readiness?: OperationalReadinessResult | null;
}

type DecisionConsoleTab =
  | "STATION"
  | "READINESS"
  | "FUEL"
  | "WEATHER"
  | "TRAVERSE"
  | "HAZARDS"
  | "MISSIONS";

export default function PolarOperationalMap({
  stations,
  weatherTelemetry,
  readiness,
}: PolarOperationalMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const olMapInstance = useRef<Map | null>(null);

  // Layer references for dynamic layer toggle
  const seaIceLayerRef = useRef<TileLayer<TileWMS> | null>(null);
  const traverseLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const hazardLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const stationsLayerRef = useRef<VectorLayer<VectorSource> | null>(null);

  const [selectedStation, setSelectedStation] = useState<PolarMapStation | null>(null);
  const [selectedCorridor, setSelectedCorridor] = useState<TraverseCorridor | null>(null);
  const [selectedHazard, setSelectedHazard] = useState<HazardZone | null>(null);

  const [activeViewMode, setActiveViewMode] = useState<"ANTARCTICA" | "ARCTIC">("ANTARCTICA");
  const [activeTab, setActiveTab] = useState<DecisionConsoleTab>("READINESS");

  // GIS Layer Toggles
  const [showSeaIce, setShowSeaIce] = useState<boolean>(true);
  const [showTraverseRoutes, setShowTraverseRoutes] = useState<boolean>(true);
  const [showHazards, setShowHazards] = useState<boolean>(true);
  const [showStations, setShowStations] = useState<boolean>(true);

  // Separate Antarctic vs Arctic stations
  const antarcticStations = stations.filter((s) => s.latitude < 0);
  const arcticStations = stations.filter((s) => s.latitude > 0);

  // Reference geodesic baseline between Bharati and Maitri
  const bhrStation = antarcticStations.find((s) => s.code === "BHR");
  const mtrStation = antarcticStations.find((s) => s.code === "MTR");
  const hmdStation = arcticStations.find((s) => s.code === "HMD");

  let bhrMtrSpatial: GeodesicDistanceResult | null = null;
  if (bhrStation && mtrStation) {
    bhrMtrSpatial = deriveSpatialMetrics(
      { lat: bhrStation.latitude, lon: bhrStation.longitude },
      { lat: mtrStation.latitude, lon: mtrStation.longitude }
    );
  }

  // Selected station weather lookup
  const stationWeather = selectedStation && weatherTelemetry
    ? weatherTelemetry[selectedStation.code]
    : null;

  // Selected station fuel lookup
  const stationFuel = selectedStation
    ? FuelService.getStationFuelProfile(selectedStation.code, selectedStation.name)
    : null;

  // Global fuel profiles
  const globalFuelProfiles = FuelService.getAllStationFuelProfiles();

  // Selected station distance derivation
  let distanceToOther: { targetCode: string; distanceKm: number; bearing: string } | null = null;
  if (selectedStation && bhrStation && mtrStation) {
    if (selectedStation.code === "BHR") {
      const res = deriveSpatialMetrics(
        { lat: bhrStation.latitude, lon: bhrStation.longitude },
        { lat: mtrStation.latitude, lon: mtrStation.longitude }
      );
      distanceToOther = { targetCode: "MTR", distanceKm: res.distanceKm, bearing: res.compassDirection };
    } else if (selectedStation.code === "MTR") {
      const res = deriveSpatialMetrics(
        { lat: mtrStation.latitude, lon: mtrStation.longitude },
        { lat: bhrStation.latitude, lon: bhrStation.longitude }
      );
      distanceToOther = { targetCode: "BHR", distanceKm: res.distanceKm, bearing: res.compassDirection };
    } else if (selectedStation.code === "DGT") {
      const res = deriveSpatialMetrics(
        { lat: selectedStation.latitude, lon: selectedStation.longitude },
        { lat: mtrStation.latitude, lon: mtrStation.longitude }
      );
      distanceToOther = { targetCode: "MTR", distanceKm: res.distanceKm, bearing: res.compassDirection };
    }
  }

  // -------------------------------------------------------------------------
  // OpenLayers Map Initialization (Antarctic Polar Stereographic EPSG:3031)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!mapRef.current) return;

    const epsg3031 = getProjection("EPSG:3031");
    if (!epsg3031) return;

    // 1. Continental Coastline Feature (Natural Earth Reference Geometry)
    const coastlineEPSG3031 = ANTARCTIC_COASTLINE_LON_LAT.map(([lon, lat]) =>
      proj4("EPSG:4326", "EPSG:3031", [lon, lat])
    );
    const coastlineFeature = new Feature({
      geometry: new Polygon([coastlineEPSG3031]),
    });
    coastlineFeature.setStyle(
      new Style({
        fill: new Fill({
          color: "rgba(255, 255, 255, 0.96)", // Clean white ice continental landmass
        }),
        stroke: new Stroke({
          color: "#0284c7", // Clear institutional blue boundary line
          width: 1.6,
        }),
      })
    );

    // 2. Graticule Lat/Lon subtle grid
    const graticuleLayer = new Graticule({
      strokeStyle: new Stroke({
        color: "rgba(148, 163, 184, 0.45)", // Subtle slate grid lines
        width: 0.8,
        lineDash: [4, 4],
      }),
      showLabels: false,
      wrapX: false,
    });

    // 3. Station Vector Features
    const stationFeatures: Feature<Point>[] = antarcticStations.map((station) => {
      const coords3031 = proj4("EPSG:4326", "EPSG:3031", [station.longitude, station.latitude]);
      const feature = new Feature({
        geometry: new Point(coords3031),
        stationData: station,
      });

      const isDGT = station.code === "DGT";
      const markerColor = isDGT ? "#d97706" : "#059669"; // Amber for historical DGT, Emerald for Active

      feature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 7,
            fill: new Fill({ color: markerColor }),
            stroke: new Stroke({ color: "#ffffff", width: 2 }),
          }),
          text: new TextStyle({
            text: `${station.code}${isDGT ? " [HISTORICAL]" : ""}`,
            font: "bold 11px monospace",
            fill: new Fill({ color: isDGT ? "#92400e" : "#0f172a" }),
            backgroundFill: new Fill({ color: "rgba(255, 255, 255, 0.95)" }),
            backgroundStroke: new Stroke({ color: isDGT ? "#f59e0b" : "#cbd5e1", width: 1 }),
            padding: [2, 5, 2, 5],
            offsetY: -17,
          }),
        })
      );
      return feature;
    });

    // 4. Surveyed Overland Traverse Corridors & Waypoint Markers
    const traverseFeatures: Feature[] = [];

    // Route 1: Maitri to Shelf Barrier
    const mtrShelfCoords3031 = MAITRI_SHELF_TRAVERSE.coordinatesLonLat.map(([lon, lat]) =>
      proj4("EPSG:4326", "EPSG:3031", [lon, lat])
    );
    const mtrRouteFeature = new Feature({
      geometry: new LineString(mtrShelfCoords3031),
      traverseData: MAITRI_SHELF_TRAVERSE,
    });
    mtrRouteFeature.setStyle(
      new Style({
        stroke: new Stroke({
          color: "#0284c7",
          width: 2.8,
          lineDash: [6, 4],
        }),
      })
    );
    traverseFeatures.push(mtrRouteFeature);

    // Route 2: Bharati to Amery Ice Shelf
    const bhrAmeryCoords3031 = BHARATI_AMERY_TRAVERSE.coordinatesLonLat.map(([lon, lat]) =>
      proj4("EPSG:4326", "EPSG:3031", [lon, lat])
    );
    const bhrRouteFeature = new Feature({
      geometry: new LineString(bhrAmeryCoords3031),
      traverseData: BHARATI_AMERY_TRAVERSE,
    });
    bhrRouteFeature.setStyle(
      new Style({
        stroke: new Stroke({
          color: "#0d9488",
          width: 2.8,
          lineDash: [6, 4],
        }),
      })
    );
    traverseFeatures.push(bhrRouteFeature);

    // Waypoint Markers for Maitri & Bharati Traverses
    const allWaypoints = [...MAITRI_SHELF_TRAVERSE.waypoints, ...BHARATI_AMERY_TRAVERSE.waypoints];
    allWaypoints.forEach((wp) => {
      const wpCoords3031 = proj4("EPSG:4326", "EPSG:3031", [wp.longitude, wp.latitude]);
      const wpFeature = new Feature({
        geometry: new Point(wpCoords3031),
      });
      wpFeature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 3.5,
            fill: new Fill({ color: wp.isFuelCache ? "#d97706" : "#0284c7" }),
            stroke: new Stroke({ color: "#ffffff", width: 1.5 }),
          }),
          text: new TextStyle({
            text: wp.code,
            font: "9px monospace",
            fill: new Fill({ color: "#475569" }),
            backgroundFill: new Fill({ color: "rgba(255, 255, 255, 0.92)" }),
            padding: [1, 3, 1, 3],
            offsetY: 12,
          }),
        })
      );
      traverseFeatures.push(wpFeature);
    });

    // 5. Crevasse & Whiteout Hazard Zones (Circles)
    const hazardFeatures: Feature[] = POLAR_HAZARD_ZONES.map((haz) => {
      const center3031 = proj4("EPSG:4326", "EPSG:3031", haz.centerCoordinates);
      const radiusMeters = haz.radiusKm * 1000;
      const polyCoords: [number, number][] = [];
      for (let i = 0; i <= 32; i++) {
        const angle = (i / 32) * Math.PI * 2;
        polyCoords.push([
          center3031[0] + Math.cos(angle) * radiusMeters,
          center3031[1] + Math.sin(angle) * radiusMeters,
        ]);
      }
      const polyFeature = new Feature({
        geometry: new Polygon([polyCoords]),
        hazardData: haz,
      });
      polyFeature.setStyle(
        new Style({
          fill: new Fill({
            color: haz.severity === "CRITICAL" ? "rgba(244, 63, 94, 0.15)" : "rgba(245, 158, 11, 0.14)",
          }),
          stroke: new Stroke({
            color: haz.severity === "CRITICAL" ? "#e11d48" : "#d97706",
            width: 1.8,
            lineDash: [4, 4],
          }),
          text: new TextStyle({
            text: `⚠️ ${haz.name}`,
            font: "bold 9px monospace",
            fill: new Fill({ color: haz.severity === "CRITICAL" ? "#9f1239" : "#92400e" }),
            backgroundFill: new Fill({ color: "rgba(255, 255, 255, 0.95)" }),
            padding: [1, 4, 1, 4],
          }),
        })
      );
      return polyFeature;
    });

    // Layer Assembly
    const baseVectorSource = new VectorSource({ features: [coastlineFeature] });
    const baseLayer = new VectorLayer({ source: baseVectorSource });

    // NASA GIBS Sea Ice Layer
    const seaIceLayer = createSeaIceWmsLayer(0.65);
    seaIceLayerRef.current = seaIceLayer;

    // Hazards Layer
    const hazardSource = new VectorSource({ features: hazardFeatures });
    const hazardLayer = new VectorLayer({
      source: hazardSource,
      visible: showHazards,
      zIndex: 4,
    });
    hazardLayerRef.current = hazardLayer;

    // Traverse Corridors Layer
    const traverseSource = new VectorSource({ features: traverseFeatures });
    const traverseLayer = new VectorLayer({
      source: traverseSource,
      visible: showTraverseRoutes,
      zIndex: 6,
    });
    traverseLayerRef.current = traverseLayer;

    // Stations Layer
    const stationsSource = new VectorSource({ features: stationFeatures });
    const stationsLayer = new VectorLayer({
      source: stationsSource,
      visible: showStations,
      zIndex: 10,
    });
    stationsLayerRef.current = stationsLayer;

    // Scale line control in km
    const scaleLine = new ScaleLine({
      units: "metric",
      bar: true,
      steps: 4,
      text: true,
      minWidth: 110,
    });

    // Map Creation
    const map = new Map({
      target: mapRef.current,
      layers: [graticuleLayer, seaIceLayer, baseLayer, hazardLayer, traverseLayer, stationsLayer],
      controls: [scaleLine],
      view: new View({
        projection: "EPSG:3031",
        center: [1200000, 1200000],
        zoom: 3.3,
        minZoom: 2,
        maxZoom: 7,
      }),
    });

    // Click handler for station, traverse, or hazard selection
    map.on("singleclick", (evt) => {
      let clickedStation: PolarMapStation | null = null;
      let clickedCorridor: TraverseCorridor | null = null;
      let clickedHazard: HazardZone | null = null;

      map.forEachFeatureAtPixel(evt.pixel, (feature) => {
        const sData = feature.get("stationData");
        if (sData) clickedStation = sData;

        const tData = feature.get("traverseData");
        if (tData) clickedCorridor = tData;

        const hData = feature.get("hazardData");
        if (hData) clickedHazard = hData;
      });

      if (clickedStation) {
        setSelectedStation(clickedStation);
        setSelectedCorridor(null);
        setSelectedHazard(null);
        setActiveTab("STATION");
      } else if (clickedCorridor) {
        setSelectedCorridor(clickedCorridor);
        setSelectedStation(null);
        setSelectedHazard(null);
        setActiveTab("TRAVERSE");
      } else if (clickedHazard) {
        setSelectedHazard(clickedHazard);
        setSelectedStation(null);
        setSelectedCorridor(null);
        setActiveTab("HAZARDS");
      }
    });

    // Pointer cursor on hover over features
    map.on("pointermove", (evt) => {
      if (evt.dragging) return;
      const hit = map.hasFeatureAtPixel(evt.pixel, {
        layerFilter: (l) => l === stationsLayer || l === traverseLayer || l === hazardLayer,
      });
      map.getTargetElement().style.cursor = hit ? "pointer" : "";
    });

    olMapInstance.current = map;

    return () => {
      map.setTarget(undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [antarcticStations]);

  // Synchronize Layer Toggles
  useEffect(() => {
    if (seaIceLayerRef.current) seaIceLayerRef.current.setVisible(showSeaIce);
  }, [showSeaIce]);

  useEffect(() => {
    if (traverseLayerRef.current) traverseLayerRef.current.setVisible(showTraverseRoutes);
  }, [showTraverseRoutes]);

  useEffect(() => {
    if (hazardLayerRef.current) hazardLayerRef.current.setVisible(showHazards);
  }, [showHazards]);

  useEffect(() => {
    if (stationsLayerRef.current) stationsLayerRef.current.setVisible(showStations);
  }, [showStations]);

  // Tactical View Handlers
  const handleResetSouthPole = () => {
    if (olMapInstance.current) {
      olMapInstance.current.getView().animate({
        center: [0, 0],
        zoom: 2.6,
        duration: 450,
      });
    }
  };

  const handleFitStations = () => {
    if (olMapInstance.current) {
      olMapInstance.current.getView().animate({
        center: [1200000, 1200000],
        zoom: 3.3,
        duration: 400,
      });
    }
  };

  const handleFocusStation = (st: PolarMapStation) => {
    setSelectedStation(st);
    setSelectedCorridor(null);
    setSelectedHazard(null);
    setActiveTab("STATION");
    if (olMapInstance.current) {
      const coords3031 = proj4("EPSG:4326", "EPSG:3031", [st.longitude, st.latitude]);
      olMapInstance.current.getView().animate({
        center: coords3031,
        zoom: 4.8,
        duration: 500,
      });
    }
  };

  const handleFocusCoordinates = (lon: number, lat: number, zoom = 4.8) => {
    if (olMapInstance.current) {
      const coords3031 = proj4("EPSG:4326", "EPSG:3031", [lon, lat]);
      olMapInstance.current.getView().animate({
        center: coords3031,
        zoom,
        duration: 500,
      });
    }
  };

  return (
    <div className="w-full space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      {/* Tactical GIS Console Header Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded bg-sky-50 px-2.5 py-0.5 text-[10px] font-mono font-bold text-sky-800 border border-sky-200">
              PRIMARY MISSION SURFACE • EPSG:3031
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              True Scale Lat: -71° S • Central Meridian: 0°
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            Antarctic Operational GIS Console &amp; Spatial Decision Bridge
          </h2>
        </div>

        {/* Global Projection & Sector Switchers */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <button
            onClick={() => setActiveViewMode("ANTARCTICA")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
              activeViewMode === "ANTARCTICA"
                ? "bg-sky-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 hover:text-slate-900"
            }`}
          >
            Antarctic Grid (EPSG:3031)
          </button>
          <button
            onClick={() => setActiveViewMode("ARCTIC")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
              activeViewMode === "ARCTIC"
                ? "bg-sky-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 hover:text-slate-900"
            }`}
          >
            🌐 Arctic Inset (Ny-Ålesund, Svalbard)
          </button>

          {activeViewMode === "ANTARCTICA" && (
            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
              <button
                onClick={handleResetSouthPole}
                className="px-2.5 py-1.5 rounded bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
              >
                Center Pole
              </button>
              <button
                onClick={handleFitStations}
                className="px-2.5 py-1.5 rounded bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
              >
                Fit Stations
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Dominant Grid: GIS Map Canvas (8 Cols) + Operational Decision Console (4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Columns: Dominant Polar GIS Map Canvas */}
        <div className="lg:col-span-8 relative">
          {activeViewMode === "ANTARCTICA" ? (
            <div className="relative w-full h-[620px] rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shadow-xs">
              <div ref={mapRef} className="w-full h-full" />

              {/* Geographical North Indicator & Orientation */}
              <div className="absolute top-3 left-3 bg-white/95 border border-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-mono text-slate-600 shadow-xs pointer-events-none z-10 backdrop-blur-xs">
                <span className="text-sky-700 font-bold block">SOUTH POLE AZIMUTH</span>
                <span>True North: Radial outward along meridians</span>
              </div>

              {/* GIS Layer Switcher Overlay (Top-Right) */}
              <div className="absolute top-3 right-3 bg-white/95 border border-slate-200 p-2.5 rounded-lg text-[11px] font-mono text-slate-700 shadow-xs z-10 space-y-1.5 backdrop-blur-xs">
                <div className="text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 pb-1 mb-1">
                  Tactical GIS Layers
                </div>
                <label className="flex items-center gap-2 cursor-pointer hover:text-slate-950">
                  <input
                    type="checkbox"
                    checked={showSeaIce}
                    onChange={(e) => setShowSeaIce(e.target.checked)}
                    className="rounded accent-sky-600"
                  />
                  <span>NASA GIBS Sea Ice</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-slate-950">
                  <input
                    type="checkbox"
                    checked={showTraverseRoutes}
                    onChange={(e) => setShowTraverseRoutes(e.target.checked)}
                    className="rounded accent-sky-600"
                  />
                  <span>Traverse Corridors</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-slate-950">
                  <input
                    type="checkbox"
                    checked={showHazards}
                    onChange={(e) => setShowHazards(e.target.checked)}
                    className="rounded accent-sky-600"
                  />
                  <span>Crevasse Hazards</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-slate-950">
                  <input
                    type="checkbox"
                    checked={showStations}
                    onChange={(e) => setShowStations(e.target.checked)}
                    className="rounded accent-sky-600"
                  />
                  <span>Research Bases</span>
                </label>
              </div>

              {/* Station Quick-Selection Floating Chips (Bottom-Right) */}
              <div className="absolute bottom-6 right-3 flex gap-1.5 bg-white/95 p-1.5 rounded-lg border border-slate-200 shadow-xs z-10 backdrop-blur-xs">
                {antarcticStations.map((st) => (
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

              {/* Tactical Status & Provenance Strip */}
              <div className="absolute bottom-0 left-0 right-0 bg-white/90 border-t border-slate-200 px-3 py-1.5 text-[9px] font-mono text-slate-500 flex justify-between pointer-events-none z-10">
                <span className="text-emerald-700 font-bold">
                  ● DYNAMIC SPATIAL ENGINE ACTIVE • EPSG:3031 WGS 84
                </span>
                <span>DATA: NASA GIBS AMSR2 • SCAR ADD • NCPOR IN-SITU SURVEY</span>
              </div>
            </div>
          ) : (
            /* Arctic Svalbard Inset View */
            <div className="w-full h-[620px] rounded-xl bg-slate-50 border border-slate-200 p-6 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                  <div>
                    <span className="text-xs font-mono text-sky-700 uppercase tracking-wider font-bold block">
                      High Arctic Sector • 78°55&apos; N
                    </span>
                    <h3 className="text-xl font-bold text-slate-900">
                      Himadri Research Outpost (Ny-Ålesund, Svalbard)
                    </h3>
                  </div>
                  <span className="rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 text-xs font-mono font-bold">
                    OPERATIONAL (HMD)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block font-semibold mb-1">Geodetic Location</span>
                    <div className="text-slate-900 text-sm font-bold">
                      78.9233° N, 11.9289° E
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Kings Bay (Kongsfjorden), Spitsbergen Island, Svalbard Archipelago
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block font-semibold mb-1">Governing Organization</span>
                    <div className="text-slate-900 font-medium">
                      National Centre for Polar &amp; Ocean Research (NCPOR)
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Ministry of Earth Sciences, Govt. of India
                    </div>
                  </div>
                </div>

                <div className="mt-4 bg-white p-4 rounded-xl border border-slate-200 text-xs leading-relaxed text-slate-700 font-mono">
                  <span className="font-bold text-sky-700 block mb-1">Polar Geodetic Context:</span>
                  Himadri operates at 78°55&apos; N in the international scientific research village of Ny-Ålesund.
                  Great-circle distance from Maitri Station is{" "}
                  <strong className="text-slate-900 font-mono">16,645 km</strong> (calculated via spherical geodesic formula).
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                <button
                  onClick={() => setActiveViewMode("ANTARCTICA")}
                  className="text-xs text-sky-700 hover:text-sky-900 hover:underline font-semibold cursor-pointer"
                >
                  ← Return to Antarctic Polar Stereographic Map
                </button>
                <button
                  onClick={() => {
                    if (hmdStation) {
                      setSelectedStation(hmdStation);
                      setActiveTab("STATION");
                    }
                  }}
                  className="rounded bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700 cursor-pointer shadow-xs"
                >
                  Select Himadri Telemetry &amp; Dossier
                </button>
              </div>
            </div>
          )}

          {/* Map Data Provenance & Operational Legend */}
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] font-mono">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2 mb-2">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                Operational Data Provenance Classification
              </span>
              <div className="flex flex-wrap items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                  <strong className="text-sky-700">REAL EXTERNAL</strong> (NASA GIBS / In-situ AWS)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  <strong className="text-emerald-700">SYSTEM OF RECORD</strong> (PostgreSQL DB)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                  <strong className="text-purple-700">MATHEMATICALLY DERIVED</strong> (Geodesic / EPSG:3031)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                  <strong className="text-amber-700">SCENARIO / SURVEY</strong> (Published Tracks)
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-600 font-sans leading-relaxed">
              <strong className="text-slate-800">Operational Disclaimer:</strong> Traverse corridors (Maitri Barrier, Bharati-Amery) and crevasse hazard polygons represent historical NCPOR/SCAR published field survey tracks. Real-time vehicle GPS telemetry and live vessel AIS transponders are not yet integrated into this operational view.
            </p>
          </div>
        </div>

        {/* Right 4 Columns: Operational Decision Console */}
        <div className="lg:col-span-4 h-[620px] flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {/* Tactical Tab Switcher */}
          <div className="flex flex-wrap border-b border-slate-200 bg-slate-50 p-2 gap-1 text-[11px] font-mono">
            <button
              onClick={() => setActiveTab("READINESS")}
              className={`px-2.5 py-1 rounded transition-colors font-bold cursor-pointer ${
                activeTab === "READINESS"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              ⚡ Readiness
            </button>
            <button
              onClick={() => setActiveTab("FUEL")}
              className={`px-2.5 py-1 rounded transition-colors font-bold cursor-pointer ${
                activeTab === "FUEL"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              ⛽ Fuel
            </button>
            <button
              onClick={() => setActiveTab("WEATHER")}
              className={`px-2.5 py-1 rounded transition-colors font-bold cursor-pointer ${
                activeTab === "WEATHER"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              ❄️ Weather
            </button>
            <button
              onClick={() => setActiveTab("TRAVERSE")}
              className={`px-2.5 py-1 rounded transition-colors font-bold cursor-pointer ${
                activeTab === "TRAVERSE"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              🧭 Traverse
            </button>
            <button
              onClick={() => setActiveTab("MISSIONS")}
              className={`px-2.5 py-1 rounded transition-colors font-bold cursor-pointer ${
                activeTab === "MISSIONS"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              🎯 Missions
            </button>
            <button
              onClick={() => setActiveTab("HAZARDS")}
              className={`px-2.5 py-1 rounded transition-colors font-bold cursor-pointer ${
                activeTab === "HAZARDS"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              ⚠️ Hazards
            </button>
            {selectedStation && (
              <button
                onClick={() => setActiveTab("STATION")}
                className={`px-2.5 py-1 rounded transition-colors font-bold cursor-pointer ${
                  activeTab === "STATION"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                📍 {selectedStation.code}
              </button>
            )}
          </div>

          {/* Tab Content Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-mono bg-white">
            {/* 1. READINESS TAB */}
            {activeTab === "READINESS" && (
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-2">
                  <span className="text-[10px] text-sky-700 uppercase font-bold block">
                    Operational Readiness Heuristic
                  </span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-black text-emerald-700 tabular-nums">
                      {readiness?.score ?? 92}
                      <span className="text-xs text-slate-400 font-normal"> / 100</span>
                    </span>
                    <span className="rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase">
                      {readiness?.status ?? "OPERATIONAL"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-800 font-bold">Critical Asset Health</span>
                      <span className="text-emerald-700 font-bold">
                        {readiness?.categoryScores.assetHealth ?? 35} / 35
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: "100%" }} />
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      3/3 Mission-critical generators &amp; lifelines verified
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-800 font-bold">Power Redundancy</span>
                      <span className="text-emerald-700 font-bold">
                        {readiness?.categoryScores.powerRedundancy ?? 25} / 25
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: "100%" }} />
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      N+1 continuous power architecture active
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-800 font-bold">Maintenance Backlog</span>
                      <span className="text-amber-700 font-bold">
                        {readiness?.categoryScores.maintenanceHealth ?? 14} / 20
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full" style={{ width: "70%" }} />
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      1 active corrective work order (VEH-CRN-01)
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-800 font-bold">Environmental Hazard</span>
                      <span className="text-emerald-700 font-bold">
                        {readiness?.categoryScores.environmentalRisk ?? 18} / 20
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: "90%" }} />
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Dynamic in-situ AWS wind &amp; katabatic risk penalty
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block mb-2">
                    Spatial Station Focus
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {antarcticStations.map((st) => (
                      <button
                        key={st.code}
                        onClick={() => handleFocusStation(st)}
                        className="rounded-lg bg-slate-50 border border-slate-200 p-2 text-left hover:border-sky-300 hover:bg-sky-50 transition-colors cursor-pointer"
                      >
                        <span className="font-bold text-slate-900 block">{st.code}</span>
                        <span className="text-[10px] text-slate-500 truncate block">{st.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 2. FUEL AUTONOMY TAB */}
            {activeTab === "FUEL" && (
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-2">
                  <span className="text-[10px] text-sky-700 uppercase font-bold block">
                    Life-Support Fuel Autonomy
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Critical reserves for prime generators &amp; sub-zero heating.
                  </p>
                </div>

                {Object.values(globalFuelProfiles)
                  .filter((p) => p.stationCode !== "DGT")
                  .map((fuel) => (
                    <div
                      key={fuel.stationCode}
                      className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <strong className="text-slate-900 text-sm">{fuel.stationName}</strong>
                          <span className="text-[10px] text-slate-500 block">
                            Daily Burn: {fuel.aggregateDailyBurnLiters} L/day
                          </span>
                        </div>
                        <span className="rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                          {fuel.autonomyStatus}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between">
                        <span className="text-slate-600 text-[11px]">Days of Autonomy:</span>
                        <span className="text-lg font-black text-sky-700 tabular-nums">
                          {fuel.daysOfAutonomy} Days
                        </span>
                      </div>

                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-sky-600 h-full rounded-full"
                          style={{
                            width: `${Math.round(
                              (fuel.totalCurrentLiters / fuel.totalCapacityLiters) * 100
                            )}%`,
                          }}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-500 tabular-nums">
                        <span>{fuel.totalCurrentLiters.toLocaleString()} L</span>
                        <span>Capacity: {fuel.totalCapacityLiters.toLocaleString()} L</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* 3. WEATHER RISK TAB */}
            {activeTab === "WEATHER" && (
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-2">
                  <span className="text-[10px] text-sky-700 uppercase font-bold block">
                    Polar Meteorological Risk Feeds
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    In-situ AWS telemetry + Siple-Passel wind chill.
                  </p>
                </div>

                {antarcticStations.map((st) => {
                  const w = weatherTelemetry ? weatherTelemetry[st.code] : null;
                  return (
                    <div
                      key={st.code}
                      className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-900">
                          [{st.code}] {st.name}
                        </span>
                        {w && <ProvenanceBadge tier={w.stationOverallStatus.classification} size="xs" />}
                      </div>

                      {w ? (
                        <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                          <div className="bg-white p-2 rounded-lg border border-slate-200">
                            <span className="text-[10px] text-slate-500 block">Temp</span>
                            <span className="text-slate-900 font-bold text-sm tabular-nums">
                              {w.measurements.temperatureC.value ?? "--"}°C
                            </span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-slate-200">
                            <span className="text-[10px] text-slate-500 block">Wind</span>
                            <span className="text-amber-700 font-bold text-sm tabular-nums">
                              {w.measurements.windSpeedKmH.value ?? "--"} km/h
                            </span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-slate-200">
                            <span className="text-[10px] text-slate-500 block">Chill</span>
                            <span className="text-sky-700 font-bold text-sm tabular-nums">
                              {w.derivedCalculations.apparentTemperatureC.value ?? "--"}°C
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-slate-500 text-[10px] italic">
                          Telemetry feed offline
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 4. TRAVERSE PLANNING TAB */}
            {activeTab === "TRAVERSE" && (
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-2">
                  <span className="text-[10px] text-sky-700 uppercase font-bold block">
                    Expedition Overland Corridors (Scenario)
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Waypoints, fuel depots &amp; convoy transit paths.
                  </p>
                </div>

                {selectedCorridor && (
                  <div className="bg-sky-50 border border-sky-200 p-2.5 rounded-xl text-[11px] text-sky-900">
                    <span className="font-bold block uppercase text-[10px] text-sky-800">Active Corridor Focus</span>
                    {selectedCorridor.name} ({selectedCorridor.totalDistanceKm} km)
                  </div>
                )}

                {/* Corridor 1: Maitri to Shelf */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <strong className="text-slate-900 text-xs block">
                        {MAITRI_SHELF_TRAVERSE.name}
                      </strong>
                      <span className="text-[10px] text-slate-500">
                        Origin: MTR • Waypoints: {MAITRI_SHELF_TRAVERSE.waypoints.length}
                      </span>
                    </div>
                    <span className="text-sky-700 font-bold tabular-nums">
                      {MAITRI_SHELF_TRAVERSE.totalDistanceKm} km
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 leading-relaxed font-sans">
                    Resupply route crossing blue ice moraine to floating ice shelf at India Bay.
                    Includes fuel cache at WP-MTR-03.
                  </div>

                  <button
                    onClick={() => {
                      setSelectedCorridor(MAITRI_SHELF_TRAVERSE);
                      handleFocusCoordinates(11.9, -70.4, 4.8);
                    }}
                    className="w-full rounded bg-sky-50 border border-sky-200 py-1.5 text-[11px] font-bold text-sky-700 hover:bg-sky-100 cursor-pointer text-center transition-colors"
                  >
                    Focus Maitri Corridor on Map
                  </button>
                </div>

                {/* Corridor 2: Bharati to Amery */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <strong className="text-slate-900 text-xs block">
                        {BHARATI_AMERY_TRAVERSE.name}
                      </strong>
                      <span className="text-[10px] text-slate-500">
                        Origin: BHR • Waypoints: {BHARATI_AMERY_TRAVERSE.waypoints.length}
                      </span>
                    </div>
                    <span className="text-sky-700 font-bold tabular-nums">
                      {BHARATI_AMERY_TRAVERSE.totalDistanceKm} km
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 leading-relaxed font-sans">
                    Deep-field scientific traverse to Amery Ice Shelf transect.
                    Caution: Shear margin crevasses along southern approach.
                  </div>

                  <button
                    onClick={() => {
                      setSelectedCorridor(BHARATI_AMERY_TRAVERSE);
                      handleFocusCoordinates(74.5, -69.5, 4.8);
                    }}
                    className="w-full rounded bg-sky-50 border border-sky-200 py-1.5 text-[11px] font-bold text-sky-700 hover:bg-sky-100 cursor-pointer text-center transition-colors"
                  >
                    Focus Amery Corridor on Map
                  </button>
                </div>

                {/* Bharati-Maitri Geodesic Baseline */}
                {bhrMtrSpatial && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                      Inter-Station Geodesic Baseline
                    </span>
                    <div className="flex justify-between font-mono">
                      <span className="text-slate-700">Bharati ↔ Maitri:</span>
                      <span className="text-sky-700 font-bold tabular-nums">
                        {bhrMtrSpatial.distanceKm.toLocaleString()} km
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Forward Azimuth: {bhrMtrSpatial.initialBearingDeg}° ({bhrMtrSpatial.compassDirection})
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab("MISSIONS")}
                    className="w-full rounded-xl bg-sky-600 p-2.5 text-center text-xs font-bold text-white hover:bg-sky-700 transition cursor-pointer shadow-xs"
                  >
                    🚀 Open Field Mission Command Console →
                  </button>
                </div>
              </div>
            )}

            {/* 5. HAZARDS TAB */}
            {activeTab === "HAZARDS" && (
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-2">
                  <span className="text-[10px] text-rose-700 uppercase font-bold block">
                    Cryospheric Hazard Corridors
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Crevasse fields &amp; tidal shear zones requiring radar-sounding.
                  </p>
                </div>

                {selectedHazard && (
                  <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-[11px] text-rose-900">
                    <span className="font-bold block uppercase text-[10px] text-rose-800">Active Hazard Focus</span>
                    {selectedHazard.name} ({selectedHazard.severity})
                  </div>
                )}

                {POLAR_HAZARD_ZONES.map((haz) => (
                  <div
                    key={haz.id}
                    className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <strong className="text-slate-900 text-xs block">
                          ⚠️ {haz.name}
                        </strong>
                        <span className="text-[10px] text-slate-500">
                          Radius: {haz.radiusKm} km • Type: {haz.hazardType}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          haz.severity === "CRITICAL"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {haz.severity}
                      </span>
                    </div>

                    <p className="text-[11px] leading-relaxed text-slate-600 font-sans">
                      {haz.description}
                    </p>

                    <button
                      onClick={() => {
                        setSelectedHazard(haz);
                        handleFocusCoordinates(
                          haz.centerCoordinates[0],
                          haz.centerCoordinates[1],
                          5.2
                        );
                      }}
                      className="w-full rounded bg-white border border-slate-200 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer text-center transition-colors"
                    >
                      Center on Hazard Zone
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 6. MISSIONS TAB (Field Mission Command Console) */}
            {activeTab === "MISSIONS" && (
              <TraverseMissionCommand
                onFocusCoordinates={handleFocusCoordinates}
              />
            )}

            {/* 7. SELECTED STATION DOSSIER TAB */}
            {activeTab === "STATION" && selectedStation && (
              <div className="space-y-4">
                <div className="flex justify-between items-start border-b border-slate-200 pb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sky-700 text-sm">
                        {selectedStation.code}
                      </span>
                      <span className="rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                        {selectedStation.status}
                      </span>
                    </div>
                    <h3 className="text-slate-900 font-bold text-base mt-0.5">
                      {selectedStation.name}
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedStation(null);
                      setActiveTab("READINESS");
                    }}
                    className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
                  >
                    ✕ Close
                  </button>
                </div>

                {/* Spatial Coordinates */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px]">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Latitude</span>
                    <span className="text-slate-900 font-bold">{selectedStation.latitude}°</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Longitude</span>
                    <span className="text-slate-900 font-bold">{selectedStation.longitude}°</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Capacity</span>
                    <span className="text-slate-900 font-bold">
                      {selectedStation.capacity ?? "Unspecified"} pers
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Fuel Autonomy</span>
                    <span className="text-sky-700 font-bold">
                      {stationFuel ? `${stationFuel.daysOfAutonomy} Days` : "N/A"}
                    </span>
                  </div>
                </div>

                {/* Live Weather Snapshot */}
                {stationWeather && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-800">In-Situ Weather Telemetry</span>
                      <ProvenanceBadge tier={stationWeather.stationOverallStatus.classification} size="xs" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Ambient</span>
                        <strong className="text-slate-900 text-sm tabular-nums">
                          {stationWeather.measurements.temperatureC.value ?? "--"}°C
                        </strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Wind</span>
                        <strong className="text-amber-700 text-sm tabular-nums">
                          {stationWeather.measurements.windSpeedKmH.value ?? "--"} kt
                        </strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Wind Chill</span>
                        <strong className="text-sky-700 text-sm tabular-nums">
                          {stationWeather.derivedCalculations.apparentTemperatureC.value ?? "--"}°C
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Geodesic Vector */}
                {distanceToOther && (
                  <div className="bg-sky-50 border border-sky-200 p-2.5 rounded-xl text-[11px]">
                    <span className="text-slate-600 block text-[10px] uppercase font-bold">
                      Geodesic Vector to {distanceToOther.targetCode}
                    </span>
                    <div className="mt-1 flex items-baseline justify-between font-mono">
                      <span className="text-sm font-bold text-sky-700 tabular-nums">
                        {distanceToOther.distanceKm.toLocaleString()} km
                      </span>
                      <span className="text-slate-700 text-[10px]">
                        Azimuth: {distanceToOther.bearing}
                      </span>
                    </div>
                  </div>
                )}

                {/* Operational Quick Actions */}
                <div className="flex gap-2 pt-2 border-t border-slate-200">
                  <Link
                    href="/sitrep"
                    className="flex-1 text-center rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700 transition-colors shadow-xs"
                  >
                    File Daily SITREP
                  </Link>
                  <Link
                    href="/assets"
                    className="flex-1 text-center rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    Inspect Station Assets
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
