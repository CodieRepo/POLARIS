import React from "react";
import Link from "next/link";
import { PolarisHeader } from "./components/polaris-header";
import { StatusBadge } from "./components/status-badge";
import { ProvenanceBadge } from "./components/provenance-badge";
import PolarOperationalMap from "./components/polar-operational-map";
import { WeatherTelemetryPanel } from "./components/weather-telemetry-panel";
import { ReadinessDetailWidget } from "./components/readiness-detail-widget";
import { OperationalAlertBanner } from "./components/operational-alert-banner";
import { FuelAutonomyWidget } from "./components/fuel-autonomy-widget";
import { WeatherTrendChart } from "./components/weather-trend-chart";
import { createServerClient } from "@/infrastructure/db/supabase-server";
import { calculateOperationalReadiness } from "@/core/readiness/operational-readiness";
import { WeatherService } from "@/core/weather/weather-service";
import { FuelService } from "@/core/fuel/fuel-service";
import { FuelRepository } from "@/core/fuel/fuel-repository";
import { AlertEngine } from "@/core/alerts/alert-engine";
import { AlertRepository } from "@/core/alerts/alert-repository";
import { WeatherHistoryService } from "@/core/weather/weather-history-service";
import { TimeSeriesTelemetryService } from "@/core/telemetry/time-series-service";
import { LogisticsService } from "@/modules/logistics/logistics-service";
import type { StationWeather } from "@/core/weather/types";
import type { AssetRow } from "@/modules/asset/types/asset.types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stats = {
    stations: { total: 4, active: 3, historical: 1 },
    expeditions: { total: 3, active: 1, planned: 1, draft: 1 },
    assets: { total: 9, available: 6, assigned: 0, in_use: 1, maintenance: 1, retired: 1, critical: 3 },
    activeAssignmentsCount: 0,
    maintenanceActiveCount: 1,
  };

  let stations: {
    id: string;
    code: string;
    name: string;
    latitude: number;
    longitude: number;
    status: string;
    capacity: number | null;
    region: string | null;
  }[] = [];
  let expeditions: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    status: string;
    data_classification: string;
    planned_start_at: string;
    planned_end_at: string;
  }[] = [];
  let assets: AssetRow[] = [];
  let maintenance: {
    id: string;
    status: string;
    maintenance_type: string;
  }[] = [];

  let weatherTelemetry: Record<string, StationWeather> | null = null;

  try {
    const supabase = createServerClient();
    const [stRes, exRes, asRes, mnRes, weatherRes] = await Promise.all([
      supabase.from("stations").select("id, code, name, latitude, longitude, status, capacity, region").order("code"),
      supabase.from("expeditions").select("id, code, name, description, status, data_classification, planned_start_at, planned_end_at").order("code"),
      supabase.from("assets").select("*").order("asset_code", { ascending: true }),
      supabase.from("maintenance_records").select("id, status, maintenance_type"),
      WeatherService.getAllStationWeather().catch(() => null),
    ]);

    if (stRes.data) stations = stRes.data;
    if (exRes.data) expeditions = exRes.data;
    if (asRes.data) assets = asRes.data;
    if (mnRes.data) maintenance = mnRes.data;
    if (weatherRes) weatherTelemetry = weatherRes;

    if (stations.length > 0) {
      stats.stations.total = stations.length;
      stats.stations.active = stations.filter((s) => s.status === "ACTIVE").length;
      stats.stations.historical = stations.filter((s) => s.status === "HISTORICAL").length;
    }
    if (expeditions.length > 0) {
      stats.expeditions.total = expeditions.length;
      stats.expeditions.active = expeditions.filter((e) => e.status === "ACTIVE").length;
      stats.expeditions.planned = expeditions.filter((e) => e.status === "PLANNED").length;
      stats.expeditions.draft = expeditions.filter((e) => e.status === "DRAFT").length;
    }
    if (assets.length > 0) {
      stats.assets.total = assets.length;
      stats.assets.available = assets.filter((a) => a.status === "AVAILABLE").length;
      stats.assets.assigned = assets.filter((a) => a.status === "ASSIGNED").length;
      stats.assets.in_use = assets.filter((a) => a.status === "IN_USE").length;
      stats.assets.maintenance = assets.filter((a) => a.status === "MAINTENANCE").length;
      stats.assets.retired = assets.filter((a) => a.status === "RETIRED").length;
      stats.assets.critical = assets.filter((a) => a.criticality === "CRITICAL").length;
    }
  } catch {
    // Graceful fallback
  }

  const readiness = calculateOperationalReadiness(assets, maintenance, stations, weatherTelemetry);

  const [fuelProfiles, persistentAlerts, bhrTrend, mtrTrend, hmdTrend] = await Promise.all([
    FuelRepository.getAllStationFuelProfiles().catch(() => FuelService.getAllStationFuelProfiles()),
    AlertRepository.getActiveAlerts().catch(() => []),
    WeatherHistoryService.getHistoricalTrend("BHR", 24).catch(() => null),
    WeatherHistoryService.getHistoricalTrend("MTR", 24).catch(() => null),
    WeatherHistoryService.getHistoricalTrend("HMD", 24).catch(() => null),
  ]);

  const fallbackAlerts = AlertEngine.evaluateTelemetryAlerts(weatherTelemetry);
  const operationalAlerts = persistentAlerts.length > 0 ? persistentAlerts : fallbackAlerts;
  const activeVoyage = LogisticsService.getActiveVoyage();

  const bhrWeather = weatherTelemetry?.["BHR"];
  const mtrWeather = weatherTelemetry?.["MTR"];
  const hmdWeather = weatherTelemetry?.["HMD"];

  const weatherTrends = {
    BHR: bhrTrend || TimeSeriesTelemetryService.getStationTelemetryTrend(
      "BHR",
      bhrWeather?.measurements.temperatureC.value ?? -8.5,
      bhrWeather?.measurements.pressureHpa.value ?? 988.2,
      bhrWeather?.measurements.windSpeedKmH.value ?? 24
    ),
    MTR: mtrTrend || TimeSeriesTelemetryService.getStationTelemetryTrend(
      "MTR",
      mtrWeather?.measurements.temperatureC.value ?? -12.4,
      mtrWeather?.measurements.pressureHpa.value ?? 982.0,
      mtrWeather?.measurements.windSpeedKmH.value ?? 38
    ),
    HMD: hmdTrend || TimeSeriesTelemetryService.getStationTelemetryTrend(
      "HMD",
      hmdWeather?.measurements.temperatureC.value ?? -2.1,
      hmdWeather?.measurements.pressureHpa.value ?? 1004.5,
      hmdWeather?.measurements.windSpeedKmH.value ?? 14
    ),
  };

  const bhrAutonomy = fuelProfiles.BHR?.daysOfAutonomy ?? 255;
  const mtrAutonomy = fuelProfiles.MTR?.daysOfAutonomy ?? 231;
  const hmdAutonomy = fuelProfiles.HMD?.daysOfAutonomy ?? 284;
  const avgDaysAutonomy = Math.round((bhrAutonomy + mtrAutonomy + hmdAutonomy) / 3);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <PolarisHeader currentPath="/" />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* MISSION CONTROL HEADER */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-sky-50 px-2.5 py-0.5 text-xs font-mono font-bold text-sky-800 border border-sky-200">
                  NATIONAL POLAR MISSION CONTROL
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Sept 7, 2026 • 08:00 UTC
                </span>
                <span className="text-slate-300 hidden sm:inline">•</span>
                <span className="text-xs text-emerald-700 font-mono flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Central Mission Registry Active
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                Polar Logistics, Operations, Resource &amp; Asset Intelligence
              </h1>

              <p className="max-w-3xl text-xs sm:text-sm text-slate-600 leading-relaxed">
                Central command suite for Indian Antarctic (Bharati, Maitri) and Arctic (Himadri) scientific missions.
                Continuously tracks asset lifecycle states, life-support fuel reserves, synoptic meteorological trends, and resupply logistics.
              </p>
            </div>

            {/* OPERATIONAL READINESS GAUGE */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-center min-w-[220px] shadow-xs shrink-0">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Operational Health
                </span>
                <ProvenanceBadge tier="DERIVED" size="xs" />
              </div>

              <div className="flex items-baseline justify-center gap-1.5">
                <span className={`text-4xl font-black font-mono tracking-tight tabular-nums ${
                  readiness.score >= 85 ? "text-emerald-700" : readiness.score >= 60 ? "text-amber-700" : "text-rose-700"
                }`}>
                  {readiness.score}
                </span>
                <span className="text-sm font-bold text-slate-400">/ 100</span>
              </div>

              <div className="mt-1.5">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wider ${
                  readiness.status === "OPTIMAL" || readiness.status === "OPERATIONAL"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-amber-50 text-amber-800 border border-amber-200"
                }`}>
                  {readiness.status} POSTURE
                </span>
              </div>

              <p className="mt-2 text-[10px] text-slate-500 leading-tight">
                {readiness.summary}
              </p>
            </div>
          </div>
        </div>

        {/* ATTENTION REQUIRED (Active Operational Alerts) */}
        <OperationalAlertBanner alerts={operationalAlerts} />

        {/* LEVEL 1: GLOBAL SITUATION GRID (6 meaningful cards) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
              Global Situation Overview
            </h2>
            <span className="text-[11px] font-mono text-slate-400">Level 1 • High-Level Metrics</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {/* 1. Active Expeditions */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 transition-colors">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Expeditions
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tabular-nums">
                  {stats.expeditions.active}
                </span>
                <span className="text-xs text-emerald-700 font-semibold font-mono">Active</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                {stats.expeditions.total} campaigns logged
              </div>
            </div>

            {/* 2. Permanent Bases */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 transition-colors">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Research Stations
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tabular-nums">
                  {stats.stations.active}
                </span>
                <span className="text-xs text-sky-700 font-semibold font-mono">Bases</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 truncate">
                BHR • MTR • HMD
              </div>
            </div>

            {/* 3. Operational Alerts */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 transition-colors">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Active Alerts
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black font-mono text-amber-700 tabular-nums">
                  {operationalAlerts.filter((a) => a.status === "ACTIVE").length}
                </span>
                <span className="text-xs text-amber-700 font-semibold font-mono">Watch</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                Weather &amp; Maint queues
              </div>
            </div>

            {/* 4. Fuel Autonomy */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 transition-colors">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Fuel Autonomy
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-700 tabular-nums">
                  {avgDaysAutonomy}d
                </span>
                <span className="text-xs text-emerald-700 font-semibold font-mono">Normal</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                Life-support buffer
              </div>
            </div>

            {/* 5. Maritime Resupply */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 transition-colors">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Resupply Vessel
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black font-mono text-sky-700 tabular-nums">
                  {activeVoyage.daysAtSea}d
                </span>
                <span className="text-xs text-sky-700 font-semibold font-mono">At Sea</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 truncate">
                {activeVoyage.vesselName.split(" (")[0]}
              </div>
            </div>

            {/* 6. Tracked Assets */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 transition-colors">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Tracked Assets
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tabular-nums">
                  {stats.assets.total}
                </span>
                <span className="text-xs text-emerald-700 font-semibold font-mono">Units</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                {stats.assets.available} Available • {stats.assets.maintenance} Maint
              </div>
            </div>
          </div>
        </div>

        {/* LEVEL 2: ACTIVE MISSIONS OVERVIEW CARDS */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
              Active Expedition Field Campaigns
            </h2>
            <Link href="/expeditions" className="text-xs font-semibold text-sky-700 hover:text-sky-900 transition-colors">
              View All Missions ({expeditions.length}) →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {expeditions.slice(0, 3).map((exp) => (
              <div
                key={exp.id}
                className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between hover:border-slate-300 hover:shadow-xs transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="font-mono text-sky-700 font-bold text-xs">
                        {exp.code}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 leading-tight">
                        {exp.name}
                      </h3>
                    </div>
                    <StatusBadge status={exp.status} type="expedition" />
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 mb-4 leading-relaxed">
                    {exp.description || "Operational scientific campaign in polar sector."}
                  </p>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">Classification</span>
                      <span className="font-mono font-medium text-slate-800">{exp.data_classification}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">Window</span>
                      <span className="font-mono text-slate-800">
                        {new Date(exp.planned_start_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} - {new Date(exp.planned_end_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 text-[11px] font-mono">Phase: STATION OPS</span>
                  <Link
                    href={`/expeditions/${exp.code}`}
                    className="font-semibold text-sky-700 hover:text-sky-900 text-xs transition-colors"
                  >
                    Roster &amp; Gear →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PRIMARY COMMAND SURFACE: ANTARCTIC TACTICAL GIS MAP & SPATIAL BRIDGE */}
        <div>
          <PolarOperationalMap
            stations={stations}
            expeditions={expeditions}
            weatherTelemetry={weatherTelemetry}
            readiness={readiness}
          />
        </div>

        {/* LEVEL 3: SYNOPTIC ATMOSPHERIC TRENDS & FUEL AUTONOMY */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WeatherTrendChart trends={weatherTrends} />
          <FuelAutonomyWidget fuelProfiles={fuelProfiles} />
        </div>

        {/* LEVEL 3: EXPLAINABLE OPERATIONAL READINESS HEURISTIC AUDIT */}
        <ReadinessDetailWidget readiness={readiness} />

        {/* LEVEL 3: POLAR METEOROLOGICAL TELEMETRY & PROVENANCE FEEDS */}
        <WeatherTelemetryPanel weather={weatherTelemetry} />

        {/* LEVEL 4: OPERATIONAL ASSET REGISTRY TABLE (Progressive Disclosure) */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Operational Asset Registry</h2>
                <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-mono text-slate-700">
                  {assets.length} Units Tracked
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Master equipment inventory managing assignment, field deployment, maintenance schedules, and lifecycle status.
              </p>
            </div>
            <Link
              href="/assets"
              className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50 hover:border-sky-300 transition-colors self-start sm:self-auto"
            >
              Open Full Asset Catalog →
            </Link>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase font-semibold text-[11px]">
                  <th className="py-2.5 px-4 font-mono">Asset Tag</th>
                  <th className="py-2.5 px-4">Nomenclature</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Condition</th>
                  <th className="py-2.5 px-4 text-right">Lifecycle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets.slice(0, 6).map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-bold text-sky-700">
                      {asset.asset_code}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {asset.name}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {asset.category}
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusBadge status={asset.status} />
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusBadge status={asset.condition} type="condition" />
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <Link
                        href={`/assets/${asset.asset_code}`}
                        className="rounded bg-slate-100 border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-sky-50 hover:text-sky-800 hover:border-sky-300 transition-colors"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        POLARIS • National Centre for Polar &amp; Ocean Research (NCPOR) Management Foundation • SIH 2026
      </footer>
    </div>
  );
}

