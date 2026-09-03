import React from "react";
import { PolarisHeader } from "../components/polaris-header";
import { StatusBadge } from "../components/status-badge";

export default function ProvenancePage() {
  const tiers = [
    {
      name: "AUTHORITATIVE_REAL",
      title: "Authoritative Polar Operational Data",
      description: "Direct reference coordinates and station specifications from national polar registries (NCPOR, Ministry of Earth Sciences India). Includes Bharati, Maitri, and Himadri station parameters.",
      badge: "AUTHORITATIVE_REAL",
      examples: ["Station Geodetic Coordinates (WGS84)", "Antarctic Facility Capacity", "44th ISEA Official Record"],
    },
    {
      name: "EXTERNAL_REAL",
      title: "External Scientific Feeds & Reanalysis",
      description: "Real-time or archived global scientific feeds from verified international scientific bodies (Copernicus ERA5, NSIDC, ECMWF).",
      badge: "EXTERNAL_REAL",
      examples: ["Copernicus ERA5 Atmospheric Data", "NSIDC Sea Ice Index", "OpenStreetMap Polar Basemaps"],
    },
    {
      name: "SIMULATED",
      title: "Simulated Operational Telemetry",
      description: "Synthetic operational logs, mock radar telemetry, and simulated expedition traverse scenarios used for system testing and demonstration validation without corrupting official archives.",
      badge: "SIMULATED",
      examples: ["Ice Radar Sounding Logs (pulseEKKO)", "Sub-Zero Degradation Curves", "Traverse Waypoint Sim"],
    },
    {
      name: "DERIVED",
      title: "Derived System Intelligence",
      description: "Analytical scores, computed sub-zero degradation metrics, and aggregations calculated deterministically by POLARIS domain algorithms.",
      badge: "DERIVED",
      examples: ["Operational Risk Readiness Scores", "Asset Criticality Assessment", "Maintenance Countdown Metrics"],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PolarisHeader currentPath="/provenance" />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Data Provenance &amp; Classification Framework
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            POLARIS strictly enforces data transparency. Every operational entity and asset is tagged with its authoritative data tier.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-white">{tier.title}</h2>
                  <StatusBadge status={tier.badge} type="classification" />
                </div>
                <p className="text-xs text-slate-300 mb-4">{tier.description}</p>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
                  <span className="text-slate-500 font-semibold block mb-1">
                    Applicable Data Types:
                  </span>
                  <ul className="list-disc list-inside text-slate-400 space-y-0.5">
                    {tier.examples.map((ex) => (
                      <li key={ex}>{ex}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
