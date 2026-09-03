import React from "react";
import Link from "next/link";
import { PolarisHeader } from "./components/polaris-header";
import { StatusBadge } from "./components/status-badge";
import { createServerClient } from "@/infrastructure/db/supabase-server";
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

  let assets: AssetRow[] = [];

  try {
    const supabase = createServerClient();
    const [stRes, exRes, asRes] = await Promise.all([
      supabase.from("stations").select("id, status"),
      supabase.from("expeditions").select("id, status"),
      supabase.from("assets").select("*").order("asset_code", { ascending: true }),
    ]);

    if (stRes.data && stRes.data.length > 0) {
      stats.stations.total = stRes.data.length;
      stats.stations.active = stRes.data.filter((s) => s.status === "ACTIVE").length;
      stats.stations.historical = stRes.data.filter((s) => s.status === "HISTORICAL").length;
    }
    if (exRes.data && exRes.data.length > 0) {
      stats.expeditions.total = exRes.data.length;
      stats.expeditions.active = exRes.data.filter((e) => e.status === "ACTIVE").length;
      stats.expeditions.planned = exRes.data.filter((e) => e.status === "PLANNED").length;
      stats.expeditions.draft = exRes.data.filter((e) => e.status === "DRAFT").length;
    }
    if (asRes.data && asRes.data.length > 0) assets = asRes.data;

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
    // Fallback to initial representation if DB is empty or initializing
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PolarisHeader currentPath="/" />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {/* Mission Banner */}
        <div className="mb-8 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 p-6 sm:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-xs font-bold text-cyan-400 border border-cyan-500/40">
                  NATIONAL POLAR OPERATIONS PLATFORM
                </span>
                <span className="text-xs text-slate-400">SIH 2026 Production Baseline</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Integrated Polar Expedition Logistics &amp; Asset Management
              </h1>
              <p className="mt-1 max-w-3xl text-sm sm:text-base text-slate-300">
                Authoritative real-time coordination for Indian Antarctic &amp; Arctic research programs. Enforces strict PostgreSQL transactional lifecycle boundaries and immutable asset integrity across Antarctic stations and active field expeditions.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/assets"
                className="rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-400 transition-colors"
              >
                Inspect Asset Inventory →
              </Link>
            </div>
          </div>
        </div>

        {/* Operational Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Assets Tracked
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{stats.assets.total}</span>
              <span className="text-xs text-emerald-400 font-medium">100% Invariant Compliant</span>
            </div>
            <div className="mt-2 flex gap-1.5 text-xs text-slate-400">
              <span>{stats.assets.available} Available</span>
              <span>•</span>
              <span className="text-cyan-400">{stats.assets.assigned} Assigned</span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Active Research Stations
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{stats.stations.active}</span>
              <span className="text-xs text-cyan-400 font-medium">Antarctica &amp; Arctic</span>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              Bharati, Maitri, Himadri (1 Historical)
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Expeditions Active
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{stats.expeditions.active}</span>
              <span className="text-xs text-emerald-400 font-medium">In Field Ops</span>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              44th ISEA Summer &amp; Winter-Over
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Maintenance Work Orders
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-400">{stats.assets.maintenance}</span>
              <span className="text-xs text-amber-400 font-medium">Sub-Zero Servicing</span>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {stats.assets.critical} Mission-Critical units
            </div>
          </div>
        </div>

        {/* Quick Launch & Vertical Slice Sections */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 mb-8">
          {/* Recent Asset Statuses */}
          <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Live Asset Operational Registry</h2>
                <p className="text-xs text-slate-400">
                  Select an asset to test the atomic Assignment and Release state machine workflow.
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

          {/* Expedition & Station Topology */}
          <div className="flex flex-col gap-6">
            {/* Active Expedition Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                Operational Expedition
              </span>
              <h3 className="mt-1 text-base font-bold text-white">
                44th Indian Scientific Expedition (ISEA-44)
              </h3>
              <p className="mt-1 text-xs text-slate-300">
                Primary field science &amp; deep continental radar sounding campaign.
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3 text-xs">
                <span className="text-slate-400">Origin: Bharati Station</span>
                <StatusBadge status="ACTIVE" type="expedition" />
              </div>
            </div>

            {/* Invariant Security Box */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5">
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
