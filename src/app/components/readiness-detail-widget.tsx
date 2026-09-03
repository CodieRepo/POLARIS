import React from "react";
import type { OperationalReadinessResult } from "@/core/readiness/operational-readiness";
import { ProvenanceBadge } from "./provenance-badge";

interface ReadinessModalBreakdownProps {
  readiness: OperationalReadinessResult;
}

export function ReadinessDetailWidget({ readiness }: ReadinessModalBreakdownProps) {
  const cats = [
    {
      key: "CRITICAL_ASSET_HEALTH",
      title: "Critical Asset Health",
      score: readiness.categoryScores.assetHealth,
      max: 35,
      weight: "35%",
      icon: "🚜",
      breakdown: readiness.categoryBreakdowns.CRITICAL_ASSET_HEALTH,
    },
    {
      key: "STATION_POWER_REDUNDANCY",
      title: "Station Power Redundancy",
      score: readiness.categoryScores.powerRedundancy,
      max: 25,
      weight: "25%",
      icon: "⚡",
      breakdown: readiness.categoryBreakdowns.STATION_POWER_REDUNDANCY,
    },
    {
      key: "MAINTENANCE_BACKLOG_HEALTH",
      title: "Maintenance Backlog Health",
      score: readiness.categoryScores.maintenanceHealth,
      max: 20,
      weight: "20%",
      icon: "🔧",
      breakdown: readiness.categoryBreakdowns.MAINTENANCE_BACKLOG_HEALTH,
    },
    {
      key: "ENVIRONMENTAL_HAZARD_SEVERITY",
      title: "Environmental Hazard Severity",
      score: readiness.categoryScores.environmentalRisk,
      max: 20,
      weight: "20%",
      icon: "❄",
      breakdown: readiness.categoryBreakdowns.ENVIRONMENTAL_HAZARD_SEVERITY,
    },
  ];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-lg mb-8">
      {/* Title & Governance Disclaimer */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-xs font-bold text-cyan-400 border border-cyan-500/40">
              POLARIS HEURISTIC ENGINE
            </span>
            <ProvenanceBadge tier={readiness.overallQualityStatus} size="xs" />
          </div>
          <h2 className="text-xl font-black text-white">
            POLARIS Operational Readiness Heuristic
          </h2>
          <p className="text-xs text-amber-400/90 font-medium mt-0.5">
            ⚠ {readiness.disclaimer}
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Readiness</span>
            <span className="text-xs font-bold text-slate-300">STATUS: {readiness.status}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black font-mono text-emerald-400">
              {readiness.score}
            </span>
            <span className="text-xs font-bold text-slate-500">/ 100</span>
          </div>
        </div>
      </div>

      {/* 4 Category Score Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cats.map((c) => {
          const pct = Math.round((c.score / c.max) * 100);
          return (
            <div
              key={c.key}
              className="rounded-xl border border-slate-800/90 bg-slate-950/80 p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <span>{c.icon}</span> {c.title}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">Max {c.max}</span>
                </div>

                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-2xl font-black font-mono text-white">
                    {c.score}{" "}
                    <span className="text-xs font-normal text-slate-500">/ {c.max}</span>
                  </span>
                  <span
                    className={`text-xs font-bold font-mono ${
                      pct >= 85 ? "text-emerald-400" : pct >= 60 ? "text-amber-400" : "text-rose-400"
                    }`}
                  >
                    {pct}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full transition-all ${
                      pct >= 85 ? "bg-emerald-400" : pct >= 60 ? "bg-amber-400" : "bg-rose-400"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Weight: {c.weight}</span>
                  <ProvenanceBadge tier={c.breakdown?.qualityStatus} size="xs" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Transparent Deduction & Audit Logs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <span>🔍</span> Explainable Deductions &amp; Environmental Aggregation Audit
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
            AGGREGATION: WORST_CASE_ACTIVE_STATION
          </span>
        </div>

        <div className="space-y-2">
          {cats.flatMap((c) => (c.breakdown?.deductions || []).map((d, i) => (
            <div
              key={`${c.key}-${i}`}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-slate-800/80 bg-slate-950/70 p-3 text-xs"
            >
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-bold text-slate-200">[{c.title}]</span>
                  <span className="text-slate-300">{d.reason}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span>Input Field: <code className="text-cyan-400">{d.inputField}</code></span>
                  <span>•</span>
                  <span>Methodology: {d.methodology}</span>
                  {d.triggeringStation && (
                    <>
                      <span>•</span>
                      <span className="text-amber-300 font-semibold">
                        Triggered by {d.triggeringStation} ({d.triggeringValue})
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <ProvenanceBadge tier={d.provenance} size="xs" />
                <span className="rounded bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 font-mono font-bold text-rose-400 text-xs">
                  -{d.pointsDeducted} pts
                </span>
              </div>
            </div>
          )))}

          {cats.every((c) => (c.breakdown?.deductions?.length || 0) === 0) && (
            <div className="rounded-lg border border-slate-800/80 bg-slate-950/50 p-4 text-center text-xs text-slate-500">
              Zero deductions logged. All operational categories performing at nominal capacity.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
