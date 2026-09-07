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
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "YELLOW_RESTRICTED":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "RED_LOCKDOWN":
        return "bg-rose-50 text-rose-800 border-rose-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <PolarisHeader currentPath="/sitrep" />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {/* Navigation Breadcrumb */}
        <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Link href="/" className="hover:text-sky-700 transition-colors">
              ← Command Dashboard
            </Link>
            <span>/</span>
            <span className="font-mono text-sky-700 font-bold">Daily Station SITREPs</span>
          </div>
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-mono cursor-pointer transition-colors shadow-xs"
          >
            🖨️ Print / Export Form 104 PDF
          </button>
        </div>

        {/* Success Banner */}
        {successBanner && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs font-mono text-emerald-800 flex justify-between items-center shadow-xs">
            <span>✅ {successBanner}</span>
            <button
              onClick={() => setSuccessBanner(null)}
              className="text-emerald-800 hover:text-emerald-950 font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Header Summary */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 mb-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded bg-sky-50 px-2 py-0.5 text-xs font-mono font-bold text-sky-700 border border-sky-200">
                  COMNAP / MoES FORM 104
                </span>
                <span className="text-xs text-emerald-700 font-mono flex items-center gap-1 font-semibold">
                  ● PostgreSQL System of Record
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
                Station Commander Daily Situation Reports (SITREP)
              </h1>
              <p className="mt-2 text-sm text-slate-600 max-w-3xl leading-relaxed">
                Official daily operational dispatches recorded by Station Leaders to NCPOR Headquarters, Goa.
                Submissions are stored in PostgreSQL (<code className="text-sky-700 font-mono">daily_sitreps</code>) with a deterministic SHA-256 document integrity hash for tamper verification.
              </p>
            </div>

            {(!role || role !== "VIEWER") && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold text-white hover:bg-sky-700 transition-colors shadow-xs cursor-pointer whitespace-nowrap"
              >
                + File Daily SITREP
              </button>
            )}
          </div>
        </div>

        {/* SITREPs List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-wider font-bold text-slate-500">
              Persisted Official Dispatches ({sitreps.length})
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              Database: `public.daily_sitreps`
            </span>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm font-mono text-slate-500 shadow-xs">
              Loading dispatches from PostgreSQL...
            </div>
          ) : sitreps.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm font-mono text-slate-500 shadow-xs">
              No SITREPs recorded yet. Click &ldquo;+ File Daily SITREP&rdquo; to create the first dispatch.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {sitreps.map((doc) => {
                const verification = verificationMap[doc.id];
                return (
                  <div
                    key={doc.id}
                    className="rounded-xl border border-slate-200 bg-white p-6 hover:border-slate-300 transition-colors shadow-xs space-y-4"
                  >
                    {/* SITREP Card Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="rounded bg-sky-50 px-2 py-0.5 font-mono text-xs font-black text-sky-700 border border-sky-200">
                          {doc.stationCode}
                        </span>
                        <span className="text-base font-bold text-slate-900">
                          {doc.stationName}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          • Dispatch Date: <strong className="text-slate-800">{doc.reportDate}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border ${getStatusBadge(
                            doc.outdoorStatus
                          )}`}
                        >
                          CLEARANCE: {doc.outdoorStatus.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>

                    {/* Metrics Breakdown */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Reporting Commander</span>
                        <span className="text-slate-800 font-bold text-sm">{doc.commanderName}</span>
                      </div>

                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Personnel Headcount</span>
                        <span className="text-slate-900 font-bold text-sm tabular-nums">
                          {doc.headcount.total} <span className="text-xs font-normal text-slate-500">({doc.headcount.winterOver} WO / {doc.headcount.summerScience} Sci)</span>
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">24h Fuel Burned</span>
                        <span className="text-amber-800 font-bold text-sm tabular-nums">
                          {doc.fuelConsumed24hLiters} L <span className="text-xs font-normal text-slate-500">(Gen: {doc.generatorRuntimeHours}h)</span>
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">24h Weather Extremes</span>
                        <span className="text-sky-700 font-bold text-sm tabular-nums">
                          {doc.weatherSummary.minTemp24hC}°C to {doc.weatherSummary.maxTemp24hC}°C
                        </span>
                      </div>
                    </div>

                    {/* Operational Remarks */}
                    <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 text-xs leading-relaxed text-slate-700">
                      <strong className="text-sky-700 block mb-1 font-mono uppercase text-[10px]">
                        Commander Operational Dispatch Remarks:
                      </strong>
                      {doc.operationalRemarks}
                    </div>

                    {/* Cryptographic Document Integrity Hash Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] font-mono text-slate-500 pt-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 rounded-xl border border-slate-200/70">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-slate-500 uppercase text-[10px] font-bold">Document Integrity (SHA-256):</span>
                          <span className="text-sky-800 font-mono break-all font-semibold">{doc.integrityHash}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Signer: {doc.signerIdentity} • Timestamp: {doc.signedOffAt}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {verification ? (
                          <span
                            className={`px-3 py-1 rounded-lg text-xs font-bold font-mono border ${
                              verification.isValid
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-rose-50 text-rose-800 border-rose-200"
                            }`}
                          >
                            {verification.isValid ? "✓ SHA-256 VERIFIED" : "✕ HASH MISMATCH"}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleVerifyIntegrity(doc.id)}
                            disabled={verifyingId === doc.id}
                            className="px-3 py-1.5 rounded-lg bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-bold font-mono border border-slate-300 cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    File Official Daily SITREP
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    Persisted with SHA-256 canonical hash to `daily_sitreps`
                  </span>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 mb-1 font-semibold">Research Station</label>
                    <select
                      value={selectedStation}
                      onChange={(e) => handleStationChange(e.target.value as "BHR" | "MTR" | "HMD")}
                      className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-slate-900 font-mono focus:border-sky-500 focus:outline-none"
                    >
                      <option value="BHR">Bharati Station (Larsemann Hills)</option>
                      <option value="MTR">Maitri Station (Schirmacher Oasis)</option>
                      <option value="HMD">Himadri Station (Ny-Ålesund, Arctic)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1 font-semibold">Reporting Commander</label>
                    <input
                      type="text"
                      required
                      value={commanderName}
                      onChange={(e) => setCommanderName(e.target.value)}
                      className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-500 focus:outline-none font-sans"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 font-mono">
                  <div>
                    <label className="block text-slate-700 mb-1 text-[11px]">Winter-Over Crew</label>
                    <input
                      type="number"
                      required
                      value={winterOver}
                      onChange={(e) => setWinterOver(parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-1 text-[11px]">Summer Science</label>
                    <input
                      type="number"
                      required
                      value={summerScience}
                      onChange={(e) => setSummerScience(parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-1 text-[11px]">Transient / Aircrew</label>
                    <input
                      type="number"
                      required
                      value={transientAircrew}
                      onChange={(e) => setTransientAircrew(parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 font-mono">
                  <div>
                    <label className="block text-slate-700 mb-1 text-[11px]">24h Fuel Burn (L)</label>
                    <input
                      type="number"
                      required
                      value={fuelConsumed}
                      onChange={(e) => setFuelConsumed(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-1 text-[11px]">Generator Run (h)</label>
                    <input
                      type="number"
                      required
                      value={generatorHours}
                      onChange={(e) => setGeneratorHours(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-1 text-[11px]">Outdoor Clearance</label>
                    <select
                      value={outdoorStatus}
                      onChange={(e) => setOutdoorStatus(e.target.value as OutdoorClearanceStatus)}
                      className="w-full rounded-lg bg-white border border-slate-300 px-2 py-2 text-slate-900 focus:border-sky-500 focus:outline-none"
                    >
                      <option value="GREEN_NORMAL">GREEN: Normal</option>
                      <option value="YELLOW_RESTRICTED">YELLOW: Restricted</option>
                      <option value="RED_LOCKDOWN">RED: Lockdown</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-semibold">Operational Remarks</label>
                  <textarea
                    rows={4}
                    required
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-slate-900 leading-relaxed focus:border-sky-500 focus:outline-none font-sans"
                  />
                </div>

                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-[11px] text-slate-600">
                  <strong className="text-sky-700 block mb-0.5 font-mono">Cryptographic Document Integrity:</strong>
                  On submission, the report payload will be canonicalized and hashed via SHA-256. The digest will be committed to `daily_sitreps.integrity_hash` to detect any post-dispatch alteration.
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-lg bg-white border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-sky-600 px-5 py-2 font-bold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {submitting ? "Hashing & Committing..." : "Commit & Dispatch SITREP"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 mt-12">
        POLARIS • National Centre for Polar &amp; Ocean Research (NCPOR) Management Foundation • SIH 2026
      </footer>
    </div>
  );
}
