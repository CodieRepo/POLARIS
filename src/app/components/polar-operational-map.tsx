"use client";

import React, { useState } from "react";
import Link from "next/link";

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
}

/**
 * Converts Geodetic Coordinates (Lat, Lon) to 2D Stereographic SVG Projection centered on South Pole (-90°).
 * Center: (300, 300), Radius: ~250px covering from -90° (South Pole) to -60° (Antarctic Circle).
 */
function projectAntarcticCoord(lat: number, lon: number): { x: number; y: number } {
  const cx = 300;
  const cy = 300;
  const maxRadius = 240;

  // Lat ranges from -90 to -60. Normalizing: -90 -> 0, -60 -> maxRadius
  const r = Math.max(15, Math.min(maxRadius, ((lat - (-90)) / 30) * maxRadius));
  // Lon in radians (-180 to 180)
  const theta = (lon * Math.PI) / 180;

  return {
    x: cx + r * Math.cos(theta),
    y: cy + r * Math.sin(theta),
  };
}

export default function PolarOperationalMap({
  stations,
  expeditions,
}: PolarOperationalMapProps) {
  const [selectedStation, setSelectedStation] = useState<PolarMapStation | null>(null);

  // Filter Antarctic vs Arctic stations
  const antarcticStations = stations.filter((s) => s.latitude < 0);
  const arcticStations = stations.filter((s) => s.latitude > 0);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-xl relative overflow-hidden">
      {/* Header & Mode Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
            Tactical Polar Spatial Command
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Polar Stereographic Projection (-90° to -60° S) &amp; Arctic Outpost Inset
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 text-[10px] font-mono text-cyan-400">
            WGS84 GEODETIC
          </span>
          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-mono text-emerald-400">
            {antarcticStations.length} ANTARCTIC / {arcticStations.length} ARCTIC
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Main Polar Projection SVG Canvas (7 cols) */}
        <div className="lg:col-span-7 flex justify-center relative">
          <div className="relative w-full max-w-[420px] aspect-square">
            <svg
              viewBox="0 0 600 600"
              className="w-full h-full rounded-2xl bg-slate-950 border border-slate-800/80 shadow-inner"
            >
              <defs>
                {/* Tactical Radar Grid Gradient */}
                <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#0891b2" stopOpacity="0.15" />
                  <stop offset="70%" stopColor="#0284c7" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#020617" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Radar Background Glow */}
              <circle cx="300" cy="300" r="270" fill="url(#radarGlow)" />

              {/* Polar Latitude Concentric Grids (-80°, -70°, -60°) */}
              <circle cx="300" cy="300" r="80" stroke="#334155" strokeWidth="1" strokeDasharray="4,4" fill="none" />
              <circle cx="300" cy="300" r="160" stroke="#334155" strokeWidth="1" strokeDasharray="4,4" fill="none" />
              <circle cx="300" cy="300" r="240" stroke="#475569" strokeWidth="1.5" fill="none" />

              {/* Meridian Crosshairs (0°, 90°, 180°, 270°) */}
              <line x1="300" y1="30" x2="300" y2="570" stroke="#1e293b" strokeWidth="1" />
              <line x1="30" y1="300" x2="570" y2="300" stroke="#1e293b" strokeWidth="1" />

              {/* Latitude Labels */}
              <text x="305" y="215" fill="#64748b" fontSize="10" fontFamily="monospace">-80° S</text>
              <text x="305" y="135" fill="#64748b" fontSize="10" fontFamily="monospace">-70° S</text>
              <text x="305" y="55" fill="#64748b" fontSize="10" fontFamily="monospace">-60° S (Antarctic Circle)</text>

              {/* South Pole Center Marker (-90° S) */}
              <circle cx="300" cy="300" r="4" fill="#06b6d4" />
              <text x="310" y="304" fill="#38bdf8" fontSize="11" fontWeight="bold" fontFamily="monospace">
                SOUTH POLE (-90° S)
              </text>

              {/* Traverse Route Simulation Corridor (Bharati -> Maitri) */}
              <path
                d="M 370 210 Q 320 230 235 240"
                stroke="#06b6d4"
                strokeWidth="2"
                strokeDasharray="6,4"
                fill="none"
                opacity="0.6"
              />
              <text x="270" y="220" fill="#06b6d4" fontSize="9" fontFamily="monospace" opacity="0.8">
                ISEA-44 Traverse Corridor
              </text>

              {/* Antarctic Station Markers */}
              {antarcticStations.map((station) => {
                const pos = projectAntarcticCoord(station.latitude, station.longitude);
                const isSelected = selectedStation?.id === station.id;

                return (
                  <g
                    key={station.id}
                    className="cursor-pointer transition-transform hover:scale-110"
                    onClick={() => setSelectedStation(station)}
                  >
                    {/* Pulsing ring on active base */}
                    {station.status === "ACTIVE" && (
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r="14"
                        fill="#10b981"
                        opacity="0.2"
                        className="animate-ping"
                      />
                    )}

                    {/* Target crosshair */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={isSelected ? "9" : "7"}
                      fill={station.status === "ACTIVE" ? "#10b981" : "#f59e0b"}
                      stroke="#0f172a"
                      strokeWidth="2"
                    />

                    {/* Base Code Tag */}
                    <rect
                      x={pos.x + 10}
                      y={pos.y - 12}
                      width="42"
                      height="18"
                      rx="4"
                      fill="#0f172a"
                      stroke={isSelected ? "#38bdf8" : "#334155"}
                      strokeWidth="1"
                    />
                    <text
                      x={pos.x + 16}
                      y={pos.y + 1}
                      fill="#f8fafc"
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {station.code}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Arctic Inset Window (Himadri at Ny-Ålesund, Svalbard) */}
            {arcticStations.length > 0 && (
              <div className="absolute top-2 right-2 rounded-xl border border-slate-700/80 bg-slate-950/90 p-2.5 backdrop-blur-sm shadow-xl text-left max-w-[150px]">
                <div className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                  <span>🌐</span> Arctic Inset
                </div>
                {arcticStations.map((st) => (
                  <div
                    key={st.id}
                    onClick={() => setSelectedStation(st)}
                    className="mt-1.5 cursor-pointer hover:bg-slate-900 rounded p-1 transition-colors"
                  >
                    <div className="font-mono text-xs font-bold text-white flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {st.code} ({st.name})
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono">
                      {st.latitude.toFixed(2)}° N, {st.longitude.toFixed(2)}° E
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tactical Info Panel & Station Details (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {selectedStation ? (
            <div className="rounded-xl border border-cyan-500/40 bg-slate-950 p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="font-mono text-xs font-bold text-cyan-400">
                    {selectedStation.code}
                  </span>
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

              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Coordinates (WGS84):</span>
                  <span className="font-mono text-slate-200">
                    {selectedStation.latitude.toFixed(4)}°, {selectedStation.longitude.toFixed(4)}°
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Wintering Capacity:</span>
                  <span className="font-bold text-emerald-400">
                    {selectedStation.capacity} Personnel
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Geographic Sector:</span>
                  <span className="text-slate-300">{selectedStation.region}</span>
                </div>
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
                  View Station Facility →
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 text-center">
              <div className="text-2xl mb-2">🧭</div>
              <h3 className="text-sm font-bold text-white">Spatial Telemetry Ready</h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Click any polar station node (<span className="text-cyan-400 font-mono">BHR</span>,{" "}
                <span className="text-emerald-400 font-mono">MTR</span>,{" "}
                <span className="text-amber-400 font-mono">HMD</span>) on the radar projection to inspect coordinates, winter capacity, and assigned field support.
              </p>
            </div>
          )}

          {/* Active Campaigns Strip */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Active Expedition Corridors
            </h4>
            <div className="space-y-2">
              {expeditions.map((exp) => (
                <div
                  key={exp.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/50 p-2 text-xs"
                >
                  <div>
                    <span className="font-mono text-cyan-400 font-bold mr-2">{exp.code}</span>
                    <span className="text-slate-200">{exp.name}</span>
                  </div>
                  <Link
                    href={`/expeditions/${exp.code}`}
                    className="text-[11px] font-semibold text-cyan-400 hover:underline"
                  >
                    Open Mission →
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
