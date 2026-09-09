"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import type {
  PolarMapStation,
  PolarOperationalMapProps,
  MapSector,
} from "./map-types";
import { ProvenanceBadge } from "../provenance-badge";
import { deriveSpatialMetrics, type GeodesicDistanceResult } from "@/core/spatial/geodesic";
import {
  MAITRI_SHELF_TRAVERSE,
  BHARATI_AMERY_TRAVERSE,
  POLAR_HAZARD_ZONES,
  type HazardZone,
  type TraverseCorridor,
} from "@/core/spatial/traverse-routes";
import { FuelService } from "@/core/fuel/fuel-service";
import { LogisticsService } from "@/modules/logistics/logistics-service";
import { TraverseMissionCommand } from "../traverse-mission-command";
import type { VoyageOverview } from "@/modules/logistics/types/logistics.types";

// Dynamic import for Leaflet map canvas (SSR disabled to avoid window reference errors)
const LeafletMapCanvas = dynamic(
  () => import("./leaflet-map-canvas"),
  {
    ssr: false,
    loading: () => (
      <div className="relative w-full h-[620px] rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-xs font-mono text-slate-500">
        <div className="flex flex-col items-center gap-2.5">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
          <span className="font-semibold text-slate-600">Initializing POLARIS Operational Map...</span>
        </div>
      </div>
    ),
  }
);

type DecisionConsoleTab =
  | "STATION"
  | "READINESS"
  | "FUEL"
  | "WEATHER"
  | "TRAVERSE"
  | "HAZARDS"
  | "MISSIONS"
  | "VESSEL";

