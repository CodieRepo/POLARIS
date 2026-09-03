"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ProvenanceBadge } from "./provenance-badge";
import { deriveSpatialMetrics, type GeodesicDistanceResult } from "@/core/spatial/geodesic";
import type { StationWeather } from "@/core/weather/types";

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

/**
 * Converts Geodetic Coordinates (Lat, Lon) to 2D Polar Stereographic SVG Projection
 * Centered on South Pole (-90°).
 * Center: (300, 300), Radius: 240px covering from -90° (South Pole) to -60° (Antarctic Circle).
 */
function projectAntarcticCoord(lat: number, lon: number): { x: number; y: number } {
  const cx = 300;
  const cy = 300;
  const maxRadius = 240;

  // Clamping latitude to valid Antarctic operational extent [-90°, -60°]
  const clampedLat = Math.max(-90, Math.min(-60, lat));
  const r = Math.max(15, Math.min(maxRadius, ((clampedLat - (-90)) / 30) * maxRadius));
  const theta = (lon * Math.PI) / 180;

  return {
    x: cx + r * Math.cos(theta),
    y: cy + r * Math.sin(theta),
  };
}

export default function PolarOperationalMap({
  stations,
  expeditions,
  weatherTelemetry,
}: PolarOperationalMapProps) {
  const [selectedStation, setSelectedStation] = useState<PolarMapStation | null>(null);
  const [showSimulatedRoute, setShowSimulatedRoute] = useState<boolean>(true);

  // Filter Antarctic vs Arctic stations
  const antarcticStations = stations.filter((s) => s.latitude < 0);
  const arcticStations = stations.filter((s) => s.latitude > 0);

  // Compute reference geodesic metrics between Indian Antarctic stations (Bharati <-> Maitri)
  const bhrStation = antarcticStations.find((s) => s.code === "BHR");
  const mtrStation = antarcticStations.find((s) => s.code === "MTR");

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

  // Selected station distance to other station
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

  // Projection points for simulated route line
  const bhrPos = bhrStation ? projectAntarcticCoord(bhrStation.latitude, bhrStation.longitude) : null;
  const mtrPos = mtrStation ? projectAntarcticCoord(mtrStation.latitude, mtrStation.longitude) : null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-xl relative overflow-hidden">
      {/* Header & Spatial Provenance Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Tactical Polar Spatial Command &amp; Geodesic Telemetry
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            South Polar Stereographic Basemap (-90° to -60° S, WGS84) with Arctic Svalbard Inset
          </p>
        </div>

        {/* Provenance Legend Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded bg-slate-950 border border-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Active Base (NCPOR AWS)
          </span>
          <span className="inline-flex items-center gap-1 rounded bg-slate-950 border border-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            DGT (Historical Entity)
          </span>
          <span className="inline-flex items-center gap-1 rounded bg-slate-950 border border-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
            <span className="h-2 w-2 rounded-full bg-indigo-400" />
            Geodesic Vector (DERIVED_SPATIAL)
          </span>
          <span className="inline-flex items-center gap-1 rounded bg-slate-950 border border-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
            <span className="w-2.5 h-2 rounded bg-slate-700 border border-slate-600" />
            Coastline (REFERENCE_GEOMETRY)
          </span>
          <span className="inline-flex items-center gap-1 rounded bg-slate-950 border border-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
            <span className="w-3 h-0.5 bg-cyan-400 border-b border-dashed" />
            Simulated Corridor
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Main Polar Projection SVG Canvas (7 cols) */}
        <div className="lg:col-span-7 flex justify-center relative">
          <div className="relative w-full max-w-[440px] aspect-square">
            <svg
              viewBox="0 0 600 600"
              className="w-full h-full rounded-2xl bg-slate-950 border border-slate-800/90 shadow-inner"
            >
              <defs>
                <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#0891b2" stopOpacity="0.18" />
                  <stop offset="65%" stopColor="#0284c7" stopOpacity="0.06" />
                  <stop offset="100%" stopColor="#020617" stopOpacity="0" />
                </radialGradient>

                {/* Continental Landmass Fill Gradient */}
                <radialGradient id="iceSheet" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#1e293b" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0.8" />
                </radialGradient>
              </defs>

              {/* Radar Background Glow */}
              <circle cx="300" cy="300" r="270" fill="url(#radarGlow)" />

              {/* Generalized Antarctic Continental Coastline Reference Geometry */}
              {/* Queen Maud Land, Enderby Land, Amery Ice Shelf, Ross Sea, Ronne Shelf */}
              <path
                d="M 270 120 C 340 100 420 140 450 190 C 470 230 460 300 430 360 C 400 410 330 460 270 450 C 210 440 160 380 150 320 C 140 260 170 190 220 140 Z"
                fill="url(#iceSheet)"
                stroke="#334155"
                strokeWidth="1.5"
                strokeDasharray="2,2"
                opacity="0.8"
              />
              <text x="320" y="380" fill="#475569" fontSize="10" fontFamily="monospace" letterSpacing="2">
                ANTARCTIC CONTINENT
              </text>

              {/* Polar Latitude Concentric Grids (-80°, -70°, -60° S) */}
              <circle cx="300" cy="300" r="80" stroke="#334155" strokeWidth="1" strokeDasharray="4,4" fill="none" />
              <circle cx="300" cy="300" r="160" stroke="#334155" strokeWidth="1" strokeDasharray="4,4" fill="none" />
              <circle cx="300" cy="300" r="240" stroke="#475569" strokeWidth="1.5" fill="none" />

              {/* Meridian Crosshairs */}
              <line x1="300" y1="30" x2="300" y2="570" stroke="#1e293b" strokeWidth="1" />
              <line x1="30" y1="300" x2="570" y2="300" stroke="#1e293b" strokeWidth="1" />

              {/* Latitude Labels */}
              <text x="305" y="215" fill="#64748b" fontSize="9" fontFamily="monospace">-80° S</text>
              <text x="305" y="135" fill="#64748b" fontSize="9" fontFamily="monospace">-70° S</text>
              <text x="305" y="55" fill="#64748b" fontSize="9" fontFamily="monospace">-60° S (Antarctic Circle)</text>

              {/* South Pole Center Marker (-90° S) */}
              <circle cx="300" cy="300" r="4" fill="#06b6d4" />
              <text x="310" y="304" fill="#38bdf8" fontSize="10" fontWeight="bold" fontFamily="monospace">
                SOUTH POLE (-90° S)
              </text>

              {/* Simulated Traverse Route Corridor with Explicit SIMULATED SCENARIO Label */}
              {showSimulatedRoute && bhrPos && mtrPos && (
                <g>
                  <path
                    d={`M ${bhrPos.x} ${bhrPos.y} Q 310 180 ${mtrPos.x} ${mtrPos.y}`}
                    stroke="#06b6d4"
                    strokeWidth="2"
                    strokeDasharray="6,4"
                    fill="none"
                    opacity="0.75"
                  />
                  {/* Explicit SIMULATED SCENARIO Banner on Route */}
                  <rect
                    x="240"
                    y="160"
                    width="125"
                    height="18"
                    rx="3"
                    fill="#020617"
                    stroke="#0891b2"
                    strokeWidth="1"
                    opacity="0.9"
                  />
                  <text
                    x="245"
                    y="172"
                    fill="#38bdf8"
                    fontSize="8.5"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    [SIMULATED SCENARIO]
                  </text>
                  <text
                    x="245"
                    y="190"
                    fill="#64748b"
                    fontSize="8"
                    fontFamily="monospace"
                  >
                    ISEA-44 Traverse Corridor
                  </text>
                </g>
              )}

              {/* Antarctic Station Nodes */}
              {antarcticStations.map((station) => {
                const pos = projectAntarcticCoord(station.latitude, station.longitude);
                const isSelected = selectedStation?.id === station.id;
                const isDGT = station.code === "DGT";

                return (
                  <g
                    key={station.id}
                    className="cursor-pointer transition-transform hover:scale-110"
                    onClick={() => setSelectedStation(station)}
                  >
                    {/* Active pulse ring */}
                    {station.status === "ACTIVE" && (
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r="14"
                        fill="#10b981"
                        opacity="0.25"
                        className="animate-ping"
                      />
                    )}

                    {/* Node Dot: Green for Active, Amber for DGT historical */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={isSelected ? "9" : "7"}
                      fill={isDGT ? "#f59e0b" : "#10b981"}
                      stroke="#020617"
                      strokeWidth="2"
                    />

                    {/* Station Tag Box */}
                    <rect
                      x={pos.x + 10}
                      y={pos.y - 12}
                      width={isDGT ? "48" : "42"}
                      height="18"
                      rx="4"
                      fill="#020617"
                      stroke={isSelected ? "#38bdf8" : isDGT ? "#d97706" : "#334155"}
                      strokeWidth="1"
                    />
                    <text
                      x={pos.x + 15}
                      y={pos.y + 1}
                      fill={isDGT ? "#fbbf24" : "#f8fafc"}
                      fontSize="9.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {station.code}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Arctic Inset Window (Himadri at Ny-Ålesund, Svalbard +78.92° N) */}
            {arcticStations.length > 0 && (
              <div className="absolute top-2 right-2 rounded-xl border border-slate-700/80 bg-slate-950/95 p-3 backdrop-blur-md shadow-2xl text-left max-w-[175px]">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="text-[9.5px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                    <span>🌐</span> Arctic Inset
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400 font-bold bg-emerald-950 px-1 py-0.2 rounded border border-emerald-800">
                    SVALBARD
                  </span>
                </div>
                {arcticStations.map((st) => (
                  <div
                    key={st.id}
                    onClick={() => setSelectedStation(st)}
                    className="mt-1 cursor-pointer hover:bg-slate-900 rounded p-1.5 transition-colors border border-slate-800/80"
                  >
                    <div className="font-mono text-xs font-bold text-white flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {st.code} ({st.name})
                      </span>
                    </div>
                    <div className="text-[9.5px] text-slate-400 font-mono mt-0.5">
                      {st.latitude.toFixed(2)}° N, {st.longitude.toFixed(2)}° E
                    </div>
                    <div className="text-[9px] text-cyan-400/90 font-medium mt-0.5">
                      Click to inspect telemetry ↗
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tactical Info Panel & Station Inspection (5 cols) */}
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
                  <div className="rounded bg-amber-950/40 border border-amber-800/60 p-2.5 text-[11px] text-amber-200 mt-2">
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
                <span className="text-cyan-400 font-mono">HMD</span>, or historical{" "}
                <span className="text-amber-400 font-mono">DGT</span>) on the stereographic projection to inspect WGS84 coordinates, live published telemetry, and derived great-circle distances.
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
                onClick={() => setShowSimulatedRoute(!showSimulatedRoute)}
                className="text-[10px] font-mono text-cyan-400 hover:underline"
              >
                {showSimulatedRoute ? "Hide Corridor" : "Show Corridor"}
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
                      <span>Traverse corridor active</span>
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
