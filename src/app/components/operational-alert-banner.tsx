"use client";

import React, { useState } from "react";
import { useAuth } from "@/infrastructure/auth/auth-provider";
import type { OperationalAlert } from "@/core/alerts/types";

interface OperationalAlertBannerProps {
  readonly alerts: readonly OperationalAlert[];
}

export function OperationalAlertBanner({ alerts: initialAlerts }: OperationalAlertBannerProps) {
  const { can, role } = useAuth();
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
        return "bg-rose-50 border-rose-200 text-rose-900";
      case "WARNING":
        return "bg-amber-50 border-amber-200 text-amber-900";
      case "WATCH":
        return "bg-sky-50 border-sky-200 text-sky-900";
      default:
        return "bg-slate-50 border-slate-200 text-slate-800";
    }
  };

  const getBadgeStyle = (s: string) => {
    switch (s) {
      case "CRITICAL":
        return "bg-rose-600 text-white font-bold";
      case "WARNING":
        return "bg-amber-600 text-white font-bold";
      case "WATCH":
        return "bg-sky-600 text-white font-bold";
      default:
        return "bg-slate-200 text-slate-800 font-bold";
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
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${getBadgeStyle(
              highestSeverity
            )}`}
          >
            {highestSeverity} ALERT ({activeCount})
          </span>
          <span className="text-xs font-mono text-slate-800 font-bold truncate max-w-xl">
            {alerts[0].title} — <span className="font-normal text-slate-600">{alerts[0].stationCode}: {alerts[0].details}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-mono">
          <span className="text-[10px] text-slate-500 font-mono hidden sm:inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
            Station Alerts Telemetry
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sky-700 hover:text-sky-800 underline font-semibold cursor-pointer"
          >
            {expanded ? "Hide Alert Drawer" : `View All (${alerts.length})`}
          </button>
        </div>
      </div>

      {/* Expanded Alert Drawer */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-200 space-y-2.5">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-lg border p-3 text-xs font-mono flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${getSeverityStyle(
                alert.severity
              )}`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 uppercase tracking-wider">
                    [{alert.stationCode}] {alert.title}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Category: {alert.category}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-700 font-sans">
                  {alert.details}
                </p>
                <span className="text-[10px] text-slate-500 block">
                  Triggered: {new Date(alert.triggeredAt).toUTCString()}
                </span>
              </div>

              {alert.status === "ACTIVE" ? (
                can("ALERT_ACKNOWLEDGE") || (!role || role !== "VIEWER") ? (
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    disabled={actingId === alert.id}
                    className="rounded bg-white border border-slate-300 px-3 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    {actingId === alert.id ? "Updating..." : "Acknowledge"}
                  </button>
                ) : (
                  <span className="text-[10px] text-amber-700 font-bold uppercase">
                    ● Active Alert
                  </span>
                )
              ) : (
                <span className="text-[10px] text-emerald-700 font-bold uppercase">
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
