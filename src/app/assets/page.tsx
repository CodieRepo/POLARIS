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
      asset.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || asset.status === statusFilter;
    const matchesCategory =
      categoryFilter === "ALL" || asset.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const categories = Array.from(new Set(assets.map((a) => a.category)));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PolarisHeader currentPath="/assets" />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Polar Asset Registry &amp; Inventory
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Master catalog of cold-region tracked equipment, tracked vehicles, and scientific payloads.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300">
              {filteredAssets.length} of {assets.length} Units Listed
            </span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Search Code / Nomenclature
            </label>
            <input
              type="text"
              placeholder="e.g. VEH-PB-01 or PistenBully"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Lifecycle Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="IN_USE">IN_USE</option>
              <option value="MAINTENANCE">MAINTENANCE</option>
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
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
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

        {/* Table */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-400">
              Loading polar asset registry...
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">
              No matching assets found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-xs text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold">Asset Tag</th>
                    <th className="py-3 px-4 font-semibold">Nomenclature</th>
                    <th className="py-3 px-4 font-semibold">Category</th>
                    <th className="py-3 px-4 font-semibold">Station Base</th>
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
                      <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                        {asset.asset_code}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-200">
                        {asset.name}
                        {asset.model && (
                          <span className="block text-xs text-slate-500 font-normal">
                            {asset.manufacturer} {asset.model}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-300">
                        {asset.category}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-300">
                        {asset.station_id ? stationMap.get(asset.station_id) : "In Transit / Field"}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={asset.status} />
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={asset.condition} type="condition" />
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={asset.criticality} type="criticality" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/assets/${asset.asset_code}`}
                          className="inline-flex items-center gap-1 rounded bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 text-xs font-bold text-cyan-400 hover:bg-cyan-500 hover:text-slate-950 transition-colors"
                        >
                          Manage →
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
