"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PolarisHeader } from "../components/polaris-header";
import { LogisticsService } from "@/modules/logistics/logistics-service";
import type { LogisticsTransitStage } from "@/modules/logistics/types/logistics.types";

export default function LogisticsPage() {
  const voyage = LogisticsService.getActiveVoyage();
  const containers = LogisticsService.getAllContainers();
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [stationFilter, setStationFilter] = useState<string>("ALL");

  const filtered = containers.filter((c) => {
    if (stageFilter !== "ALL" && c.transitStage !== stageFilter) return false;
    if (stationFilter !== "ALL" && c.destinationStationCode !== stationFilter) return false;
    return true;
  });

  const getStageBadge = (stage: LogisticsTransitStage) => {
    switch (stage) {
      case "STATION_DELIVERED":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "SOUTHERN_OCEAN_TRANSIT":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
      case "CAPE_TOWN_BUNKERING":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "ICE_SHELF_BARRIER":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "MISSION_CRITICAL":
        return "bg-rose-500/20 text-rose-400 border-rose-500/40";
      case "COLD_CHAIN":
        return "bg-cyan-500/20 text-cyan-400 border-cyan-500/40";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PolarisHeader currentPath="/logistics" />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {/* Navigation Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-xs text-slate-400">
          <Link href="/" className="hover:text-cyan-400">
            ← Command Dashboard
          </Link>
          <span>/</span>
          <span className="font-mono text-cyan-400">Maritime &amp; Supply Chain Logistics</span>
        </div>

        {/* Header Summary Banner */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 mb-8 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-xs font-mono font-bold text-cyan-400 border border-cyan-500/30">
                  MARITIME EXPEDITION LOGISTICS
                </span>
                <span className="text-xs text-slate-400">Voyage: {voyage.voyageCode}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">
                Polar Freight Manifests &amp; Resupply Chain
              </h1>
              <p className="mt-2 text-sm text-slate-300 max-w-3xl leading-relaxed">
                Tracks ISO 20-foot shipping containers, breakbulk pallets, and hazardous material drums
                from Mormugao Port (Goa) via Cape Town bunkering to Antarctica ice shelf barrier offloading.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 min-w-[240px] text-xs font-mono">
              <span className="text-slate-500 block uppercase font-bold text-[10px]">Active Chartered Vessel</span>
              <strong className="text-white text-sm block mt-0.5">{voyage.vesselName}</strong>
              <div className="mt-2 flex justify-between text-slate-400 border-t border-slate-800/80 pt-2">
                <span>Total Tonnage:</span>
                <strong className="text-cyan-400">{voyage.totalTonnageMetricTons} MT</strong>
              </div>
              <div className="flex justify-between text-slate-400 mt-1">
                <span>Days at Sea:</span>
                <strong className="text-white">{voyage.daysAtSea} Days</strong>
              </div>
            </div>
          </div>

          {/* Logistics Pipeline Stages Indicator */}
          <div className="mt-8 pt-6 border-t border-slate-800/80">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-slate-400 block mb-3">
              Official Polar Resupply Transit Pipeline
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-center text-xs font-mono">
              <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400">
                <span className="text-[10px] block text-slate-500">STAGE 1</span>
                <strong className="text-slate-300">GOA MOBILIZATION</strong>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400">
                <span className="text-[10px] block text-slate-500">STAGE 2</span>
                <strong className="text-slate-300">CAPE TOWN BUNKER</strong>
              </div>
              <div className="p-2.5 rounded-lg border border-cyan-500/40 bg-cyan-950/20 text-cyan-400 font-bold shadow-sm">
                <span className="text-[10px] block text-cyan-500">STAGE 3 (ACTIVE)</span>
                <strong>SOUTHERN OCEAN</strong>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400">
                <span className="text-[10px] block text-slate-500">STAGE 4</span>
                <strong className="text-slate-300">SHELF BARRIER</strong>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400">
                <span className="text-[10px] block text-slate-500">STAGE 5</span>
                <strong className="text-slate-300">STATION DELIVERED</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Cargo Containers Table Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-sm font-mono uppercase tracking-wider font-bold text-slate-400">
              Tracked Cargo Containers ({filtered.length})
            </h2>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              <select
                value={stationFilter}
                onChange={(e) => setStationFilter(e.target.value)}
                className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-white"
              >
                <option value="ALL">All Stations</option>
                <option value="BHR">Bharati (BHR)</option>
                <option value="MTR">Maitri (MTR)</option>
              </select>

              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-white"
              >
                <option value="ALL">All Transit Stages</option>
                <option value="SOUTHERN_OCEAN_TRANSIT">Southern Ocean Transit</option>
                <option value="CAPE_TOWN_BUNKERING">Cape Town Bunkering</option>
                <option value="STATION_DELIVERED">Station Delivered</option>
              </select>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
                    <th className="py-3 px-4">Container ID</th>
                    <th className="py-3 px-4">Classification</th>
                    <th className="py-3 px-4">Manifest Contents</th>
                    <th className="py-3 px-4">Destination</th>
                    <th className="py-3 px-4">Gross Weight</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Current Transit Leg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-cyan-400">
                        {c.containerCode}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {c.containerType}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-200 max-w-xs">
                        {c.manifestDescription}
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        {c.destinationStationCode}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {c.totalGrossWeightKg.toLocaleString()} kg
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityBadge(
                            c.priority
                          )}`}
                        >
                          {c.priority}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getStageBadge(
                            c.transitStage
                          )}`}
                        >
                          {c.transitStage.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
