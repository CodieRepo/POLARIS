"use client";

import React, { useState } from "react";
import { DataProvenanceModal } from "./data-provenance-modal";

export function DataProvenanceBanner() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        {/* Banner Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span>🛰️</span> Data Origin &amp; Provenance Classification
              </span>
              <span className="rounded bg-sky-50 px-2 py-0.5 text-[10px] font-mono text-sky-800 border border-sky-200">
                MoES / NCPOR Transparency Standard
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              POLARIS separates live ground telemetry from historical records, operational simulations, and mathematical metrics.
            </p>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 border border-sky-200 px-3 py-1.5 text-xs font-bold text-sky-800 hover:bg-sky-600 hover:text-white transition-all cursor-pointer shadow-xs self-start sm:self-auto shrink-0"
          >
            <span>🔍</span>
            <span>How Data Works (Origin Matrix)</span>
          </button>
        </div>

        {/* 4 Provenance Stream Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* 1. NEAR-REAL-TIME */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-emerald-900">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                NEAR-REAL-TIME OBSERVATIONS
              </span>
              <span className="text-[10px] font-mono text-emerald-800 font-semibold bg-emerald-100/70 px-1.5 py-0.5 rounded">
                OBSERVED
              </span>
            </div>
            <p className="text-xs text-slate-800 font-semibold">
              Ground AWS Sensors (on-demand fetch)
            </p>
            <p className="text-[11px] text-slate-600 leading-snug">
              Physical temperature, pressure, wind velocity from Bharati, Maitri, Himadri AWS stations.
            </p>
            <span className="text-[10px] font-mono text-emerald-800 block pt-1 border-t border-emerald-200/60">
              Pipeline: Server-side fetch → 15 min in-memory cache
            </span>
          </div>

          {/* 2. PAST DATA */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-900">
                <span className="h-2 w-2 rounded-full bg-slate-600" />
                HISTORICAL DATA
              </span>
              <span className="text-[10px] font-mono text-slate-700 font-semibold bg-slate-200/70 px-1.5 py-0.5 rounded">
                ARCHIVED
              </span>
            </div>
            <p className="text-xs text-slate-800 font-semibold">
              24h Sensor History &amp; Dakshin Gangotri
            </p>
            <p className="text-[11px] text-slate-600 leading-snug">
              24h barometric pressure history, Dakshin Gangotri base records (1983–1990), and SHA-256 cryptographically sealed SITREPs.
            </p>
            <span className="text-[10px] font-mono text-slate-600 block pt-1 border-t border-slate-200">
              Pipeline: NCPOR Mission Archives
            </span>
          </div>

          {/* 3. SIMULATED */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-amber-900">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                OPERATIONAL SIMULATION
              </span>
              <span className="text-[10px] font-mono text-amber-800 font-semibold bg-amber-100/70 px-1.5 py-0.5 rounded">
                SCENARIO
              </span>
            </div>
            <p className="text-xs text-slate-800 font-semibold">
              Resupply Vessel &amp; Cargo Staging
            </p>
            <p className="text-[11px] text-slate-600 leading-snug">
              MV Vasiliy Golovnin maritime voyage route and 20ft container tracking through 5 supply chain transit stages.
            </p>
            <span className="text-[10px] font-mono text-amber-800 block pt-1 border-t border-amber-200/60">
              Pipeline: 44th ISEA Resupply Model
            </span>
          </div>

          {/* 4. CALCULATED */}
          <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-purple-900">
                <span className="h-2 w-2 rounded-full bg-purple-600" />
                CALCULATED METRICS
              </span>
              <span className="text-[10px] font-mono text-purple-800 font-semibold bg-purple-100/70 px-1.5 py-0.5 rounded">
                ALGORITHMIC
              </span>
            </div>
            <p className="text-xs text-slate-800 font-semibold">
              Fuel Autonomy &amp; Readiness Score
            </p>
            <p className="text-[11px] text-slate-600 leading-snug">
              Autonomy days (Tank Level ÷ Daily Burn Rate), Station Readiness (88/100, 4-pillar evaluation), and Wind Chill factor.
            </p>
            <span className="text-[10px] font-mono text-purple-800 block pt-1 border-t border-purple-200/60">
              Pipeline: Deterministic Local Math
            </span>
          </div>
        </div>
      </div>

      {/* Modal */}
      <DataProvenanceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
