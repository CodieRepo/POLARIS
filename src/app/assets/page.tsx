"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { PolarisHeader } from "../components/polaris-header";
import { StatusBadge } from "../components/status-badge";
import type { AssetRow } from "@/modules/asset/types/asset.types";
import type { StationRow } from "@/core/station/station-repository";

export default function AssetInventoryPage() {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [stations, setStations] = useState<StationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  useEffect(() => {
    async function fetchData() {
      try {
        const [assetsRes, stationsRes] = await Promise.all([
          fetch("/api/assets"),
          fetch("/api/stations"),
        ]);

        const assetsJson = await assetsRes.json();
        const stationsJson = await stationsRes.json();

        if (assetsJson.data) setAssets(assetsJson.data);
        if (stationsJson.data) setStations(stationsJson.data);
      } catch (err) {
        console.error("Failed to load inventory:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const stationMap = new Map(stations.map((s) => [s.id, s.name]));

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.asset_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (asset.manufacturer && asset.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || asset.status === statusFilter;
    const matchesCategory =
      categoryFilter === "ALL" || asset.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const categories = Array.from(new Set(assets.map((a) => a.category)));

  // Metric aggregates for quick status strip
  const availableCount = assets.filter((a) => a.status === "AVAILABLE").length;
  const deployedCount = assets.filter((a) => a.status === "ASSIGNED" || a.status === "IN_USE").length;
  const maintenanceCount = assets.filter((a) => a.status === "MAINTENANCE").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PolarisHeader currentPath="/assets" />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {/* Navigation Breadcrumb */}
        <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Link href="/" className="hover:text-cyan-400">
              ← Command Dashboard
            </Link>
            <span>/</span>
            <span className="font-mono text-cyan-400">Asset Registry</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            NCPOR Cold-Region Equipment Register
          </span>
        </div>

        {/* Header Summary */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 mb-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-xs font-mono font-bold text-cyan-400 border border-cyan-500/30">
                  EQUIPMENT REGISTRY
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Tracked Assets &amp; Scientific Instrumentation
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">
                Polar Asset Registry &amp; Inventory
              </h1>
              <p className="mt-2 text-sm text-slate-300 max-w-3xl leading-relaxed">
                Master catalog of sub-zero tracked vehicles, autonomous sensors, life-support hardware, and specialized field payloads deployed across Bharati, Maitri, and field expedition traverses.
              </p>
            </div>

            {/* Quick Summary Badges */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-3.5 py-2.5 text-center">
                <span className="block text-[10px] font-mono text-emerald-400 font-semibold uppercase">Available</span>
                <span className="text-xl font-mono font-black text-emerald-300">{availableCount}</span>
              </div>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 px-3.5 py-2.5 text-center">
                <span className="block text-[10px] font-mono text-cyan-400 font-semibold uppercase">Deployed</span>
                <span className="text-xl font-mono font-black text-cyan-300">{deployedCount}</span>
              </div>
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 px-3.5 py-2.5 text-center">
                <span className="block text-[10px] font-mono text-indigo-400 font-semibold uppercase">Maintenance</span>
                <span className="text-xl font-mono font-black text-indigo-300">{maintenanceCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Search Tag / Nomenclature
            </label>
            <input
              type="text"
              placeholder="e.g. VEH-PB-01, PistenBully, Radar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Lifecycle Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none transition-colors"
            >
              <option value="ALL">All Statuses ({assets.length})</option>
              <option value="AVAILABLE">AVAILABLE ({availableCount})</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="IN_USE">IN_USE</option>
              <option value="MAINTENANCE">MAINTENANCE ({maintenanceCount})</option>
              <option value="RETIRED">RETIRED</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Asset Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none transition-colors"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table View */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3 bg-slate-900/80">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              Master Equipment Registry ({filteredAssets.length} of {assets.length})
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              PostgreSQL `public.assets`
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm font-mono text-slate-400">
              Loading polar asset registry from PostgreSQL...
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">
              <p>No matching equipment or assets found.</p>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("ALL");
                  setCategoryFilter("ALL");
                }}
                className="mt-3 text-xs font-semibold text-cyan-400 hover:underline cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-xs text-slate-400 uppercase font-mono tracking-wider">
                    <th className="py-3 px-4 font-semibold">Asset Tag</th>
                    <th className="py-3 px-4 font-semibold">Nomenclature &amp; Spec</th>
                    <th className="py-3 px-4 font-semibold">Category</th>
                    <th className="py-3 px-4 font-semibold">Current Base</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Condition</th>
                    <th className="py-3 px-4 font-semibold">Criticality</th>
                    <th className="py-3 px-4 font-semibold text-right">Workflow</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredAssets.map((asset) => (
                    <tr
                      key={asset.id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-cyan-400">
                        {asset.asset_code}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-white block">
                          {asset.name}
                        </span>
                        {asset.model && (
                          <span className="text-xs text-slate-400 font-normal">
                            {asset.manufacturer ? `${asset.manufacturer} • ` : ""}{asset.model}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-slate-300">
                        <span className="rounded bg-slate-800/80 px-2 py-0.5 text-[11px] border border-slate-700/60">
                          {asset.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-300">
                        {asset.station_id ? (
                          <span className="flex items-center gap-1.5 font-medium text-slate-200">
                            <span>📍</span> {stationMap.get(asset.station_id) || "Station Base"}
                          </span>
                        ) : (
                          <span className="text-amber-400 font-medium">
                            🧭 Field Traverse / Transit
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={asset.status} />
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={asset.condition} type="condition" />
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={asset.criticality} type="criticality" />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/assets/${asset.asset_code}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 text-xs font-bold text-cyan-400 hover:bg-cyan-500 hover:text-slate-950 transition-colors cursor-pointer"
                        >
                          Dossier →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

