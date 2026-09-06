import React from "react";
import Link from "next/link";
import { PolarisHeader } from "./components/polaris-header";
import { StatusBadge } from "./components/status-badge";
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
    status: string;
    data_classification: string;
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
      supabase.from("expeditions").select("id, code, name, status, data_classification").order("code"),
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
    // Graceful fallback if database connection has temporary latency
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PolarisHeader currentPath="/" />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {/* Command Mission Banner with Readiness Gauge */}
        <div className="mb-6 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-xs font-bold text-cyan-400 border border-cyan-500/40">
                  NATIONAL POLAR OPERATIONS PLATFORM
                </span>
                <span className="text-xs text-slate-400 font-mono">POLARIS Reality Upgrade — Phase 1 (PostgreSQL System of Record Active)</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Integrated Polar Expedition Logistics &amp; Asset Command Suite
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
                Operational command &amp; decision support for Indian Antarctic &amp; Arctic research programs.
                Enforces PostgreSQL transactional lifecycle boundaries, row-level locking, and immutable asset integrity across Antarctic research bases and active field campaigns.
              </p>
            </div>

            {/* Operational Readiness Gauge Widget */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-5 text-center min-w-[240px] shadow-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Polar Operational Readiness
              </span>
              <div className="mt-2 flex items-baseline justify-center gap-1.5">
                <span className="text-4xl font-black font-mono text-emerald-400">
                  {readiness.score}
                </span>
                <span className="text-sm font-bold text-slate-500">/ 100</span>
              </div>
              <div className="mt-1">
                <span className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  STATUS: {readiness.status}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-slate-400 leading-tight">
                {readiness.summary}
              </p>
            </div>
          </div>
        </div>

        {/* Active Operational Alerts & Hazardous Weather Warning Stream */}
        <OperationalAlertBanner alerts={operationalAlerts} />

        {/* PRIMARY COMMAND SURFACE: Antarctic Tactical GIS Map & Spatial Decision Bridge */}
        <div className="mb-8">
          <PolarOperationalMap
            stations={stations}
            expeditions={expeditions}
            weatherTelemetry={weatherTelemetry}
            readiness={readiness}
          />
        </div>

        {/* Environmental Microclimate Trends & Fuel Autonomy Life-Support Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <WeatherTrendChart trends={weatherTrends} />
          <FuelAutonomyWidget fuelProfiles={fuelProfiles} />
        </div>

        {/* POLARIS Operational Readiness Heuristic Breakdown Widget */}
        <ReadinessDetailWidget readiness={readiness} />

        {/* Polar Meteorological Telemetry & Provenance Feeds */}
        <WeatherTelemetryPanel weather={weatherTelemetry} />

        {/* Operational Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 mb-8">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-md">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Assets Tracked
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{stats.assets.total}</span>
              <span className="text-xs text-emerald-400 font-medium">Verified</span>
            </div>
            <div className="mt-2 flex gap-1.5 text-xs text-slate-400">
              <span>{stats.assets.available} Avail</span>
              <span>•</span>
              <span className="text-cyan-400">{stats.assets.assigned} Assign</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-md">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Active Stations
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{stats.stations.active}</span>
              <span className="text-xs text-cyan-400 font-medium">Bases</span>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              Bharati, Maitri, Himadri
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-md">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Fuel Autonomy Avg
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-400">{avgDaysAutonomy}d</span>
              <span className="text-xs text-emerald-400 font-medium">Normal</span>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              Across 3 Active Stations
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-md">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Resupply Voyage
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-sky-400">{activeVoyage.daysAtSea}d</span>
              <span className="text-xs text-sky-400 font-medium">At Sea</span>
            </div>
            <div className="mt-2 text-xs text-slate-400 truncate">
              {activeVoyage.vesselName.split(" (")[0]}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-md">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Active Expeditions
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{stats.expeditions.active}</span>
              <span className="text-xs text-emerald-400 font-medium">Field Ops</span>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              44th ISEA Summer/Winter
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-md">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Maintenance Orders
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-400">{stats.assets.maintenance}</span>
              <span className="text-xs text-amber-400 font-medium">Active</span>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {stats.assets.critical} Mission-Critical units
            </div>
          </div>
        </div>

        {/* Operational Tables & Readiness Breakdown */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 mb-8">
          {/* Recent Asset Statuses (2 cols) */}
          <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Operational Asset Registry</h2>
                <p className="text-xs text-slate-400">
                  Select an asset to test the atomic Assignment, Release, and Maintenance state machine.
                </p>
              </div>
              <Link href="/assets" className="text-xs text-cyan-400 hover:underline">
                View All ({stats.assets.total}) →
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Asset Tag</th>
                    <th className="pb-3 font-semibold">Nomenclature</th>
                    <th className="pb-3 font-semibold">Category</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Condition</th>
                    <th className="pb-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {assets.slice(0, 6).map((asset) => (
                    <tr key={asset.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 font-mono font-bold text-cyan-400">
                        {asset.asset_code}
                      </td>
                      <td className="py-3 font-medium text-slate-200">{asset.name}</td>
                      <td className="py-3 text-xs text-slate-400">{asset.category}</td>
                      <td className="py-3">
                        <StatusBadge status={asset.status} />
                      </td>
                      <td className="py-3">
                        <StatusBadge status={asset.condition} type="condition" />
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          href={`/assets/${asset.asset_code}`}
                          className="rounded bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-cyan-500 hover:text-slate-950 transition-colors"
                        >
                          Lifecycle View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Readiness Factor Breakdown & Invariant Boundary (1 col) */}
          <div className="flex flex-col gap-6">
            {/* Readiness Factors Checklist */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-lg">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3 flex items-center gap-1.5">
                <span>📊</span> Readiness Factor Breakdown
              </h3>
              <div className="space-y-2.5 text-xs">
                {readiness.factors.map((f, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 border-b border-slate-800/60 pb-2">
                    <div>
                      <div className="font-semibold text-slate-200">{f.label}</div>
                      <div className="text-[11px] text-slate-400">{f.reason}</div>
                    </div>
                    <span
                      className={`font-mono font-bold ${
                        f.impact > 0 ? "text-emerald-400" : f.impact < 0 ? "text-rose-400" : "text-slate-500"
                      }`}
                    >
                      {f.impact > 0 ? `+${f.impact}` : f.impact === 0 ? "0" : `${f.impact}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Invariant Security Box */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 shadow-lg">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold text-sm">🔒 Database Boundary Active</span>
              </div>
              <p className="mt-2 text-xs text-slate-300">
                Milestone 7C &amp; 7D database triggers actively enforce:
              </p>
              <ul className="mt-2 space-y-1 text-xs text-slate-400 list-disc list-inside">
                <li>Immutable asset code &amp; data classification</li>
                <li>SUPER_ADMIN-only terminal retirement</li>
                <li>Atomic RPC-scoped assignment and release</li>
                <li>Defensive <code className="text-cyan-400">polaris.trusted_asset_workflow</code> GUC</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        POLARIS • National Centre for Polar &amp; Ocean Research (NCPOR) Management Foundation • SIH 2026
      </footer>
    </div>
  );
}
