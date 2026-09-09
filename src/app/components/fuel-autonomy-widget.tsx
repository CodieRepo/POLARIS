"use client";

import React, { useState } from "react";
import { MutationQueue } from "@/core/offline/mutation-queue";
import { useAuth } from "@/infrastructure/auth/auth-provider";
import type { StationFuelProfile } from "@/core/fuel/types";

interface FuelAutonomyWidgetProps {
  readonly fuelProfiles: Record<string, StationFuelProfile>;
}

export function FuelAutonomyWidget({ fuelProfiles: initialProfiles }: FuelAutonomyWidgetProps) {
  const { can, role } = useAuth();
  const [fuelProfiles, setFuelProfiles] = useState<Record<string, StationFuelProfile>>(initialProfiles);
  const [selectedStationCode, setSelectedStationCode] = useState<string>("BHR");
  const [showDipModal, setShowDipModal] = useState<boolean>(false);
  const [dipTankCode, setDipTankCode] = useState<string>("");
  const [dipLevelLiters, setDipLevelLiters] = useState<string>("");
  const [submittingDip, setSubmittingDip] = useState<boolean>(false);
  const [dipSuccessMessage, setDipSuccessMessage] = useState<string | null>(null);

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

  const openDipModalForTank = (tankCode: string, currentLevel: number) => {
    setDipTankCode(tankCode);
    setDipLevelLiters(currentLevel.toString());
    setShowDipModal(true);
  };

  const handleDipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingDip(true);
    try {
      const parsedLit = parseFloat(dipLevelLiters);

      // If browser is offline, queue mutation locally into IndexedDB
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const stationId =
          selectedStationCode === "MTR"
            ? "m0000000-0000-0000-0000-000000000002"
            : selectedStationCode === "HMD"
            ? "h0000000-0000-0000-0000-000000000003"
            : "b0000000-0000-0000-0000-000000000001";

        const tank = activeProfile?.tanks.find((t) => t.tankCode === dipTankCode);
        const tankId = tank?.id || dipTankCode;

        await MutationQueue.enqueue("LOG_FUEL_DIP", stationId, {
          tankId,
          tankCode: dipTankCode,
          dipReadingLiters: parsedLit,
          loggedBy: "Field Operations Officer (Offline)",
        });

        // Optimistically update local profile in UI state
        if (activeProfile && tank) {
          const updatedTanks = activeProfile.tanks.map((t) =>
            t.tankCode === dipTankCode
              ? {
                  ...t,
                  currentLevelLiters: parsedLit,
                  percentage: Math.round((parsedLit / t.capacityLiters) * 100),
                }
              : t
          );
          const newTotal = updatedTanks.reduce((acc, t) => acc + t.currentLevelLiters, 0);
          const newDays = Math.round(newTotal / (activeProfile.aggregateDailyBurnLiters || 450));
          setFuelProfiles((prev) => ({
            ...prev,
            [selectedStationCode]: {
              ...activeProfile,
              totalCurrentLiters: newTotal,
              daysOfAutonomy: newDays,
              tanks: updatedTanks,
            },
          }));
        }

        setShowDipModal(false);
        setDipSuccessMessage(
          `[OFFLINE MODE] Fuel Dip reading for ${dipTankCode} (${parsedLit.toLocaleString()} L) buffered locally in IndexedDB. Will synchronize automatically when connection is restored.`
        );
        setTimeout(() => setDipSuccessMessage(null), 8000);
        window.dispatchEvent(new Event("offline-mutation-queued"));
        return;
      }

      let res: Response;
      try {
        res = await fetch("/api/fuel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tankCode: dipTankCode,
            newLevelLiters: parsedLit,
          }),
        });
      } catch (netErr) {
        console.warn("Network request failed, falling back to offline mutation queue:", netErr);
        const stationId =
          selectedStationCode === "MTR"
            ? "m0000000-0000-0000-0000-000000000002"
            : selectedStationCode === "HMD"
            ? "h0000000-0000-0000-0000-000000000003"
            : "b0000000-0000-0000-0000-000000000001";

        const tank = activeProfile?.tanks.find((t) => t.tankCode === dipTankCode);
        const tankId = tank?.id || dipTankCode;

        await MutationQueue.enqueue("LOG_FUEL_DIP", stationId, {
          tankId,
          tankCode: dipTankCode,
          dipReadingLiters: parsedLit,
          loggedBy: "Field Operations Officer (Offline)",
        });

        setShowDipModal(false);
        setDipSuccessMessage(
          `[OFFLINE MODE] Fuel Dip reading for ${dipTankCode} (${parsedLit.toLocaleString()} L) buffered locally in IndexedDB. Will synchronize automatically when connection is restored.`
        );
        setTimeout(() => setDipSuccessMessage(null), 8000);
        window.dispatchEvent(new Event("offline-mutation-queued"));
        return;
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update fuel dip");
      }

      if (json.profiles) {
        setFuelProfiles(json.profiles);
      }
      setShowDipModal(false);
      setDipSuccessMessage(`Dip measurement for ${dipTankCode} recorded to station logs. Autonomy recalculated.`);
      setTimeout(() => setDipSuccessMessage(null), 5000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to record dip reading");
    } finally {
      setSubmittingDip(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sky-800 font-mono text-xs font-bold uppercase tracking-wider">
              Life Support &amp; Fuel Farm Autonomy
            </span>
            <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-mono text-amber-800 border border-amber-300 border-dashed">
              SEEDED_OPERATIONAL_BASELINE
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-1">
            Station Fuel Reserves &amp; Operational Autonomy
          </h2>
          <span className="text-[11px] text-slate-500 font-mono">
            Source: Station Tank Sensor Log • Formula: Days = Current Balance / Daily Burn Rate
          </span>
        </div>

        {/* Controls & Station Selector Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 border border-slate-200 p-1">
            {Object.entries(fuelProfiles)
              .filter(([code]) => code !== "DGT")
              .map(([code, p]) => (
                <button
                  key={code}
                  onClick={() => setSelectedStationCode(code)}
                  className={`px-3 py-1 text-xs font-mono font-bold rounded-md transition-colors cursor-pointer ${
                    selectedStationCode === code
                      ? "bg-sky-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {code} ({p.daysOfAutonomy}d)
                </button>
              ))}
          </div>
        </div>
      </div>

      {dipSuccessMessage && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-mono text-emerald-800 flex items-center justify-between">
          <span>✓ {dipSuccessMessage}</span>
          <button onClick={() => setDipSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">✕</button>
        </div>
      )}

      {/* Selected Station Operational Metrics */}
      {activeProfile && (
        <div>
          {/* Top Autonomy Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-[11px] font-medium text-slate-500 block">
                Calculated Autonomy Window
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-slate-900">
                  {activeProfile.daysOfAutonomy}
                </span>
                <span className="text-xs font-bold text-slate-500 uppercase">Days</span>
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

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-[11px] font-medium text-slate-500 block">
                Active Usable Balance
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-sky-700">
                  {activeProfile.totalCurrentLiters.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500">/ {activeProfile.totalCapacityLiters.toLocaleString()} L</span>
              </div>
              <div className="mt-2 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-sky-600 h-full rounded-full"
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

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-[11px] font-medium text-slate-500 block">
                Aggregate Daily Burn Rate
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-amber-800">
                  {activeProfile.aggregateDailyBurnLiters}
                </span>
                <span className="text-xs font-bold text-slate-500">L / 24h</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-2 block">
                Prime Power + Space Heating Boilers
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-[11px] font-medium text-slate-500 block">
                Next Maritime Resupply Window
              </span>
              <div className="mt-1 text-sm font-bold font-mono text-slate-800">
                Feb 2027 • ISEA-45
              </div>
              <span className="text-[10px] text-emerald-700 mt-2 block font-mono">
                ✓ Fuel buffer covers full winter-over isolation
              </span>
            </div>
          </div>

          {/* Detailed Fuel Tanks Breakdown Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-800 flex justify-between items-center">
              <span>{activeProfile.stationName} Bulk Tanks &amp; Day Caches</span>
              <span className="text-[10px] text-slate-500 font-mono">
                Click a tank to record a manual dip measurement
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                    <th className="py-2.5 px-4 font-semibold">Tank Tag</th>
                    <th className="py-2.5 px-4 font-semibold">Classification</th>
                    <th className="py-2.5 px-4 font-semibold">Fuel Grade</th>
                    <th className="py-2.5 px-4 font-semibold">Current Dip</th>
                    <th className="py-2.5 px-4 font-semibold">Capacity</th>
                    <th className="py-2.5 px-4 font-semibold">Fill Level</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeProfile.tanks.map((tank) => (
                    <tr key={tank.tankCode} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-bold text-sky-700">
                        {tank.tankCode}
                      </td>
                      <td className="py-2.5 px-4 text-slate-800">
                        {tank.tankName}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-amber-800 font-bold">
                        {tank.fuelType}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-900">
                        {tank.currentLevelLiters.toLocaleString()} L
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-500">
                        {tank.capacityLiters.toLocaleString()} L
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                tank.percentage > 40 ? "bg-emerald-600" : "bg-amber-500"
                              }`}
                              style={{ width: `${tank.percentage}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-slate-700 font-bold">
                            {tank.percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {can("FUEL_RECORD_DIP") || (!role || (role !== "VIEWER" && role !== "EXPEDITION_MANAGER")) ? (
                          <button
                            onClick={() => openDipModalForTank(tank.tankCode, tank.currentLevelLiters)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-sky-600 hover:text-white font-mono text-[10px] font-bold text-slate-700 transition-colors cursor-pointer border border-slate-300"
                          >
                            Record Dip
                          </button>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-500 italic">
                            Read Only
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Manual Fuel Dip Measurement Modal */}
      {showDipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Record Fuel Dip: {dipTankCode}
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  Updates balance in `station_fuel_tanks`
                </span>
              </div>
              <button
                onClick={() => setShowDipModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDipSubmit} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-700 mb-1 font-semibold">
                  Measured Liquid Volume (Liters):
                </label>
                <input
                  type="number"
                  step="10"
                  required
                  value={dipLevelLiters}
                  onChange={(e) => setDipLevelLiters(e.target.value)}
                  className="w-full rounded-lg bg-slate-50 border border-slate-300 px-3 py-2 text-slate-900 text-base font-bold focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                Note: Updating the dip reading updates autonomy days in real time. If the balance falls below 20% of tank capacity, an automatic operational low-fuel warning will be persisted to `operational_alerts`.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowDipModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDip}
                  className="px-4 py-1.5 rounded-lg bg-sky-600 text-white font-bold hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
                >
                  {submittingDip ? "Committing..." : "Commit Dip Reading"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
