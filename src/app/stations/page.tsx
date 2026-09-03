import React from "react";
import Link from "next/link";
import { PolarisHeader } from "../components/polaris-header";
import { StatusBadge } from "../components/status-badge";
import { createServerClient } from "@/infrastructure/db/supabase-server";
import type { StationRow } from "@/core/station/station-repository";

export const dynamic = "force-dynamic";

export default async function ResearchStationsPage() {
  let stations: StationRow[] = [];
  try {
    const supabase = createServerClient();
    const { data } = await supabase.from("stations").select("*").order("code", { ascending: true });
    if (data) stations = data;
  } catch {
    // Fallback handled gracefully
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PolarisHeader currentPath="/stations" />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Polar Research Stations &amp; Field Observatories
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Master reference registry of Antarctic and Arctic permanent research facilities and field bases.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {stations.map((st) => (
            <div
              key={st.id}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-cyan-400 font-bold text-lg">{st.code}</span>
                    <span className="text-slate-400">•</span>
                    <h2 className="text-lg font-bold text-white">{st.name}</h2>
                  </div>
                  <StatusBadge status={st.status} type="station" />
                </div>

                <p className="text-xs text-slate-300 mb-4">{st.region} ({st.country})</p>

                <div className="grid grid-cols-3 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800/80 text-xs">
                  <div>
                    <span className="text-slate-500 block">Latitude</span>
                    <span className="font-mono font-semibold text-slate-200">{st.latitude}°</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Longitude</span>
                    <span className="font-mono font-semibold text-slate-200">{st.longitude}°</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Nominal Capacity</span>
                    <span className="font-semibold text-slate-200">{st.capacity} Personnel</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Elevation: {st.elevation_m || 0}m AMSL</span>
                <Link
                  href={`/assets?station_id=${st.id}`}
                  className="rounded bg-slate-800 px-3 py-1.5 font-semibold text-cyan-400 hover:bg-cyan-500 hover:text-slate-950 transition-colors"
                >
                  View Station Assets →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
