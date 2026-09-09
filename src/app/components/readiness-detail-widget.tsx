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
      title: "Station Power Redundancy (Heuristic)",
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
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs mb-8">
      {/* Title & Governance Disclaimer */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-800 border border-sky-200 font-mono">
              POLARIS MISSION READINESS AUDIT
            </span>
            <ProvenanceBadge tier={readiness.overallQualityStatus} size="xs" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            POLARIS Station Operational Readiness Score
          </h2>
          <p className="text-xs text-amber-800 font-medium mt-0.5">
            ⚠ {readiness.disclaimer}
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Readiness</span>
            <span className="text-xs font-bold text-slate-700">STATUS: {readiness.status}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black font-mono text-emerald-700">
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
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>{c.icon}</span> {c.title}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">Max {c.max}</span>
                </div>

                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-2xl font-black font-mono text-slate-900">
                    {c.score}{" "}
                    <span className="text-xs font-normal text-slate-500">/ {c.max}</span>
                  </span>
                  <span
                    className={`text-xs font-bold font-mono ${
                      pct >= 85 ? "text-emerald-700" : pct >= 60 ? "text-amber-700" : "text-rose-700"
                    }`}
                  >
                    {pct}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full transition-all ${
                      pct >= 85 ? "bg-emerald-600" : pct >= 60 ? "bg-amber-500" : "bg-rose-600"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-600">
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
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <span>🔍</span> Detailed Score Deductions &amp; Assessment Audit
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-sky-800 border border-slate-300">
            ASSESSMENT: HIGHEST-RISK STATION FACTORED
          </span>
        </div>

        <div className="space-y-2">
          {cats.flatMap((c) => (c.breakdown?.deductions || []).map((d, i) => (
            <div
              key={`${c.key}-${i}`}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"
            >
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-bold text-slate-900">[{c.title}]</span>
                  <span className="text-slate-700">{d.reason}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <span>Input Field: <code className="text-sky-700 font-mono">{d.inputField}</code></span>
                  <span>•</span>
                  <span>Methodology: {d.methodology}</span>
                  {d.triggeringStation && (
                    <>
                      <span>•</span>
                      <span className="text-amber-800 font-semibold">
                        Triggered by {d.triggeringStation} ({d.triggeringValue})
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <ProvenanceBadge tier={d.provenance} size="xs" />
                <span className="rounded bg-rose-50 border border-rose-300 px-2 py-0.5 font-mono font-bold text-rose-800 text-xs">
                  -{d.pointsDeducted} pts
                </span>
              </div>
            </div>
          )))}

          {cats.every((c) => (c.breakdown?.deductions?.length || 0) === 0) && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
              Zero deductions logged. All operational categories performing at nominal capacity.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
