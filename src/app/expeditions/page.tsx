import React from "react";
import Link from "next/link";
import { PolarisHeader } from "../components/polaris-header";
import { StatusBadge } from "../components/status-badge";
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PolarisHeader currentPath="/expeditions" />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Polar Expeditions &amp; Field Operations
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Lifecycle coordination and personnel roster tracking across scientific campaigns.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {expeditions.map((exp) => (
            <div
              key={exp.id}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-6"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-cyan-400 font-bold text-lg">{exp.code}</span>
                    <h2 className="text-lg font-bold text-white">{exp.name}</h2>
                    <StatusBadge status={exp.status} type="expedition" />
                  </div>
                  <p className="mt-1 text-xs text-slate-300 max-w-3xl">{exp.description}</p>
                </div>
                <div>
                  <StatusBadge status={exp.data_classification} type="classification" />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-lg border border-slate-800/80 text-xs">
                <div>
                  <span className="text-slate-500 block">Origin Base</span>
                  <span className="font-medium text-slate-200">
                    {exp.origin_station_id
                      ? stationMap.get(exp.origin_station_id) || "Direct Departure"
                      : "Direct Departure"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Destination Node</span>
                  <span className="font-medium text-slate-200">
                    {stationMap.get(exp.destination_station_id) || "Field Camp"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Planned Window</span>
                  <span className="text-slate-200">
                    {new Date(exp.planned_start_at).toLocaleDateString()} →{" "}
                    {new Date(exp.planned_end_at).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Actual Start</span>
                  <span className="text-slate-200">
                    {exp.actual_start_at
                      ? new Date(exp.actual_start_at).toLocaleDateString()
                      : "Pending Field Deployment"}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Link
                  href={`/expeditions/${exp.code}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300"
                >
                  View Mission Roster &amp; Assigned Gear →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
