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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <PolarisHeader currentPath="/assets" />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {/* Navigation Breadcrumb */}
        <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Link href="/" className="hover:text-sky-700 transition-colors">
              ← Command Dashboard
            </Link>
            <span>/</span>
            <span className="font-mono text-sky-700 font-bold">Asset Registry</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            NCPOR Cold-Region Equipment Register
          </span>
        </div>

        {/* Header Summary */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 mb-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-sky-50 px-2.5 py-0.5 text-xs font-mono font-bold text-sky-800 border border-sky-200">
                  EQUIPMENT REGISTRY
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Tracked Assets &amp; Scientific Instrumentation
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Polar Asset Registry &amp; Inventory
              </h1>
              <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
                Master catalog of sub-zero tracked vehicles, autonomous sensors, life-support hardware, and specialized field payloads deployed across Bharati, Maitri, and field expedition traverses.
              </p>
            </div>

            {/* Quick Summary Badges */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-center">
                <span className="block text-[10px] font-mono text-emerald-800 font-semibold uppercase">Available</span>
                <span className="text-xl font-mono font-black text-emerald-700 tabular-nums">{availableCount}</span>
              </div>
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-center">
                <span className="block text-[10px] font-mono text-sky-800 font-semibold uppercase">Deployed</span>
                <span className="text-xl font-mono font-black text-sky-700 tabular-nums">{deployedCount}</span>
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2.5 text-center">
                <span className="block text-[10px] font-mono text-indigo-800 font-semibold uppercase">Maintenance</span>
                <span className="text-xl font-mono font-black text-indigo-700 tabular-nums">{maintenanceCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Search Tag / Nomenclature
            </label>
            <input
              type="text"
              placeholder="e.g. VEH-PB-01, PistenBully, Radar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Lifecycle Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none transition-colors"
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
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Asset Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none transition-colors"
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
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
              Master Equipment Registry ({filteredAssets.length} of {assets.length})
            </span>
            <span className="text-[11px] font-mono text-emerald-700 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Central Equipment Manifest
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm font-mono text-slate-500">
              Loading polar equipment and asset inventory...
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              <p>No matching equipment or assets found.</p>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("ALL");
                  setCategoryFilter("ALL");
                }}
                className="mt-3 text-xs font-semibold text-sky-700 hover:underline cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase font-mono tracking-wider">
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
                <tbody className="divide-y divide-slate-100">
                  {filteredAssets.map((asset) => (
                    <tr
                      key={asset.id}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-sky-700">
                        {asset.asset_code}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-900 block">
                          {asset.name}
                        </span>
                        {asset.model && (
                          <span className="text-xs text-slate-500 font-normal">
                            {asset.manufacturer ? `${asset.manufacturer} • ` : ""}{asset.model}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-slate-600">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] border border-slate-200 text-slate-700">
                          {asset.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {asset.station_id ? (
                          <span className="flex items-center gap-1.5 font-medium text-slate-800">
                            <span>📍</span> {stationMap.get(asset.station_id) || "Station Base"}
                          </span>
                        ) : (
                          <span className="text-amber-700 font-medium">
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
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-200 px-3 py-1 text-xs font-bold text-sky-700 hover:bg-sky-50 hover:border-sky-300 transition-colors cursor-pointer"
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

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 mt-12">
        POLARIS • National Centre for Polar &amp; Ocean Research (NCPOR) Management Foundation • SIH 2026
      </footer>
    </div>
  );
}

