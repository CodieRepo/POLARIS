"use client";

import React, { useState } from "react";
import type { StationFuelProfile } from "@/core/fuel/types";

interface FuelAutonomyWidgetProps {
  readonly fuelProfiles: Record<string, StationFuelProfile>;
}

export function FuelAutonomyWidget({ fuelProfiles }: FuelAutonomyWidgetProps) {
  const [selectedStationCode, setSelectedStationCode] = useState<string>("BHR");
  const activeProfile = fuelProfiles[selectedStationCode] || fuelProfiles["BHR"];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "NORMAL":
        return "text-emerald-400 bg-emerald-950/40 border-emerald-500/30";
      case "WATCH":
        return "text-amber-400 bg-amber-950/40 border-amber-500/30";
      case "RESUPPLY_REQUIRED":
        return "text-orange-400 bg-orange-950/40 border-orange-500/30";
      case "CRITICAL":
        return "text-rose-400 bg-rose-950/40 border-rose-500/30";
      default:
        return "text-slate-400 bg-slate-900 border-slate-800";
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-mono text-xs font-bold uppercase tracking-wider">
              Life Support &amp; Fuel Farm Autonomy
            </span>
            <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono text-cyan-400 border border-cyan-500/20">
              COMNAP STANDARD
            </span>
          </div>
          <h2 className="text-lg font-black text-white mt-1">
            Station Fuel Reserves &amp; Operational Autonomy
          </h2>
        </div>

        {/* Station Selector Tabs */}
        <div className="flex rounded-lg bg-slate-950 border border-slate-800 p-1">
          {Object.entries(fuelProfiles)
            .filter(([code]) => code !== "DGT")
            .map(([code, p]) => (
              <button
                key={code}
                onClick={() => setSelectedStationCode(code)}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-md transition-colors ${
                  selectedStationCode === code
                    ? "bg-cyan-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {code} ({p.daysOfAutonomy}d)
              </button>
            ))}
        </div>
      </div>

      {/* Selected Station Operational Metrics */}
      {activeProfile && (
        <div>
          {/* Top Autonomy Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <span className="text-[11px] font-medium text-slate-400 block">
                Calculated Autonomy Window
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-white">
                  {activeProfile.daysOfAutonomy}
                </span>
                <span className="text-xs font-bold text-slate-400 uppercase">Days</span>
              </div>
              <div className="mt-2">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getStatusColor(
                    activeProfile.autonomyStatus
                  )}`}
                >
                  AUTONOMY: {activeProfile.autonomyStatus}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <span className="text-[11px] font-medium text-slate-400 block">
                Active Usable Balance
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-cyan-400">
                  {activeProfile.totalCurrentLiters.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400">/ {activeProfile.totalCapacityLiters.toLocaleString()} L</span>
              </div>
              <div className="mt-2 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-cyan-500 h-full rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (activeProfile.totalCurrentLiters /
                          (activeProfile.totalCapacityLiters || 1)) *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <span className="text-[11px] font-medium text-slate-400 block">
                Aggregate Daily Burn Rate
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-amber-400">
                  {activeProfile.aggregateDailyBurnLiters}
                </span>
                <span className="text-xs font-bold text-slate-400">L / 24h</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-2 block">
                Prime Power + Space Heating Boilers
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <span className="text-[11px] font-medium text-slate-400 block">
                Next Maritime Resupply Window
              </span>
              <div className="mt-1 text-sm font-bold font-mono text-slate-200">
                Feb 2027 • ISEA-45
              </div>
              <span className="text-[10px] text-emerald-400 mt-2 block font-mono">
                ✓ Fuel buffer covers full winter-over isolation
              </span>
            </div>
          </div>

          {/* Detailed Fuel Tanks Breakdown Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
            <div className="px-4 py-3 bg-slate-900/80 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-300 flex justify-between items-center">
              <span>{activeProfile.stationName} Bulk Tanks &amp; Day Caches</span>
              <span className="text-[10px] text-slate-500 font-mono">
                Formula: Days = Balance / Daily Burn
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80 text-slate-400">
                    <th className="py-2.5 px-4 font-semibold">Tank Tag</th>
                    <th className="py-2.5 px-4 font-semibold">Classification</th>
                    <th className="py-2.5 px-4 font-semibold">Fuel Grade</th>
                    <th className="py-2.5 px-4 font-semibold">Current Dip</th>
                    <th className="py-2.5 px-4 font-semibold">Capacity</th>
                    <th className="py-2.5 px-4 font-semibold">Fill Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {activeProfile.tanks.map((tank) => (
                    <tr key={tank.tankCode} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-mono font-bold text-cyan-400">
                        {tank.tankCode}
                      </td>
                      <td className="py-2.5 px-4 text-slate-200">
                        {tank.tankName}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-amber-400 font-bold">
                        {tank.fuelType}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-medium text-white">
                        {tank.currentLevelLiters.toLocaleString()} L
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-400">
                        {tank.capacityLiters.toLocaleString()} L
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                tank.percentage > 40 ? "bg-emerald-500" : "bg-amber-500"
                              }`}
                              style={{ width: `${tank.percentage}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-slate-300 font-bold">
                            {tank.percentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
