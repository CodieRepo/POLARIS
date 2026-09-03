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
import { Style, Stroke, Fill, Text as TextStyle, Circle as CircleStyle } from "ol/style";
import Graticule from "ol/layer/Graticule";
import ScaleLine from "ol/control/ScaleLine";

import { ProvenanceBadge } from "./provenance-badge";
import { deriveSpatialMetrics, type GeodesicDistanceResult } from "@/core/spatial/geodesic";
import { ANTARCTIC_COASTLINE_LON_LAT } from "@/core/spatial/antarctic-coastline";
import type { StationWeather } from "@/core/weather/types";

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
}

export default function PolarOperationalMap({
  stations,
  expeditions,
  weatherTelemetry,
}: PolarOperationalMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const olMapInstance = useRef<Map | null>(null);
  const corridorLayerRef = useRef<VectorLayer<VectorSource> | null>(null);

  const [selectedStation, setSelectedStation] = useState<PolarMapStation | null>(null);
  const [showSimulatedCorridor, setShowSimulatedCorridor] = useState<boolean>(false);
  const [activeViewMode, setActiveViewMode] = useState<"ANTARCTICA" | "ARCTIC">("ANTARCTICA");

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
          color: "rgba(15, 23, 42, 0.85)", // Dark operational landmass
        }),
        stroke: new Stroke({
          color: "#38bdf8", // Clean cyan continental boundary
          width: 1.5,
        }),
      })
    );

    // 2. Graticule Lat/Lon subtle grid
    const graticuleLayer = new Graticule({
      strokeStyle: new Stroke({
        color: "rgba(51, 65, 85, 0.4)", // Very subtle slate lines
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
      const markerColor = isDGT ? "#f59e0b" : "#10b981"; // Amber for historical DGT, Emerald for Active

      feature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: markerColor }),
            stroke: new Stroke({ color: "#020617", width: 2 }),
          }),
          text: new TextStyle({
            text: `${station.code}${isDGT ? " [HISTORICAL]" : ""}`,
            font: "bold 11px monospace",
            fill: new Fill({ color: isDGT ? "#fbbf24" : "#ffffff" }),
            backgroundFill: new Fill({ color: "rgba(2, 6, 23, 0.85)" }),
            backgroundStroke: new Stroke({ color: isDGT ? "#d97706" : "#334155", width: 1 }),
            padding: [2, 5, 2, 5],
            offsetY: -16,
          }),
        })
      );
      return feature;
    });

    // 4. Simulated Mission Corridor Feature (Bharati <-> Maitri Great-Circle Segment)
    let corridorFeatures: Feature<LineString>[] = [];
    if (bhrStation && mtrStation) {
      const corridorPoints: [number, number][] = [];
      for (let i = 0; i <= 20; i++) {
        const frac = i / 20;
        const lon = bhrStation.longitude + frac * (mtrStation.longitude - bhrStation.longitude);
        const lat = bhrStation.latitude + frac * (mtrStation.latitude - bhrStation.latitude);
        corridorPoints.push(proj4("EPSG:4326", "EPSG:3031", [lon, lat]) as [number, number]);
      }
      const corridorFeature = new Feature({
        geometry: new LineString(corridorPoints),
      });
      corridorFeature.setStyle(
        new Style({
          stroke: new Stroke({
            color: "#06b6d4",
            width: 2,
            lineDash: [6, 6],
          }),
          text: new TextStyle({
            text: "[SIMULATED SCENARIO] ISEA-44 Traverse Corridor",
            font: "bold 10px monospace",
            fill: new Fill({ color: "#38bdf8" }),
            backgroundFill: new Fill({ color: "rgba(2, 6, 23, 0.9)" }),
            backgroundStroke: new Stroke({ color: "#0891b2", width: 1 }),
            padding: [2, 6, 2, 6],
            placement: "line",
          }),
        })
      );
      corridorFeatures = [corridorFeature];
    }

    // Layer Assembly
    const baseVectorSource = new VectorSource({
      features: [coastlineFeature],
    });
    const baseLayer = new VectorLayer({
      source: baseVectorSource,
    });

    const stationsSource = new VectorSource({
      features: stationFeatures,
    });
    const stationsLayer = new VectorLayer({
      source: stationsSource,
      zIndex: 10,
    });

    const corridorSource = new VectorSource({
      features: corridorFeatures,
    });
    const corridorLayer = new VectorLayer({
      source: corridorSource,
      visible: showSimulatedCorridor,
      zIndex: 5,
    });
    corridorLayerRef.current = corridorLayer;

    // Scale line control in km
    const scaleLine = new ScaleLine({
      units: "metric",
      bar: true,
      steps: 4,
      text: true,
      minWidth: 100,
    });

    // Map Creation
    const map = new Map({
      target: mapRef.current,
      layers: [graticuleLayer, baseLayer, corridorLayer, stationsLayer],
      controls: [scaleLine],
      view: new View({
        projection: "EPSG:3031",
        center: [1200000, 1200000], // Balanced center between Bharati (~2.1M, 0.5M) and Maitri (~0.4M, 2.0M)
        zoom: 3.2,
        minZoom: 2,
        maxZoom: 7,
      }),
    });

    // Click handler for station selection
    map.on("singleclick", (evt) => {
      let clickedStation: PolarMapStation | null = null;
      map.forEachFeatureAtPixel(evt.pixel, (feature) => {
        const data = feature.get("stationData");
        if (data) {
          clickedStation = data;
        }
      });
      if (clickedStation) {
        setSelectedStation(clickedStation);
      }
    });

    // Pointer cursor on hover over stations
    map.on("pointermove", (evt) => {
      if (evt.dragging) return;
      const hit = map.hasFeatureAtPixel(evt.pixel, {
        layerFilter: (l) => l === stationsLayer,
      });
      map.getTargetElement().style.cursor = hit ? "pointer" : "";
    });

    olMapInstance.current = map;

    return () => {
      map.setTarget(undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [antarcticStations]);

  // Handle Corridor Visibility Toggle
  useEffect(() => {
    if (corridorLayerRef.current) {
      corridorLayerRef.current.setVisible(showSimulatedCorridor);
    }
  }, [showSimulatedCorridor]);

  // Reset View Handler
  const handleResetView = () => {
    if (olMapInstance.current) {
      olMapInstance.current.getView().animate({
        center: [1200000, 1200000],
        zoom: 3.2,
        duration: 400,
      });
    }
  };

  // Zoom to specific station
  const handleFocusStation = (st: PolarMapStation) => {
    setSelectedStation(st);
    if (st.latitude < 0 && olMapInstance.current) {
      const coords3031 = proj4("EPSG:4326", "EPSG:3031", [st.longitude, st.latitude]);
      olMapInstance.current.getView().animate({
        center: coords3031,
        zoom: 4.8,
        duration: 400,
      });
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-xl relative overflow-hidden">
      {/* Header & Spatial Provenance Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Tactical Polar Spatial Command &amp; Geodesic Telemetry
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
              EPSG:3031 POLAR STEREOGRAPHIC
            </span>
          </div>
          <p className="text-xs text-slate-400">
            OpenLayers GIS Engine • Antarctic Polar Stereographic projection (WGS84 true scale at -71° S)
          </p>
        </div>

        {/* Provenance Legend Bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded bg-slate-950 border border-slate-800 px-2.5 py-1 text-[11px] text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Active Base (NCPOR AWS)
          </span>
          <span className="inline-flex items-center gap-1.5 rounded bg-slate-950 border border-slate-800 px-2.5 py-1 text-[11px] text-slate-300">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            DGT (Historical Reference)
          </span>
          <span className="inline-flex items-center gap-1.5 rounded bg-slate-950 border border-slate-800 px-2.5 py-1 text-[11px] text-slate-300">
            <span className="h-2 w-2 rounded-full bg-indigo-400" />
            Geodesic (DERIVED_SPATIAL)
          </span>
          <span className="inline-flex items-center gap-1.5 rounded bg-slate-950 border border-slate-800 px-2.5 py-1 text-[11px] text-slate-300">
            <span className="w-2.5 h-2 rounded bg-slate-800 border border-cyan-500/50" />
            Coastline (REFERENCE_GEOMETRY)
          </span>
        </div>
      </div>

      {/* Map Interactive Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveViewMode("ANTARCTICA")}
            className={`px-3 py-1 rounded font-semibold transition-colors ${
              activeViewMode === "ANTARCTICA"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-slate-400 hover:text-white"
            }`}
          >
            ❄ Antarctic View (EPSG:3031)
          </button>
          <button
            onClick={() => {
              setActiveViewMode("ARCTIC");
              if (hmdStation) setSelectedStation(hmdStation);
            }}
            className={`px-3 py-1 rounded font-semibold transition-colors ${
              activeViewMode === "ARCTIC"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-slate-400 hover:text-white"
            }`}
          >
            🌐 Arctic Inset (Ny-Ålesund, Svalbard)
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeViewMode === "ANTARCTICA" && (
            <>
              <button
                onClick={() => setShowSimulatedCorridor(!showSimulatedCorridor)}
                className={`px-3 py-1 rounded font-mono text-xs font-semibold border transition-colors ${
                  showSimulatedCorridor
                    ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/40"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                }`}
              >
                {showSimulatedCorridor ? "Corridor: [SIMULATED ACTIVE]" : "Corridor: OFF"}
              </button>
              <button
                onClick={handleResetView}
                className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-semibold"
              >
                Reset Bounds
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main OpenLayers Map / Arctic View Container (7 cols) */}
        <div className="lg:col-span-7 relative">
          {activeViewMode === "ANTARCTICA" ? (
            <div className="relative w-full h-[480px] rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-inner">
              <div ref={mapRef} className="w-full h-full" />

              {/* Geographical North Indicator */}
              <div className="absolute top-3 left-3 bg-slate-950/90 border border-slate-800 px-2.5 py-1 rounded-lg text-[10px] font-mono text-slate-400 shadow-md pointer-events-none">
                <span className="text-cyan-400 font-bold block">SOUTH POLE CENTER</span>
                <span>North: Radial outward</span>
              </div>

              {/* Station Quick-Selection Floating Chips */}
              <div className="absolute bottom-3 right-3 flex gap-1.5 bg-slate-950/90 p-1.5 rounded-lg border border-slate-800 shadow-md">
                {antarcticStations.map((st) => (
                  <button
                    key={st.code}
                    onClick={() => handleFocusStation(st)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-colors ${
                      selectedStation?.code === st.code
                        ? "bg-cyan-500 text-slate-950"
                        : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {st.code}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Arctic Svalbard Inset View */
            <div className="w-full h-[480px] rounded-2xl bg-slate-950 border border-slate-800 p-6 flex flex-col justify-between shadow-inner">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div>
                    <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-bold block">
                      High Arctic Sector • 78°55&apos; N
                    </span>
                    <h3 className="text-lg font-bold text-white">
                      Himadri Research Outpost (Ny-Ålesund, Svalbard)
                    </h3>
                  </div>
                  <span className="rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-mono font-bold">
                    OPERATIONAL (HMD)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block font-semibold mb-1">Geodetic Location</span>
                    <div className="font-mono text-slate-200 text-sm">
                      78.9233° N, 11.9289° E
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Kings Bay (Kongsfjorden), Spitsbergen Island, Svalbard Archipelago
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block font-semibold mb-1">Authoritative Authority</span>
                    <div className="text-slate-200 font-medium">
                      National Centre for Polar &amp; Ocean Research (NCPOR)
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Ministry of Earth Sciences, Govt. of India
                    </div>
                  </div>
                </div>

                <div className="mt-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800 text-xs leading-relaxed text-slate-300">
                  <span className="font-bold text-cyan-400 block mb-1">Polar Geodetic Context:</span>
                  Himadri operates at 78°55&apos; N in the international scientific research village of Ny-Ålesund.
                  Because Svalbard lies in the High Arctic, it is physically antipodal to Indian Antarctic operations.
                  Great-circle distance from Maitri Station is{" "}
                  <strong className="text-white font-mono">16,645 km</strong> (calculated via spherical geodesic formula).
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <button
                  onClick={() => setActiveViewMode("ANTARCTICA")}
                  className="text-xs text-cyan-400 hover:underline font-semibold"
                >
                  ← Return to Antarctic Polar Stereographic Map
                </button>
                <button
                  onClick={() => {
                    if (hmdStation) setSelectedStation(hmdStation);
                  }}
                  className="rounded bg-cyan-500 px-3 py-1 text-xs font-bold text-slate-950 hover:bg-cyan-400"
                >
                  Inspect HMD Telemetry →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tactical Info Panel & Station Details (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {selectedStation ? (
            <div className="rounded-xl border border-cyan-500/40 bg-slate-950 p-5 shadow-2xl">
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-bold text-cyan-400">
                      {selectedStation.code}
                    </span>
                    <ProvenanceBadge
                      tier={
                        selectedStation.code === "DGT"
                          ? "HISTORICAL_REFERENCE"
                          : stationWeather?.stationOverallStatus?.classification || "AUTHORITATIVE_REAL"
                      }
                      size="xs"
                    />
                  </div>
                  <h3 className="text-base font-bold text-white">{selectedStation.name}</h3>
                </div>

                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    selectedStation.status === "ACTIVE"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  }`}
                >
                  {selectedStation.status}
                </span>
              </div>

              {/* Station Geodetic Coordinates */}
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Geodetic Coordinates (WGS84):</span>
                  <span className="font-mono text-slate-200">
                    {selectedStation.latitude.toFixed(4)}°, {selectedStation.longitude.toFixed(4)}°
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">Geographic Region:</span>
                  <span className="text-slate-300">{selectedStation.region}</span>
                </div>

                {selectedStation.code === "DGT" ? (
                  <div className="rounded bg-amber-950/40 border border-amber-800/60 p-3 text-[11px] text-amber-200 mt-2">
                    <span className="font-bold block mb-0.5">ℹ Historical Station Entity</span>
                    Dakshin Gangotri is preserved as a historical reference entity. No active logistics, fuel storage, or live weather telemetry ingestion is performed.
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Nominal Capacity:</span>
                      <span className="font-bold text-emerald-400">
                        {selectedStation.capacity} Personnel
                      </span>
                    </div>

                    {/* Live Weather Snapshot if available */}
                    {stationWeather && (
                      <div className="mt-3 rounded-lg bg-slate-900/90 border border-slate-800 p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Telemetry Snapshot
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            {stationWeather.timestamps?.observedAt || "Published Obs"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-500 block text-[10px]">Surface Temp</span>
                            <span className="font-mono font-bold text-white">
                              {stationWeather.temperatureC}°C
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">Apparent Chill</span>
                            <span className="font-mono font-bold text-cyan-300">
                              {stationWeather.apparentTemperatureC}°C
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">Wind Velocity</span>
                            <span className="font-mono text-slate-300">
                              {stationWeather.windSpeedKmH} km/h
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">Barometer</span>
                            <span className="font-mono text-slate-300">
                              {stationWeather.pressureHpa} hPa
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                          <span className="text-slate-500">Source:</span>
                          <span className="text-slate-300 font-medium">
                            {stationWeather.stationOverallStatus?.primarySource}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Derived Geodesic Vector */}
                {distanceToOther && (
                  <div className="rounded bg-indigo-950/30 border border-indigo-900/50 p-2.5 text-[11px] mt-3">
                    <div className="flex items-center justify-between text-indigo-300 font-bold mb-1">
                      <span>Great-Circle Distance Calculation</span>
                      <ProvenanceBadge tier="DERIVED_SPATIAL" size="xs" />
                    </div>
                    <div className="text-slate-300">
                      To <span className="font-mono font-bold text-white">{distanceToOther.targetCode}</span>:{" "}
                      <span className="font-mono font-bold text-cyan-400">{distanceToOther.distanceKm.toLocaleString()} km</span>{" "}
                      (Bearing: <span className="font-mono">{distanceToOther.bearing}</span>)
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Method: Haversine Spherical Geodesic Formula
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center">
                <button
                  onClick={() => setSelectedStation(null)}
                  className="text-[11px] text-slate-400 hover:text-white"
                >
                  Close Overlay
                </button>
                <Link
                  href="/stations"
                  className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors"
                >
                  Station Facility Details →
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 text-center">
              <div className="text-2xl mb-2">🧭</div>
              <h3 className="text-sm font-bold text-white">Spatial Telemetry Ready</h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Click any polar station node (<span className="text-emerald-400 font-mono">BHR</span>,{" "}
                <span className="text-emerald-400 font-mono">MTR</span>,{" "}
                <span className="text-amber-400 font-mono">DGT</span>) directly on the OpenLayers stereographic map or switch to the Arctic Outpost tab to inspect geodetic coordinates, live telemetry snapshots, and derived great-circle baseline vectors.
              </p>

              {bhrMtrSpatial && (
                <div className="mt-4 pt-3 border-t border-slate-800/80 text-left text-xs bg-slate-900/40 p-2.5 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-indigo-400">
                      Inter-Base Geodesic Baseline
                    </span>
                    <ProvenanceBadge tier="DERIVED_SPATIAL" size="xs" />
                  </div>
                  <div className="text-slate-300">
                    Bharati ↔ Maitri Distance:{" "}
                    <span className="font-mono font-bold text-cyan-400">
                      {bhrMtrSpatial.distanceKm.toLocaleString()} km
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Haversine Great-Circle forward azimuth: {bhrMtrSpatial.initialBearingDeg}° ({bhrMtrSpatial.compassDirection})
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Active Campaigns & Simulated Corridor Controls */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Expedition Mission Corridors
              </h4>
              <button
                onClick={() => setShowSimulatedCorridor(!showSimulatedCorridor)}
                className="text-[10px] font-mono text-cyan-400 hover:underline"
              >
                {showSimulatedCorridor ? "Hide Simulated Corridor" : "Show Simulated Corridor"}
              </button>
            </div>

            <div className="space-y-2">
              {expeditions.map((exp) => (
                <div
                  key={exp.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/50 p-2.5 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-cyan-400 font-bold">{exp.code}</span>
                      <span className="text-slate-200">{exp.name}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <span className="text-amber-400/90 font-mono">[SIMULATED SCENARIO]</span>
                      <span>•</span>
                      <span>Traverse corridor {showSimulatedCorridor ? "visible on map" : "hidden"}</span>
                    </div>
                  </div>
                  <Link
                    href={`/expeditions/${exp.code}`}
                    className="text-[11px] font-semibold text-cyan-400 hover:underline shrink-0 ml-2"
                  >
                    Mission →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