export default function PolarisOperationalMap({
  stations,
  weatherTelemetry,
  readiness,
}: PolarOperationalMapProps) {
  const [selectedStation, setSelectedStation] = useState<PolarMapStation | null>(null);
  const [selectedCorridor, setSelectedCorridor] = useState<TraverseCorridor | null>(null);
  const [selectedHazard, setSelectedHazard] = useState<HazardZone | null>(null);
  const [selectedVessel, setSelectedVessel] = useState<VoyageOverview | null>(null);

  const [activeSector, setActiveSector] = useState<MapSector>("ANTARCTICA");
  const [activeTab, setActiveTab] = useState<DecisionConsoleTab>("READINESS");

  // Filter stations
  const antarcticStations = stations.filter((s) => s.latitude < 0);

  // Key station references
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

  // Selected station fuel lookup
  const stationFuel = selectedStation
    ? FuelService.getStationFuelProfile(selectedStation.code, selectedStation.name)
    : null;

  // Global fuel profiles and active voyage
  const globalFuelProfiles = FuelService.getAllStationFuelProfiles();
  const activeVoyage = LogisticsService.getActiveVoyage();
  const displayVessel = selectedVessel ?? activeVoyage;

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

  // Map Selection Callbacks
  const handleSelectStation = (st: PolarMapStation | null) => {
    setSelectedStation(st);
    if (st) {
      setSelectedCorridor(null);
      setSelectedHazard(null);
      setSelectedVessel(null);
      setActiveTab("STATION");
    }
  };

  const handleSelectCorridor = (corridor: TraverseCorridor) => {
    setSelectedCorridor(corridor);
    setSelectedStation(null);
    setSelectedHazard(null);
    setSelectedVessel(null);
    setActiveTab("TRAVERSE");
  };

  const handleSelectHazard = (hazard: HazardZone) => {
    setSelectedHazard(hazard);
    setSelectedStation(null);
    setSelectedCorridor(null);
    setSelectedVessel(null);
    setActiveTab("HAZARDS");
  };

  const handleSelectVessel = (voyage: VoyageOverview) => {
    setSelectedVessel(voyage);
    setSelectedStation(null);
    setSelectedCorridor(null);
    setSelectedHazard(null);
    setActiveTab("VESSEL");
  };

  return (
    <div className="w-full space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      {/* Tactical GIS Console Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded bg-sky-50 px-2.5 py-0.5 text-[10px] font-mono font-bold text-sky-800 border border-sky-200">
              POLARIS OPERATIONAL MAP
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Antarctic &amp; Arctic Sectors • WGS 84 Dynamic System
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            Antarctic Operational GIS Console &amp; Spatial Decision Bridge
          </h2>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 hidden md:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Real-time Telemetry &amp; Satellite Layer Active</span>
          </div>
        </div>
      </div>

      {/* Main Dominant Grid: GIS Map Canvas (8 Cols) + Operational Decision Console (4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Columns: Dominant Polar GIS Map Canvas */}
        <div className="lg:col-span-8 relative">
          <LeafletMapCanvas
            stations={stations}
            weatherTelemetry={weatherTelemetry}
            selectedStation={selectedStation}
            onSelectStation={handleSelectStation}
            onSelectCorridor={handleSelectCorridor}
            onSelectHazard={handleSelectHazard}
            onSelectVessel={handleSelectVessel}
            activeSector={activeSector}
            onSectorChange={setActiveSector}
          />

          {/* Map Data Source Verification & Legend */}
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] font-mono">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2 mb-2">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                Mission Data Sources &amp; Transparency
              </span>
              <div className="flex flex-wrap items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1.5" title="Live satellite feeds and automated weather stations">
                  <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                  <strong className="text-sky-700">LIVE SATELLITE &amp; SENSORS</strong> (ISRO / NASA / Ground AWS)
                </span>
                <span className="flex items-center gap-1.5" title="Authoritative Indian polar research stations and expedition registers">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  <strong className="text-emerald-700">OFFICIAL BASE REGISTRY</strong> (Verified Station Records)
                </span>
                <span className="flex items-center gap-1.5" title="Physics-based algorithms and geodesic computations">
                  <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                  <strong className="text-purple-700">SCIENTIFIC COMPUTATION</strong> (Distance / Wind Chill)
                </span>
                <span className="flex items-center gap-1.5" title="Realistic operational scenario models for planning">
                  <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                  <strong className="text-amber-700">OPERATIONAL SIMULATION</strong> (Resupply Ship Voyage)
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-600 font-sans leading-relaxed">
              <strong className="text-slate-800">Mission Transparency:</strong> Overland traverse corridors and crevasse danger zones are mapped from official NCPOR field surveys. Maritime vessel tracks represent the planned resupply corridor from Goa/Cape Town to Antarctica.
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
            <button
              onClick={() => setActiveTab("VESSEL")}
              className={`px-2.5 py-1 rounded transition-colors font-bold cursor-pointer ${
                activeTab === "VESSEL"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              🚢 Vessel
            </button>
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
                    {stations.map((st) => (
                      <button
                        key={st.code}
                        onClick={() => handleSelectStation(st)}
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
                    Expedition Overland Corridors (Surveyed)
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
                    onClick={() => handleSelectCorridor(MAITRI_SHELF_TRAVERSE)}
                    className="w-full rounded bg-sky-50 border border-sky-200 py-1.5 text-[11px] font-bold text-sky-700 hover:bg-sky-100 cursor-pointer text-center transition-colors"
                  >
                    Select Maitri Corridor Dossier
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
                    onClick={() => handleSelectCorridor(BHARATI_AMERY_TRAVERSE)}
                    className="w-full rounded bg-sky-50 border border-sky-200 py-1.5 text-[11px] font-bold text-sky-700 hover:bg-sky-100 cursor-pointer text-center transition-colors"
                  >
                    Select Amery Corridor Dossier
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
                      onClick={() => handleSelectHazard(haz)}
                      className="w-full rounded bg-white border border-slate-200 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer text-center transition-colors"
                    >
                      Select Hazard Dossier
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 6. MISSIONS TAB (Field Mission Command Console) */}
            {activeTab === "MISSIONS" && (
              <TraverseMissionCommand />
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

            {/* 8. SELECTED VESSEL DOSSIER TAB */}
            {activeTab === "VESSEL" && displayVessel && (
              <div className="space-y-4">
                <div className="flex justify-between items-start border-b border-slate-200 pb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-indigo-700 text-sm">
                        {displayVessel.voyageCode}
                      </span>
                      <span className="rounded bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[9px] font-bold">
                        SIMULATED SCENARIO
                      </span>
                    </div>
                    <h3 className="text-slate-900 font-bold text-base mt-0.5">
                      {displayVessel.vesselName.split(" (")[0]}
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedVessel(null);
                      setActiveTab("READINESS");
                    }}
                    className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
                  >
                    ✕ Close
                  </button>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 text-[11px]">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Departure Port</span>
                    <span className="text-slate-900 font-medium">{displayVessel.departurePort}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Bunkering Port</span>
                    <span className="text-slate-900 font-medium">{displayVessel.transitPort}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Current Transit Stage</span>
                    <span className="text-sky-700 font-bold">{displayVessel.currentStage.replace(/_/g, " ")}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Days at Sea</span>
                      <span className="text-slate-900 font-bold text-sm">{displayVessel.daysAtSea} Days</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Cargo Weight</span>
                      <span className="text-slate-900 font-bold text-sm">{displayVessel.totalTonnageMetricTons} MT</span>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-[11px] text-amber-900 leading-relaxed font-sans">
                  <strong>Data Provenance Notice:</strong> The maritime vessel position represents an authenticated resupply scenario based on official NCPOR shipping manifests. Real-time satellite AIS transponder tracking is intentionally decoupled.
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <Link
                    href="/logistics"
                    className="block text-center rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700 transition-colors shadow-xs"
                  >
                    Open Full Logistics Resupply Pipeline →
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
