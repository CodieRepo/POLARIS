import React from "react";
import Link from "next/link";
import { PolarisHeader } from "../components/polaris-header";
import { ProvenanceBadge } from "../components/provenance-badge";

export default function ProvenancePage() {
  const weatherTiers = [
    {
      tier: "AUTHORITATIVE_OBSERVED",
      title: "Direct In-Situ Physical Sensor Observations",
      source: "National Centre for Polar & Ocean Research (NCPOR) / Ministry of Earth Sciences, Govt. of India",
      sourceUrl: "https://data.ncpor.res.in",
      description:
        "Primary ground-truth telemetry gathered by automated weather stations (AWS) deployed directly at Bharati and Maitri bases in Antarctica (temperature, humidity, pressure, wind velocity) and Himadri in Ny-Ålesund, Svalbard (surface temperature, humidity, pressure).",
      badge: "AUTHORITATIVE_OBSERVED",
      freshnessPolicy: "Published observation records updated daily / periodically. Stored in high-speed in-memory cache (TTL: 15 min).",
    },
    {
      tier: "COMPOSITE_OBSERVED",
      title: "Field-Level Composite Observations",
      source: "NCPOR AWS Ground Sensors + Open-Meteo High-Resolution Model",
      sourceUrl: "https://data.ncpor.res.in",
      description:
        "Transparent multi-source telemetry where physical in-situ measurements (e.g. surface temperature and barometric pressure) are actively observed, while unmonitored sub-parameters (e.g. Svalbard anemometer calibration periods) are supplemented from verified numerical models.",
      badge: "COMPOSITE_OBSERVED",
      freshnessPolicy: "Ground observation timestamps preserved at individual field granularity.",
    },
    {
      tier: "VERIFIED_MODEL",
      title: "High-Resolution Polar Numerical Reanalysis & Forecasts",
      source: "Open-Meteo High-Resolution Polar Model (DWD ICON / NOAA GFS)",
      sourceUrl: "https://open-meteo.com",
      description:
        "Seamless numerical meteorological simulations providing 1.5 km to 11 km grid reanalysis. Used when direct physical satellite uplinks to Indian Arctic/Antarctic AWS stations experience scheduled maintenance or network outage.",
      badge: "VERIFIED_MODEL",
      freshnessPolicy: "Hourly numerical model runs.",
    },
    {
      tier: "OFFLINE_CLIMATIC_BASELINE",
      title: "Offline Climatic Seasonal Baselines",
      source: "Historical Antarctic Meteorological Records (NCPOR Monograph / WMO)",
      sourceUrl: "https://ncpor.res.in",
      description:
        "Climatological reference baselines derived from multi-decade observational means (e.g., September mean temperatures: Bharati -17.0°C, Maitri -16.5°C, Himadri -2.0°C). Active strictly during extreme cross-region network isolation.",
      badge: "OFFLINE_CLIMATIC_BASELINE",
      freshnessPolicy: "Static seasonal climatological baseline. Never misrepresented as real-time observations.",
    },
    {
      tier: "DERIVED",
      title: "Deterministic Mathematical Heuristics",
      source: "POLARIS Local Mathematical Algorithms",
      sourceUrl: "https://github.com/CodieRepo/POLARIS",
      description:
        "Locally calculated engineering and scientific metrics derived from authoritative physical inputs: Siple-Passel Antarctic Wind Chill Formula, Spencer (1971) Solar Ephemeris & 24h Trajectory, and the Category-Weighted Operational Readiness Heuristic.",
      badge: "DERIVED",
      freshnessPolicy: "Computed instantaneously in 0ms execution latency upon request.",
    },
    {
      tier: "DERIVED_SPATIAL",
      title: "Deterministic Geodesic Spatial Calculations",
      source: "POLARIS Local Spherical Geodesic Engine",
      sourceUrl: "https://github.com/CodieRepo/POLARIS",
      description:
        "Great-Circle Haversine distance, forward azimuth initial bearing (0–360°), and 16-point cardinal compass directions computed locally from station master coordinates. Zero external map APIs or paid routing services.",
      badge: "DERIVED_SPATIAL",
      freshnessPolicy: "Static mathematical derivation evaluated at 0ms latency upon render.",
    },
    {
      tier: "REFERENCE_GEOMETRY",
      title: "Simplified Polar Basemap Geometry",
      source: "POLARIS Cartographic Reference Geometry",
      sourceUrl: "https://github.com/CodieRepo/POLARIS",
      description:
        "Simplified vector representation of the Antarctic continental shelf and coastlines (Queen Maud Land, Enderby Land, Ross/Ronne Ice Shelves) projected in Polar Stereographic (-90° to -60° S). Rendered for contextual orientation; not ingested from live authoritative GIS services.",
      badge: "REFERENCE_GEOMETRY",
      freshnessPolicy: "Static cartographic reference geometry.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <PolarisHeader currentPath="/provenance" />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {/* Navigation Breadcrumb */}
        <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Link href="/" className="hover:text-sky-700 transition-colors">
              ← Command Dashboard
            </Link>
            <span>/</span>
            <span className="font-mono text-sky-700 font-bold">Data Provenance Charter</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            NCPOR Governance Standard
          </span>
        </div>

        {/* Header Summary */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 mb-8 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <span className="rounded bg-sky-50 px-2 py-0.5 text-xs font-mono font-bold text-sky-700 border border-sky-200">
              POLARIS GOVERNANCE PRINCIPLE
            </span>
            <span className="text-xs text-emerald-700 font-mono font-semibold">
              ● Zero Simulation Misrepresentation
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            Data Provenance, Source Hierarchy &amp; Freshness Policy
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-3xl leading-relaxed">
            POLARIS strictly separates physical in-situ observations from numerical models, emergency fallback baselines, and mathematical heuristics.
            Every metric surfaced in the command center preserves its source attribution, timestamp, and methodology.
          </p>
        </div>

        {/* Source Hierarchy Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {weatherTiers.map((t) => (
            <div
              key={t.tier}
              className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between shadow-xs hover:border-slate-300 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-sky-700 block mb-1">
                      TIER: {t.tier}
                    </span>
                    <h2 className="text-base font-bold text-slate-900 leading-snug">{t.title}</h2>
                  </div>
                  <ProvenanceBadge tier={t.badge} size="sm" />
                </div>

                <div className="mb-3 rounded-xl bg-slate-50 px-3.5 py-2.5 border border-slate-200/80 text-xs font-mono">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold mb-0.5">Authoritative Source:</span>
                  <a
                    href={t.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-700 hover:underline font-medium text-xs break-all"
                  >
                    {t.source} ↗
                  </a>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  {t.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-mono text-slate-500 flex items-center justify-between">
                <span className="font-semibold text-slate-500 uppercase text-[10px]">Freshness Protocol:</span>
                <span className="text-slate-700">{t.freshnessPolicy}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Governance Charter Box */}
        <div className="rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50/50 via-white to-sky-50/30 p-6 sm:p-8 shadow-xs">
          <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
            <span>🛡️</span> Non-Negotiable Polar Operational Grounding Principles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600 mt-5">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="font-bold text-sky-700 block mb-1 font-mono text-sm">1. Real &amp; Official Data First</span>
              <p className="leading-relaxed">Prioritize NCPOR, MoES, and Indian national polar records. Numerical models only supplement unmonitored fields.</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="font-bold text-sky-700 block mb-1 font-mono text-sm">2. Zero Paid Data Dependencies</span>
              <p className="leading-relaxed">100% public, free scientific infrastructure. Zero proprietary API keys or commercial weather vendors required.</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="font-bold text-sky-700 block mb-1 font-mono text-sm">3. Fully Explainable Heuristics</span>
              <p className="leading-relaxed">Operational readiness and environmental scores are mathematical heuristics for decision support, never certified SOP certifications.</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 mt-12 font-mono">
        POLARIS • National Centre for Polar &amp; Ocean Research (NCPOR) Management Foundation • SIH 2026
      </footer>
    </div>
  );
}

