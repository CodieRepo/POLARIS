"use client";

import React, { useState } from "react";

interface DataProvenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FilterCategory = "ALL" | "REALTIME" | "HISTORICAL" | "SIMULATED" | "CALCULATED";

export function DataProvenanceModal({ isOpen, onClose }: DataProvenanceModalProps) {
  const [filter, setFilter] = useState<FilterCategory>("ALL");

  if (!isOpen) return null;

  const dataStreams = [
    {
      id: "aws-weather",
      name: "Ground Weather Telemetry",
      category: "REALTIME",
      categoryLabel: "Near-Real-Time Observations",
      categoryColor: "bg-emerald-50 text-emerald-800 border-emerald-300",
      categoryDot: "bg-emerald-500",
      coverage: "Bharati (Antarctica), Maitri (Antarctica), Himadri (Arctic)",
      source: "NCPOR In-Situ Automatic Weather Stations (Campbell Scientific AWS)",
      pipeline: "Satellite Telemetry Uplink → NCPOR Open Access API → In-memory Cache (15m TTL)",
      howItWorks: "Ground sensors physically measure surface temperature, atmospheric pressure, relative humidity, and 10m anemometer wind velocity and publish periodic observations.",
      whyItMatters: "Direct ground truth is critical in polar regions; synthetic models often miss localized Antarctic katabatic wind events.",
    },
    {
      id: "mosdac-winds",
      name: "Southern Ocean Wind Vectors",
      category: "REALTIME",
      categoryLabel: "Satellite Reference Dataset",
      categoryColor: "bg-cyan-50 text-cyan-800 border-cyan-300",
      categoryDot: "bg-cyan-500",
      coverage: "India-to-Antarctica Corridor (50°S to 70°S)",
      source: "ISRO MOSDAC (Oceansat-2 / OSCAT Ku-Band Scatterometer)",
      pipeline: "ISRO MOSDAC HDF5 Earth Observation Data → Local Spatial Ingest Pipeline → GeoJSON Layer",
      howItWorks: "Radar scatterometry measures ocean surface roughness (capillary waves) to infer 10m wind speed and directional arrows along the resupply vessel corridor.",
      whyItMatters: "Provides high-seas sea-state intelligence across the Roaring Forties and Furious Fifties where no weather buoys exist.",
    },
    {
      id: "dgt-base",
      name: "Dakshin Gangotri Station Record",
      category: "HISTORICAL",
      categoryLabel: "Past / Historical Data",
      categoryColor: "bg-slate-100 text-slate-800 border-slate-300",
      categoryDot: "bg-slate-500",
      coverage: "Schirmacher Oasis, Antarctica (70.08° S, 12.00° E)",
      source: "NCPOR Antarctic Expedition Archives & Historic Records",
      pipeline: "Static Historical Record Registry (Decommissioned 1990)",
      howItWorks: "Preserved as India's first permanent Antarctic research station (operational 1983–1990, now buried under ice and designated as Historic Site No. 44 under the Antarctic Treaty).",
      whyItMatters: "Maintains institutional continuity and historical cartographic context for the Indian Antarctic Programme.",
    },
    {
      id: "weather-trend",
      name: "24h Atmospheric Pressure History",
      category: "HISTORICAL",
      categoryLabel: "Past / Historical Data",
      categoryColor: "bg-slate-100 text-slate-800 border-slate-300",
      categoryDot: "bg-slate-500",
      coverage: "Bharati, Maitri, Himadri AWS Stations",
      source: "NCPOR Weather Telemetry Archive Log",
      pipeline: "Periodic Ingest → Time-Series Archive → Exact Discrete Points (No Splines)",
      howItWorks: "Persisted authentic observations plotted as a slope over 24 hours. A rapid pressure drop (> 2 hPa/3h) signals an approaching severe polar blizzard.",
      whyItMatters: "Zero fabrication policy: POLARIS strictly refuses to draw synthetic Bézier curves if real sensor history is insufficient.",
    },
    {
      id: "daily-sitrep",
      name: "Daily Situation Reports (SITREPs)",
      category: "HISTORICAL",
      categoryLabel: "Past / Official Records",
      categoryColor: "bg-slate-100 text-slate-800 border-slate-300",
      categoryDot: "bg-slate-500",
      coverage: "Station Commanders (Bharati, Maitri)",
      source: "Official Station Dispatch Logs",
      pipeline: "Station Dispatch → NCPOR HQ Log → SHA-256 Cryptographic Signature",
      howItWorks: "Station leaders log personnel headcount, medical status, generator fuel levels, and outdoor travel bans. Every dispatch is signed with a SHA-256 hash to guarantee zero tampering.",
      whyItMatters: "Serves as the legally authoritative system of record for MoES and international Antarctic Treaty inspections.",
    },
    {
      id: "maritime-voyage",
      name: "Resupply Vessel (MV Vasiliy Golovnin)",
      category: "SIMULATED",
      categoryLabel: "Operational Simulation",
      categoryColor: "bg-amber-50 text-amber-800 border-amber-300",
      categoryDot: "bg-amber-500",
      coverage: "Mormugao Port (Goa) → Cape Town → Antarctica Ice Shelf",
      source: "COMNAP / NCPOR 44th ISEA Resupply Voyage Model",
      pipeline: "Pre-Deployment Logistical Scenario Engine → Step-by-Step Waypoint Simulation",
      howItWorks: "Simulates chartered icebreaker transit stages, fuel burn, cargo gross tonnage, and ice-barrier offload staging prior to physical arrival.",
      whyItMatters: "Allows mission directors to stress-test station stockout risks and evaluate buffer fuel before the ship reaches Antarctica.",
    },
    {
      id: "cargo-pipeline",
      name: "ISO 20ft Container Manifest Pipeline",
      category: "SIMULATED",
      categoryLabel: "Operational Simulation",
      categoryColor: "bg-amber-50 text-amber-800 border-amber-300",
      categoryDot: "bg-amber-500",
      coverage: "12 Tracked Containers (Food, Spares, Scientific Drills, Jet A-1 Fuel)",
      source: "NCPOR Freight Operations Model",
      pipeline: "Interactive Stage Transition State Machine (Goa → Cape Town → Southern Ocean → Barrier → Base)",
      howItWorks: "Tracks containers across 5 logistical checkpoints, calculating gross weights and arrival priorities for station wintering teams.",
      whyItMatters: "Ensures hazardous materials (e.g. explosive seismic charges or radioactive tracers) are tracked transparently across customs and sea voyage.",
    },
    {
      id: "fuel-autonomy",
      name: "Station Fuel Farm Autonomy Days",
      category: "CALCULATED",
      categoryLabel: "Deterministic Calculation",
      categoryColor: "bg-purple-50 text-purple-800 border-purple-300",
      categoryDot: "bg-purple-500",
      coverage: "Bharati (BHR), Maitri (MTR), Himadri (HMD)",
      source: "Station Ultrasonic Level Sensors & Tank Dips + Daily Burn Logs",
      pipeline: "Ultrasonic Gauges → Fuel Repository → Mathematical Formula: Days = Balance / Daily Burn",
      howItWorks: "Evaluates current remaining Aviation Turbine Fuel (ATF) against average daily diesel generator consumption (e.g., Bharati 320,000 L / 1,250 L/day = 256 Days).",
      whyItMatters: "Life-or-death metric in polar winter; without fuel, station heating and power fail in -40°C blizzard temperatures.",
    },
    {
      id: "readiness-score",
      name: "Operational Readiness Score (88/100)",
      category: "CALCULATED",
      categoryLabel: "Deterministic Calculation",
      categoryColor: "bg-purple-50 text-purple-800 border-purple-300",
      categoryDot: "bg-purple-500",
      coverage: "Entire Polar Mission Infrastructure",
      source: "POLARIS 4-Pillar Algorithmic Scorer",
      pipeline: "Weighted Heuristic Engine: Asset Health (35%) + Power Redundancy (25%) + Maintenance (20%) + Environment (20%)",
      howItWorks: "Calculates an instant, explainable score out of 100 with transparent point deductions (e.g., -5 pts for cold soak generator stress, -7 pts for high wind speed).",
      whyItMatters: "Provides high-level decision makers with an instant health metric while showing every underlying point deduction.",
    },
    {
      id: "wind-chill",
      name: "Apparent Wind Chill & Solar Ephemeris",
      category: "CALCULATED",
      categoryLabel: "Deterministic Calculation",
      categoryColor: "bg-purple-50 text-purple-800 border-purple-300",
      categoryDot: "bg-purple-500",
      coverage: "All Active Stations",
      source: "Siple-Passel Antarctic Formula & Spencer (1971) Solar Algorithm",
      pipeline: "Live Temperature + Wind Velocity + Solar Elevation Angles → 0ms Mathematical Execution",
      howItWorks: "Computes effective frostbite risk (apparent temp) and solar regime (Polar Night, Twilight, Continuous Daylight) based on station latitude and day of year.",
      whyItMatters: "Determines whether expedition teams are permitted outside the station habitat modules.",
    },
  ];

  const filtered = filter === "ALL" ? dataStreams : dataStreams.filter((d) => d.category === filter);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 p-5 sm:p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="rounded-md bg-sky-100 px-2.5 py-0.5 text-xs font-mono font-bold text-sky-800 border border-sky-200">
                DATA PROVENANCE &amp; PIPELINES
              </span>
              <span className="text-xs text-slate-500 font-mono">
                NCPOR / MoES Operational Standard
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              POLARIS Data Origin &amp; Integrity Charter
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
              Transparent disclosure of every data stream: distinguishing <strong>On-Demand Physical Sensors</strong>,{" "}
              <strong>Historical Archives</strong>, <strong>Operational Simulations</strong>, and{" "}
              <strong>Deterministic Mathematical Calculations</strong>.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer text-sm font-bold"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* 4 Classification Pill Summaries */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 sm:p-6 border-b border-slate-200 bg-slate-50/50">
          <div
            onClick={() => setFilter(filter === "REALTIME" ? "ALL" : "REALTIME")}
            className={`cursor-pointer rounded-xl border p-3 transition-all ${
              filter === "REALTIME"
                ? "border-emerald-500 bg-emerald-50 shadow-xs"
                : "border-emerald-200 bg-white hover:border-emerald-400"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <strong className="text-xs font-bold text-emerald-900">OBSERVED</strong>
            </div>
            <span className="text-[11px] text-emerald-800 block">On-Demand Physical Observations</span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">AWS Sensors (NCPOR)</span>
          </div>

          <div
            onClick={() => setFilter(filter === "HISTORICAL" ? "ALL" : "HISTORICAL")}
            className={`cursor-pointer rounded-xl border p-3 transition-all ${
              filter === "HISTORICAL"
                ? "border-slate-500 bg-slate-100 shadow-xs"
                : "border-slate-200 bg-white hover:border-slate-400"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="h-2 w-2 rounded-full bg-slate-600" />
              <strong className="text-xs font-bold text-slate-900">PAST DATA</strong>
            </div>
            <span className="text-[11px] text-slate-800 block">Historical Archives</span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">24h AWS Logs &amp; Dakshin Gangotri</span>
          </div>

          <div
            onClick={() => setFilter(filter === "SIMULATED" ? "ALL" : "SIMULATED")}
            className={`cursor-pointer rounded-xl border p-3 transition-all ${
              filter === "SIMULATED"
                ? "border-amber-500 bg-amber-50 shadow-xs"
                : "border-amber-200 bg-white hover:border-amber-400"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <strong className="text-xs font-bold text-amber-900">SIMULATED</strong>
            </div>
            <span className="text-[11px] text-amber-800 block">Scenario Models</span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Resupply Ship &amp; Cargo Stages</span>
          </div>

          <div
            onClick={() => setFilter(filter === "CALCULATED" ? "ALL" : "CALCULATED")}
            className={`cursor-pointer rounded-xl border p-3 transition-all ${
              filter === "CALCULATED"
                ? "border-purple-500 bg-purple-50 shadow-xs"
                : "border-purple-200 bg-white hover:border-purple-400"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="h-2 w-2 rounded-full bg-purple-600" />
              <strong className="text-xs font-bold text-purple-900">CALCULATED</strong>
            </div>
            <span className="text-[11px] text-purple-800 block">Deterministic Math</span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Fuel Autonomy &amp; Readiness Score</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-5 sm:px-6 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <span className="text-slate-500">
            Showing <strong>{filtered.length}</strong> of <strong>{dataStreams.length}</strong> data pipelines:
          </span>
          <div className="flex items-center gap-1.5">
            {(["ALL", "REALTIME", "HISTORICAL", "SIMULATED", "CALCULATED"] as FilterCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  filter === cat
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat === "ALL" ? "All Streams" : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Stream Cards Grid */}
        <div className="p-5 sm:p-6 max-h-[55vh] overflow-y-auto space-y-4">
          {filtered.map((stream) => (
            <div
              key={stream.id}
              className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 hover:border-slate-300 transition-colors shadow-xs space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    {stream.name}
                  </h3>
                  <span className="text-xs text-slate-400 font-mono hidden sm:inline">•</span>
                  <span className="text-xs text-slate-600 font-mono truncate max-w-sm">
                    {stream.coverage}
                  </span>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-mono font-bold border ${stream.categoryColor} shrink-0 self-start sm:self-auto`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${stream.categoryDot}`} />
                  {stream.categoryLabel}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-500 block">
                    Source &amp; Physical Instrument
                  </span>
                  <strong className="text-slate-800 text-xs block">
                    {stream.source}
                  </strong>
                  <span className="text-[11px] text-slate-600 block mt-1 font-mono">
                    <strong>Pipeline:</strong> {stream.pipeline}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-500 block">
                    How it Works &amp; Operational Value
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {stream.howItWorks}
                  </p>
                  <p className="text-[11px] text-sky-800 font-medium mt-1">
                    ℹ️ <em>{stream.whyItMatters}</em>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 font-mono">
          <span>
            POLARIS Governance Mandate: Zero simulation misrepresentation under Antarctic Treaty rules.
          </span>
          <button
            onClick={onClose}
            className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-sky-700 cursor-pointer shadow-xs"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
}
