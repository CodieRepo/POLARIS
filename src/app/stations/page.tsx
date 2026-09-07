import React from "react";
import Link from "next/link";
import { PolarisHeader } from "../components/polaris-header";
import { StatusBadge } from "../components/status-badge";
import { HardwareTelemetryWidget } from "../components/hardware-telemetry-widget";
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

  const activeBases = stations.filter((s) => s.status === "ACTIVE").length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <PolarisHeader currentPath="/stations" />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 space-y-6">
        {/* Header Banner */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="rounded bg-sky-50 px-2 py-0.5 text-xs font-mono font-bold text-sky-700 border border-sky-200">
                  PERMANENT SCIENTIFIC BASES
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Antarctic &amp; Arctic Observatories
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                Polar Research Stations &amp; Observatories
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                National Centre for Polar &amp; Ocean Research master facility registry across Larsemann Hills, Schirmacher Oasis, and Ny-Ålesund.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center min-w-[110px] shadow-xs">
                <span className="text-[10px] font-mono text-slate-500 uppercase block font-bold">Active Bases</span>
                <span className="text-xl font-mono font-black text-emerald-700">{activeBases}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Station Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {stations.map((st) => (
            <div
              key={st.id}
              className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between hover:border-slate-300 transition-colors shadow-xs space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sky-700 font-bold text-base">{st.code}</span>
                      <span className="text-slate-300">•</span>
                      <h2 className="text-lg font-bold text-slate-900">{st.name}</h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono">{st.region} ({st.country})</p>
                  </div>
                  <StatusBadge status={st.status} type="station" />
                </div>

                {/* Geodetic Telemetry Block */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs font-mono mt-3">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Latitude</span>
                    <strong className="text-slate-800 text-xs mt-0.5 block">{st.latitude}° {st.latitude < 0 ? "S" : "N"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Longitude</span>
                    <strong className="text-slate-800 text-xs mt-0.5 block">{st.longitude}° {st.longitude < 0 ? "W" : "E"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Nominal Cap.</span>
                    <strong className="text-emerald-700 text-xs mt-0.5 block">{st.capacity} Pers</strong>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500 text-[11px]">Elevation: {st.elevation_m || 0}m AMSL</span>
                <Link
                  href={`/assets?station_id=${st.id}`}
                  className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-1.5 font-semibold text-sky-700 hover:bg-sky-600 hover:text-white transition-colors"
                >
                  View Station Assets →
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Hardware IoT & Edge Gateway Telemetry */}
        <div className="pt-4">
          <HardwareTelemetryWidget />
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 mt-12">
        POLARIS • National Centre for Polar &amp; Ocean Research (NCPOR) Management Foundation • SIH 2026
      </footer>
    </div>
  );
}

