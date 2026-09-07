"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { PolarisHeader } from "../components/polaris-header";
import { useAuth } from "@/infrastructure/auth/auth-provider";
import { LogisticsService } from "@/modules/logistics/logistics-service";
import type { CargoContainer, LogisticsTransitStage, VoyageOverview } from "@/modules/logistics/types/logistics.types";

export default function LogisticsPage() {
  const { can, role } = useAuth();
  const [voyage, setVoyage] = useState<VoyageOverview>(LogisticsService.getActiveVoyage());
  const [containers, setContainers] = useState<CargoContainer[]>(() => [...LogisticsService.getAllContainers()]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [updatingCode, setUpdatingCode] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [stationFilter, setStationFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    async function loadContainers() {
      try {
        const res = await fetch("/api/logistics/containers");
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setContainers(json.data.containers);
            if (json.data.voyage) {
              setVoyage(json.data.voyage);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load containers from DB:", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadContainers();
  }, []);

  const handleStageChange = async (containerCode: string, newStage: LogisticsTransitStage) => {
    setUpdatingCode(containerCode);
    try {
      const res = await fetch("/api/logistics/containers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ containerCode, newStage }),
      });
      if (res.ok) {
        setContainers((prev) =>
          prev.map((c) => (c.containerCode === containerCode ? { ...c, transitStage: newStage } : c))
        );
      }
    } catch (e) {
      console.error("Failed to update container stage:", e);
    } finally {
      setUpdatingCode(null);
    }
  };

  const filtered = containers.filter((c) => {
    if (stageFilter !== "ALL" && c.transitStage !== stageFilter) return false;
    if (stationFilter !== "ALL" && c.destinationStationCode !== stationFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        c.containerCode.toLowerCase().includes(term) ||
        c.manifestDescription.toLowerCase().includes(term) ||
        c.containerType.toLowerCase().includes(term)
      );
    }
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
      case "GOA_MOBILIZATION":
        return "bg-slate-700/30 text-slate-300 border-slate-600";
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

  const pipelineStages: { stage: LogisticsTransitStage; label: string; step: number; desc: string }[] = [
    { stage: "GOA_MOBILIZATION", label: "Goa Mobilization", step: 1, desc: "Mormugao Port loading" },
    { stage: "CAPE_TOWN_BUNKERING", label: "Cape Town Bunker", step: 2, desc: "Fuel & cold supplies" },
    { stage: "SOUTHERN_OCEAN_TRANSIT", label: "Southern Ocean", step: 3, desc: "Active vessel transit" },
    { stage: "ICE_SHELF_BARRIER", label: "Shelf Barrier", step: 4, desc: "Helicopter & crane offload" },
    { stage: "STATION_DELIVERED", label: "Station Delivered", step: 5, desc: "In-situ base inventory" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <PolarisHeader currentPath="/logistics" />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <Link href="/" className="hover:text-cyan-400 transition-colors">
            ← Command Center
          </Link>
          <span>/</span>
          <span className="font-bold text-cyan-400">Maritime Logistics &amp; Resupply Chain</span>
        </div>

        {/* Header Summary Banner */}
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/50 to-slate-950 p-6 sm:p-7 shadow-xl space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-xs font-mono font-bold text-cyan-400 border border-cyan-500/30">
                  MARITIME LOGISTICS
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Voyage Code: {voyage.voyageCode}
                </span>
                <span className="text-slate-600 hidden sm:inline">•</span>
                <span className="text-xs text-emerald-400 font-mono">
                  PostgreSQL `public.cargo_containers`
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Polar Freight Manifests &amp; Resupply Chain
              </h1>
              <p className="max-w-3xl text-xs sm:text-sm text-slate-300 leading-relaxed">
                Tracks ISO 20-foot shipping containers, breakbulk pallets, and hazardous fuel drums
                from Mormugao Port (Goa) via Cape Town bunkering to Antarctica ice shelf barrier offloading.
              </p>
            </div>

            {/* Active Vessel Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 min-w-[240px] text-xs font-mono shadow-lg shrink-0">
              <span className="text-slate-500 block uppercase font-bold text-[10px]">Active Chartered Vessel</span>
              <strong className="text-white text-sm block mt-0.5">{voyage.vesselName}</strong>
              <div className="mt-2.5 flex justify-between text-slate-400 border-t border-slate-800/80 pt-2">
                <span>Total Tonnage:</span>
                <strong className="text-cyan-400">{voyage.totalTonnageMetricTons} MT</strong>
              </div>
              <div className="flex justify-between text-slate-400 mt-1">
                <span>Days at Sea:</span>
                <strong className="text-white">{voyage.daysAtSea} Days</strong>
              </div>
              <div className="flex justify-between text-slate-400 mt-1">
                <span>Sync Posture:</span>
                <strong className={isLoading ? "text-amber-400" : "text-emerald-400"}>
                  {isLoading ? "SYNCING..." : "LIVE (PostgreSQL)"}
                </strong>
              </div>
            </div>
          </div>

          {/* Horizontal Operational Pipeline */}
          <div className="border-t border-slate-800/80 pt-5 space-y-3">
            <span className="text-xs font-mono uppercase tracking-wider font-bold text-slate-400 block">
              Official Polar Resupply Transit Pipeline
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs font-mono">
              {pipelineStages.map((ps) => {
                const isActive = ps.stage === "SOUTHERN_OCEAN_TRANSIT";
                return (
                  <div
                    key={ps.stage}
                    className={`p-3 rounded-xl border transition-all ${
                      isActive
                        ? "border-cyan-500/40 bg-cyan-950/20 shadow-sm"
                        : "border-slate-800 bg-slate-950/80 text-slate-400"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-500">STAGE {ps.step}</span>
                      {isActive && (
                        <span className="rounded bg-cyan-500/20 px-1.5 py-0.2 text-[9px] font-bold text-cyan-400">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <strong className={`block text-xs ${isActive ? "text-cyan-300 font-bold" : "text-slate-300"}`}>
                      {ps.label}
                    </strong>
                    <span className="text-[10px] text-slate-500 mt-0.5 block font-sans truncate">
                      {ps.desc}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cargo Containers Table Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <span>📦</span> Tracked Cargo Containers
                <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-mono text-slate-300">
                  {filtered.length} Units
                </span>
              </h2>
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              <input
                type="text"
                placeholder="Search container / manifest..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 min-w-[200px]"
              />

              <select
                value={stationFilter}
                onChange={(e) => setStationFilter(e.target.value)}
                className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Stations</option>
                <option value="BHR">Bharati Base (BHR)</option>
                <option value="MTR">Maitri Base (MTR)</option>
              </select>

              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Transit Stages</option>
                <option value="GOA_MOBILIZATION">Goa Mobilization</option>
                <option value="CAPE_TOWN_BUNKERING">Cape Town Bunkering</option>
                <option value="SOUTHERN_OCEAN_TRANSIT">Southern Ocean Transit</option>
                <option value="ICE_SHELF_BARRIER">Ice Shelf Barrier</option>
                <option value="STATION_DELIVERED">Station Delivered</option>
              </select>
            </div>
          </div>

          {/* Container Manifest Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold font-mono">
                    <th className="py-3 px-4">Container ID</th>
                    <th className="py-3 px-4">Classification</th>
                    <th className="py-3 px-4 font-sans">Manifest Contents</th>
                    <th className="py-3 px-4">Destination</th>
                    <th className="py-3 px-4">Gross Weight</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Transit Stage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No containers match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-900/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-cyan-400">
                          {c.containerCode}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {c.containerType}
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-200 max-w-xs leading-tight">
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
                          <div className="flex items-center gap-2">
                            {can("LOGISTICS_UPDATE_STAGE") || (!role || role !== "VIEWER") ? (
                              <select
                                value={c.transitStage}
                                disabled={updatingCode === c.containerCode}
                                onChange={(e) => handleStageChange(c.containerCode, e.target.value as LogisticsTransitStage)}
                                className={`rounded px-2 py-1 text-[11px] font-bold border ${getStageBadge(
                                  c.transitStage
                                )} bg-slate-950 focus:outline-none cursor-pointer disabled:opacity-50`}
                              >
                                <option value="GOA_MOBILIZATION">GOA MOBILIZATION</option>
                                <option value="CAPE_TOWN_BUNKERING">CAPE TOWN BUNKERING</option>
                                <option value="SOUTHERN_OCEAN_TRANSIT">SOUTHERN OCEAN TRANSIT</option>
                                <option value="ICE_SHELF_BARRIER">ICE SHELF BARRIER</option>
                                <option value="STATION_DELIVERED">STATION DELIVERED</option>
                              </select>
                            ) : (
                              <span
                                className={`inline-block px-2 py-1 rounded text-[11px] font-bold border ${getStageBadge(
                                  c.transitStage
                                )}`}
                              >
                                {c.transitStage.replace(/_/g, " ")}
                              </span>
                            )}
                            {updatingCode === c.containerCode && (
                              <span className="text-[10px] text-cyan-400 animate-pulse font-bold">
                                Updating...
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500 mt-12">
        POLARIS • National Centre for Polar &amp; Ocean Research (NCPOR) Management Foundation • SIH 2026
      </footer>
    </div>
  );
}

