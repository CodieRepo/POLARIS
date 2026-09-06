"use client";

import React, { useState } from "react";
import type { OperationalAlert } from "@/core/alerts/types";

interface OperationalAlertBannerProps {
  readonly alerts: readonly OperationalAlert[];
}

export function OperationalAlertBanner({ alerts: initialAlerts }: OperationalAlertBannerProps) {
  const [alerts, setAlerts] = useState<readonly OperationalAlert[]>(initialAlerts);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [actingId, setActingId] = useState<string | null>(null);

  if (!alerts || alerts.length === 0) return null;

  const activeCount = alerts.filter((a) => a.status === "ACTIVE").length;
  const highestSeverity = alerts.some((a) => a.severity === "CRITICAL")
    ? "CRITICAL"
    : alerts.some((a) => a.severity === "WARNING")
    ? "WARNING"
    : "WATCH";

  const getSeverityStyle = (s: string) => {
    switch (s) {
      case "CRITICAL":
        return "bg-rose-950/60 border-rose-500/50 text-rose-300";
      case "WARNING":
        return "bg-amber-950/60 border-amber-500/50 text-amber-300";
      case "WATCH":
        return "bg-cyan-950/60 border-cyan-500/40 text-cyan-300";
      default:
        return "bg-slate-900/60 border-slate-700 text-slate-300";
    }
  };

  const getBadgeStyle = (s: string) => {
    switch (s) {
      case "CRITICAL":
        return "bg-rose-500 text-slate-950 font-black";
      case "WARNING":
        return "bg-amber-500 text-slate-950 font-black";
      case "WATCH":
        return "bg-cyan-500 text-slate-950 font-black";
      default:
        return "bg-slate-800 text-slate-300";
    }
  };

  const handleAcknowledge = async (id: string) => {
    setActingId(id);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "ACKNOWLEDGE" }),
      });
      const json = await res.json();
      if (json.success && json.alerts) {
        setAlerts(json.alerts);
      } else {
        setAlerts((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: "ACKNOWLEDGED" as const } : a))
        );
      }
    } catch {
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "ACKNOWLEDGED" as const } : a))
      );
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${getBadgeStyle(
              highestSeverity
            )}`}
          >
            {highestSeverity} ALERT ({activeCount})
          </span>
          <span className="text-xs font-mono text-slate-300 font-bold truncate max-w-xl">
            {alerts[0].title} — <span className="font-normal text-slate-400">{alerts[0].stationCode}: {alerts[0].details}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-mono">
          <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
            PostgreSQL: `public.operational_alerts`
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-cyan-400 hover:text-cyan-300 underline font-semibold cursor-pointer"
          >
            {expanded ? "Hide Alert Drawer" : `View All (${alerts.length})`}
          </button>
        </div>
      </div>

      {/* Expanded Alert Drawer */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2.5">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-lg border p-3 text-xs font-mono flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${getSeverityStyle(
                alert.severity
              )}`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white uppercase tracking-wider">
                    [{alert.stationCode}] {alert.title}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Category: {alert.category}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300 font-sans">
                  {alert.details}
                </p>
                <span className="text-[10px] text-slate-500 block">
                  Triggered: {new Date(alert.triggeredAt).toUTCString()}
                </span>
              </div>

              {alert.status === "ACTIVE" ? (
                <button
                  onClick={() => handleAcknowledge(alert.id)}
                  disabled={actingId === alert.id}
                  className="rounded bg-slate-950 border border-slate-800 px-3 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  {actingId === alert.id ? "Updating..." : "Acknowledge"}
                </button>
              ) : (
                <span className="text-[10px] text-emerald-400 font-bold uppercase">
                  ✓ Acknowledged in DB
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
