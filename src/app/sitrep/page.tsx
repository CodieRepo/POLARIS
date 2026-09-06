"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { PolarisHeader } from "../components/polaris-header";
import { MutationQueue } from "@/core/offline/mutation-queue";
import { useAuth } from "@/infrastructure/auth/auth-provider";
import type { DailySitrepData, OutdoorClearanceStatus, IntegrityVerificationResult } from "@/core/sitrep/types";

export default function SitrepPage() {
  const { role } = useAuth();
  const [sitreps, setSitreps] = useState<readonly DailySitrepData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedStation, setSelectedStation] = useState<"BHR" | "MTR" | "HMD">("BHR");
  const [commanderName, setCommanderName] = useState("Cmdr. Vikram Shekhawat");
  const [winterOver, setWinterOver] = useState(24);
  const [summerScience, setSummerScience] = useState(18);
  const [transientAircrew, setTransientAircrew] = useState(0);
  const [fuelConsumed, setFuelConsumed] = useState(480);
  const [generatorHours, setGeneratorHours] = useState(24);
  const [outdoorStatus, setOutdoorStatus] = useState<OutdoorClearanceStatus>("GREEN_NORMAL");
  const [remarks, setRemarks] = useState(
    "Standard 08:00 UTC operational dispatch. All primary systems nominal. Power generation and heating loops operating within seasonal limits."
  );
  const [submitting, setSubmitting] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [verificationMap, setVerificationMap] = useState<Record<string, IntegrityVerificationResult>>({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const fetchSitreps = async () => {
    try {
      const res = await fetch("/api/sitrep");
      const json = await res.json();
      if (json.success && json.data) {
        setSitreps(json.data);
      }
    } catch (err) {
      console.error("Failed to load sitreps from PostgreSQL:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSitreps();
  }, []);

  const handleStationChange = (code: "BHR" | "MTR" | "HMD") => {
    setSelectedStation(code);
    if (code === "BHR") {
      setCommanderName("Cmdr. Vikram Shekhawat");
      setWinterOver(24);
      setSummerScience(18);
      setFuelConsumed(480);
    } else if (code === "MTR") {
      setCommanderName("Dr. Rajesh Nair");
      setWinterOver(19);
      setSummerScience(0);
      setFuelConsumed(420);
    } else {
      setCommanderName("Station Officer Himadri");
      setWinterOver(4);
      setSummerScience(4);
      setFuelConsumed(45);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const stationId =
        selectedStation === "MTR"
          ? "b0000000-0000-0000-0000-000000000002"
          : selectedStation === "HMD"
          ? "b0000000-0000-0000-0000-000000000003"
          : "b0000000-0000-0000-0000-000000000001";

      const reportDateStr = new Date().toISOString().split("T")[0];

      // If browser is offline, queue mutation locally into IndexedDB
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const idempotencyKey = await MutationQueue.enqueue("SUBMIT_SITREP", stationId, {
          reportDate: reportDateStr,
          commanderName,
          signerIdentity: `STATION_COMMANDER_${selectedStation}`,
          winterOverHeadcount: winterOver,
          summerScienceHeadcount: summerScience,
          transientHeadcount: transientAircrew,
          minTempC: selectedStation === "BHR" ? -16.5 : selectedStation === "MTR" ? -18.5 : -2.0,
          maxTempC: selectedStation === "BHR" ? -11.0 : selectedStation === "MTR" ? -12.0 : 4.0,
          peakWindKmh: selectedStation === "BHR" ? 42.0 : 28.0,
          pressureHpa: selectedStation === "BHR" ? 985.0 : 976.0,
          pressureTrend6h: selectedStation === "BHR" ? -1.2 : 0.5,
          fuelConsumed24hLiters: fuelConsumed,
          generatorRuntimeHours: generatorHours,
          outdoorStatus,
          operationalRemarks: remarks || "Offline SITREP filed from local field station client.",
        });

        setShowCreateModal(false);
        setSuccessBanner(
          `[OFFLINE MODE] Daily SITREP for ${selectedStation} (${reportDateStr}) buffered locally in IndexedDB (Queue ID: ${idempotencyKey.slice(0, 8)}). Will synchronize automatically when connection is restored.`
        );
        window.dispatchEvent(new Event("offline-mutation-queued"));
        return;
      }

      const payload = {
        input: {
          stationCode: selectedStation,
          commanderName,
          signerIdentity: `STATION_COMMANDER_${selectedStation}`,
          winterOver,
          summerScience,
          transientAircrew,
          fuelConsumed24hLiters: fuelConsumed,
          generatorRuntimeHours: generatorHours,
          outdoorStatus,
          operationalRemarks: remarks,
        },
        weatherSummary: {
          currentTempC: selectedStation === "BHR" ? -13.8 : selectedStation === "MTR" ? -14.2 : 2.3,
          minTemp24hC: selectedStation === "BHR" ? -16.5 : -18.5,
          maxTemp24hC: selectedStation === "BHR" ? -11.0 : -12.0,
          peakWindKmh: selectedStation === "BHR" ? 42.0 : 28.0,
          currentPressureHpa: selectedStation === "BHR" ? 985.0 : 976.0,
          pressureDelta6h: selectedStation === "BHR" ? -1.2 : 0.5,
        },
      };

      let res: Response;
      try {
        res = await fetch("/api/sitrep", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (netErr) {
        // Network failure fallback: buffer offline in IndexedDB
        console.warn("Network request failed, falling back to offline mutation queue:", netErr);
        const idempotencyKey = await MutationQueue.enqueue("SUBMIT_SITREP", stationId, {
          reportDate: reportDateStr,
          commanderName,
          signerIdentity: `STATION_COMMANDER_${selectedStation}`,
          winterOverHeadcount: winterOver,
          summerScienceHeadcount: summerScience,
          transientHeadcount: transientAircrew,
          minTempC: selectedStation === "BHR" ? -16.5 : selectedStation === "MTR" ? -18.5 : -2.0,
          maxTempC: selectedStation === "BHR" ? -11.0 : selectedStation === "MTR" ? -12.0 : 4.0,
          peakWindKmh: selectedStation === "BHR" ? 42.0 : 28.0,
          pressureHpa: selectedStation === "BHR" ? 985.0 : 976.0,
          pressureTrend6h: selectedStation === "BHR" ? -1.2 : 0.5,
          fuelConsumed24hLiters: fuelConsumed,
          generatorRuntimeHours: generatorHours,
          outdoorStatus,
          operationalRemarks: remarks || "Offline SITREP filed from local field station client.",
        });

        setShowCreateModal(false);
        setSuccessBanner(
          `[OFFLINE MODE] Daily SITREP for ${selectedStation} (${reportDateStr}) buffered locally in IndexedDB (Queue ID: ${idempotencyKey.slice(0, 8)}). Will synchronize automatically when connection is restored.`
        );
        window.dispatchEvent(new Event("offline-mutation-queued"));
        return;
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to commit SITREP to database");
      }

      await fetchSitreps();
      setShowCreateModal(false);
      setSuccessBanner(
        `SITREP for ${selectedStation} persisted to PostgreSQL with SHA-256 integrity hash: ${json.data.integrityHash.substring(0, 16)}...`
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyIntegrity = async (id: string) => {
    setVerifyingId(id);
    try {
      const res = await fetch("/api/sitrep/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (json.success && json.verification) {
        setVerificationMap((prev) => ({ ...prev, [id]: json.verification }));
      }
    } catch (err) {
      console.error("Verification failed:", err);
    } finally {
      setVerifyingId(null);
    }
  };

  const getStatusBadge = (status: OutdoorClearanceStatus) => {
    switch (status) {
      case "GREEN_NORMAL":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "YELLOW_RESTRICTED":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "RED_LOCKDOWN":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      default:
        return "bg-slate-800 text-slate-400";
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PolarisHeader currentPath="/sitrep" />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {/* Navigation Breadcrumb */}
        <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Link href="/" className="hover:text-cyan-400">
              ← Command Dashboard
            </Link>
            <span>/</span>
            <span className="font-mono text-cyan-400">Daily Station Commander SITREPs</span>
          </div>
          <button
            onClick={() => window.print()}
            className="rounded bg-slate-900 border border-slate-800 px-3 py-1 text-xs text-slate-300 hover:text-white font-mono cursor-pointer"
          >
            🖨️ Print / Export PDF
          </button>
        </div>

        {/* Success Banner */}
        {successBanner && (
          <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-xs font-mono text-emerald-300 flex justify-between items-center">
            <span>✅ {successBanner}</span>
            <button
              onClick={() => setSuccessBanner(null)}
              className="text-emerald-400 hover:text-white font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Header Summary */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 mb-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-xs font-mono font-bold text-cyan-400 border border-cyan-500/30">
                  COMNAP / MoES FORM 104
                </span>
                <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                  ● PostgreSQL System of Record
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">
                Station Commander Daily Situation Reports (SITREP)
              </h1>
              <p className="mt-2 text-sm text-slate-300 max-w-3xl leading-relaxed">
                Official daily operational dispatches recorded by Station Leaders to NCPOR Headquarters, Goa.
                Submissions are stored in PostgreSQL (`daily_sitreps`) with a deterministic SHA-256 document integrity hash for tamper verification.
              </p>
            </div>

            {(!role || role !== "VIEWER") && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20 cursor-pointer whitespace-nowrap"
              >
                + File Daily SITREP
              </button>
            )}
          </div>
        </div>

        {/* SITREPs List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono uppercase tracking-wider font-bold text-slate-400">
              Persisted Official Dispatches ({sitreps.length})
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              Database: `public.daily_sitreps`
            </span>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-sm font-mono text-slate-400">
              Loading dispatches from PostgreSQL...
            </div>
          ) : sitreps.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-sm font-mono text-slate-400">
              No SITREPs recorded yet. Click &ldquo;+ File Daily SITREP&rdquo; to create the first dispatch.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {sitreps.map((doc) => {
                const verification = verificationMap[doc.id];
                return (
                  <div
                    key={doc.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 hover:border-slate-700 transition-colors shadow-lg space-y-4"
                  >
                    {/* SITREP Card Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-black text-cyan-400">
                          {doc.stationCode}
                        </span>
                        <span className="text-sm font-bold text-white">
                          {doc.stationName}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          • Date: {doc.reportDate}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold border ${getStatusBadge(
                            doc.outdoorStatus
                          )}`}
                        >
                          CLEARANCE: {doc.outdoorStatus.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    {/* Metrics Breakdown */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                      <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] uppercase">Commander</span>
                        <span className="text-slate-200 font-bold">{doc.commanderName}</span>
                      </div>

                      <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] uppercase">Headcount</span>
                        <span className="text-white font-bold">
                          {doc.headcount.total} pers ({doc.headcount.winterOver} WO / {doc.headcount.summerScience} Sci)
                        </span>
                      </div>

                      <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] uppercase">Fuel Burned (24h)</span>
                        <span className="text-amber-400 font-bold">
                          {doc.fuelConsumed24hLiters} L (Gen: {doc.generatorRuntimeHours}h)
                        </span>
                      </div>

                      <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                        <span className="text-slate-500 block text-[10px] uppercase">24h Weather Extremes</span>
                        <span className="text-cyan-400 font-bold">
                          {doc.weatherSummary.minTemp24hC}°C to {doc.weatherSummary.maxTemp24hC}°C • {doc.weatherSummary.peakWindKmh} km/h
                        </span>
                      </div>
                    </div>

                    {/* Operational Remarks */}
                    <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-xs leading-relaxed text-slate-300">
                      <strong className="text-cyan-400 block mb-1 font-mono uppercase text-[10px]">
                        Commander Operational Dispatch Remarks:
                      </strong>
                      {doc.operationalRemarks}
                    </div>

                    {/* Cryptographic Document Integrity Hash Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] font-mono text-slate-400 pt-3 border-t border-slate-800/80 bg-slate-950/40 px-3 py-2 rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 uppercase text-[10px] font-bold">Document Integrity Hash (SHA-256):</span>
                          <span className="text-cyan-400 font-mono break-all">{doc.integrityHash}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Signer: {doc.signerIdentity} • Timestamp: {doc.signedOffAt}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {verification ? (
                          <span
                            className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono border ${
                              verification.isValid
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            }`}
                          >
                            {verification.isValid ? "✓ SHA-256 VERIFIED" : "✕ HASH MISMATCH"}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleVerifyIntegrity(doc.id)}
                            disabled={verifyingId === doc.id}
                            className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-[10px] font-bold font-mono border border-slate-700 cursor-pointer disabled:opacity-50"
                          >
                            {verifyingId === doc.id ? "Verifying..." : "Verify Integrity"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal: File Daily SITREP */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    File Official Daily SITREP
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    Persisted with SHA-256 canonical hash to `daily_sitreps`
                  </span>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Research Station</label>
                    <select
                      value={selectedStation}
                      onChange={(e) => handleStationChange(e.target.value as "BHR" | "MTR" | "HMD")}
                      className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-white font-mono"
                    >
                      <option value="BHR">Bharati Station (Larsemann Hills)</option>
                      <option value="MTR">Maitri Station (Schirmacher Oasis)</option>
                      <option value="HMD">Himadri Station (Ny-Ålesund, Arctic)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Reporting Commander</label>
                    <input
                      type="text"
                      required
                      value={commanderName}
                      onChange={(e) => setCommanderName(e.target.value)}
                      className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 font-mono">
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">Winter-Over Crew</label>
                    <input
                      type="number"
                      required
                      value={winterOver}
                      onChange={(e) => setWinterOver(parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">Summer Science</label>
                    <input
                      type="number"
                      required
                      value={summerScience}
                      onChange={(e) => setSummerScience(parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">Transient / Aircrew</label>
                    <input
                      type="number"
                      required
                      value={transientAircrew}
                      onChange={(e) => setTransientAircrew(parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 font-mono">
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">24h Fuel Burn (L)</label>
                    <input
                      type="number"
                      required
                      value={fuelConsumed}
                      onChange={(e) => setFuelConsumed(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">Generator Run (h)</label>
                    <input
                      type="number"
                      required
                      value={generatorHours}
                      onChange={(e) => setGeneratorHours(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">Outdoor Clearance</label>
                    <select
                      value={outdoorStatus}
                      onChange={(e) => setOutdoorStatus(e.target.value as OutdoorClearanceStatus)}
                      className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-white"
                    >
                      <option value="GREEN_NORMAL">GREEN: Normal</option>
                      <option value="YELLOW_RESTRICTED">YELLOW: Restricted</option>
                      <option value="RED_LOCKDOWN">RED: Lockdown</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Operational Remarks</label>
                  <textarea
                    rows={4}
                    required
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-white leading-relaxed"
                  />
                </div>

                <div className="rounded bg-slate-950 p-3 border border-slate-800 text-[11px] text-slate-400">
                  <strong className="text-cyan-400 block mb-0.5 font-mono">Cryptographic Document Integrity:</strong>
                  On submission, the report payload will be canonicalized and hashed via SHA-256. The digest will be committed to `daily_sitreps.integrity_hash` to detect any post-dispatch alteration.
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-cyan-500 px-4 py-2 font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
                  >
                    {submitting ? "Hashing & Committing..." : "Commit & Dispatch SITREP"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
