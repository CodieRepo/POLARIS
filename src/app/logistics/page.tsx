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
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "SOUTHERN_OCEAN_TRANSIT":
        return "bg-sky-50 text-sky-800 border-sky-200";
      case "CAPE_TOWN_BUNKERING":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "ICE_SHELF_BARRIER":
        return "bg-purple-50 text-purple-800 border-purple-200";
      case "GOA_MOBILIZATION":
        return "bg-slate-100 text-slate-700 border-slate-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "MISSION_CRITICAL":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "COLD_CHAIN":
        return "bg-sky-50 text-sky-700 border-sky-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <PolarisHeader currentPath="/logistics" />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
          <Link href="/" className="hover:text-sky-700 transition-colors">
            ← Command Center
          </Link>
          <span>/</span>
          <span className="font-bold text-sky-700">Maritime Logistics &amp; Resupply Chain</span>
        </div>

        {/* Header Summary Banner */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-sky-50 px-2.5 py-0.5 text-xs font-mono font-bold text-sky-800 border border-sky-200">
                  MARITIME LOGISTICS
                </span>
                <span className="rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-mono font-bold text-amber-800 border border-amber-300">
                  🟡 OPERATIONAL SIMULATION MODEL
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Voyage: {voyage.voyageCode}
                </span>
                <span className="text-slate-300 hidden sm:inline">•</span>
                <span className="text-xs text-emerald-700 font-mono flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Central Logistics Manifest
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                Polar Freight Manifests &amp; Resupply Chain
              </h1>
              <p className="max-w-3xl text-xs sm:text-sm text-slate-600 leading-relaxed">
                Tracks ISO 20-foot shipping containers, breakbulk pallets, and hazardous fuel drums
                from Mormugao Port (Goa) via Cape Town bunkering to Antarctica ice shelf barrier offloading.
              </p>
            </div>

            {/* Active Vessel Card */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 min-w-[240px] text-xs font-mono shadow-xs shrink-0">
              <span className="text-slate-500 block uppercase font-bold text-[10px]">Active Chartered Vessel</span>
              <strong className="text-slate-900 text-sm block mt-0.5 font-bold">{voyage.vesselName}</strong>
              <div className="mt-2.5 flex justify-between text-slate-600 border-t border-slate-200 pt-2">
                <span>Total Tonnage:</span>
                <strong className="text-sky-700 font-bold tabular-nums">{voyage.totalTonnageMetricTons} MT</strong>
              </div>
              <div className="flex justify-between text-slate-600 mt-1">
                <span>Days at Sea:</span>
                <strong className="text-slate-900 tabular-nums">{voyage.daysAtSea} Days</strong>
              </div>
              <div className="flex justify-between text-slate-600 mt-1">
                <span>Data Posture:</span>
                <strong className={isLoading ? "text-amber-700" : "text-emerald-700"}>
                  {isLoading ? "LOADING..." : "DB LOADED"}
                </strong>
              </div>
            </div>
          </div>

          {/* Horizontal Operational Pipeline */}
          <div className="border-t border-slate-200 pt-5 space-y-3">
            <span className="text-xs font-mono uppercase tracking-wider font-bold text-slate-500 block">
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
                        ? "border-sky-300 bg-sky-50/80 shadow-xs"
                        : "border-slate-200 bg-slate-50/60 text-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-500">STAGE {ps.step}</span>
                      {isActive && (
                        <span className="rounded bg-sky-100 text-sky-800 border border-sky-200 px-1.5 py-0.2 text-[9px] font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <strong className={`block text-xs ${isActive ? "text-sky-900 font-bold" : "text-slate-800"}`}>
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
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <span>📦</span> Tracked Cargo Containers
                <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-mono text-slate-700">
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
                className="rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 min-w-[200px]"
              />

              <select
                value={stationFilter}
                onChange={(e) => setStationFilter(e.target.value)}
                className="rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-slate-900 focus:outline-none focus:border-sky-500"
              >
                <option value="ALL">All Stations</option>
                <option value="BHR">Bharati Base (BHR)</option>
                <option value="MTR">Maitri Base (MTR)</option>
              </select>

              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-slate-900 focus:outline-none focus:border-sky-500"
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
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold font-mono text-[11px] uppercase">
                    <th className="py-3 px-4">Container ID</th>
                    <th className="py-3 px-4">Classification</th>
                    <th className="py-3 px-4 font-sans">Manifest Contents</th>
                    <th className="py-3 px-4">Destination</th>
                    <th className="py-3 px-4">Gross Weight</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Transit Stage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                        No containers match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-sky-700">
                          {c.containerCode}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {c.containerType}
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-800 max-w-xs leading-tight">
                          {c.manifestDescription}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {c.destinationStationCode}
                        </td>
                        <td className="py-3 px-4 text-slate-600 tabular-nums">
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
                                className={`rounded-md px-2 py-1 text-[11px] font-bold border ${getStageBadge(
                                  c.transitStage
                                )} bg-white focus:outline-none cursor-pointer disabled:opacity-50`}
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
                              <span className="text-[10px] text-sky-700 animate-pulse font-bold">
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

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 mt-12">
        POLARIS • National Centre for Polar &amp; Ocean Research (NCPOR) Management Foundation • SIH 2026
      </footer>
    </div>
  );
}

