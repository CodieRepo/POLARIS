import React from "react";
import Link from "next/link";
import { PolarisHeader } from "../components/polaris-header";
import { StatusBadge } from "../components/status-badge";
import { ProvenanceBadge } from "../components/provenance-badge";
import { createServerClient } from "@/infrastructure/db/supabase-server";
import type { ExpeditionRow } from "@/modules/expedition/types/expedition.types";
import type { StationRow } from "@/core/station/station-repository";

export const dynamic = "force-dynamic";

export default async function ExpeditionsPage() {
  let expeditions: ExpeditionRow[] = [];
  let stations: StationRow[] = [];

  try {
    const supabase = createServerClient();
    const [expRes, stRes] = await Promise.all([
      supabase.from("expeditions").select("*").order("code", { ascending: true }),
      supabase.from("stations").select("*"),
    ]);

    if (expRes.data) expeditions = expRes.data;
    if (stRes.data) stations = stRes.data;
  } catch {
    // Graceful fallback
  }

  const stationMap = new Map(stations.map((s) => [s.id, `${s.name} (${s.code})`]));
  const activeCount = expeditions.filter((e) => e.status === "ACTIVE").length;
  const plannedCount = expeditions.filter((e) => e.status === "PLANNED").length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <PolarisHeader currentPath="/expeditions" />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 space-y-6">
        {/* Header Banner */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="rounded bg-sky-50 px-2 py-0.5 text-xs font-mono font-bold text-sky-700 border border-sky-200">
                  FIELD CAMPAIGN ROSTER
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Indian Scientific Expeditions to Antarctica &amp; Arctic
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                Polar Expeditions &amp; Field Missions
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                Strategic coordination, personnel rosters, and field asset allocations across active campaigns.
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center min-w-[100px] shadow-xs">
                <span className="text-[10px] font-mono text-slate-500 uppercase block font-bold">Active</span>
                <span className="text-xl font-mono font-black text-emerald-700">{activeCount}</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center min-w-[100px] shadow-xs">
                <span className="text-[10px] font-mono text-slate-500 uppercase block font-bold">Planned</span>
                <span className="text-xl font-mono font-black text-sky-700">{plannedCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Expeditions Cards List */}
        {expeditions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
            <span className="text-3xl mb-2 block">🧭</span>
            <h3 className="text-base font-bold text-slate-900">No Expeditions Logged</h3>
            <p className="text-xs text-slate-500 mt-1">
              No active or planned polar campaigns found in the PostgreSQL system of record.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            {expeditions.map((exp) => (
              <div
                key={exp.id}
                className="rounded-xl border border-slate-200 bg-white p-6 hover:border-slate-300 transition-colors shadow-xs space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-sky-700 font-bold text-lg">
                        {exp.code}
                      </span>
                      <h2 className="text-lg font-bold text-slate-900">{exp.name}</h2>
                      <StatusBadge status={exp.status} type="expedition" />
                      <ProvenanceBadge tier={exp.data_classification} size="xs" />
                    </div>
                    <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
                      {exp.description || "Operational field research and logistical campaign in polar sector."}
                    </p>
                  </div>

                  <div className="shrink-0">
                    <Link
                      href={`/expeditions/${exp.code}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 border border-sky-200 px-3.5 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-600 hover:text-white transition-colors"
                    >
                      Mission Detail &amp; Roster →
                    </Link>
                  </div>
                </div>

                {/* Waypoints & Campaign Window Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Origin Staging Node</span>
                    <strong className="text-slate-800 text-xs mt-0.5 block truncate">
                      {exp.origin_station_id
                        ? stationMap.get(exp.origin_station_id) || "Direct Departure"
                        : "Direct Departure"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Destination Sector</span>
                    <strong className="text-slate-800 text-xs mt-0.5 block truncate">
                      {stationMap.get(exp.destination_station_id) || "Field Traverse Sector"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Planned Window</span>
                    <span className="text-slate-700 text-xs mt-0.5 block">
                      {new Date(exp.planned_start_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} →{" "}
                      {new Date(exp.planned_end_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Operational Phase</span>
                    <span className="text-emerald-700 text-xs mt-0.5 block font-bold">
                      {exp.status === "ACTIVE" ? "STATION OPERATIONS" : exp.status === "PLANNED" ? "MOBILIZATION" : "DRAFT STAGE"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 mt-12">
        POLARIS • National Centre for Polar &amp; Ocean Research (NCPOR) Management Foundation • SIH 2026
      </footer>
    </div>
  );
}

