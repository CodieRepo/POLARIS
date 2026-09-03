import React from "react";
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
        "Primary ground-truth telemetry gathered by automated weather stations (AWS) deployed directly at Bharati and Maitri bases in Antarctica and Himadri in Ny-Ålesund, Svalbard. Includes measured surface temperature, relative humidity, pressure, and wind sensors.",
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
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PolarisHeader currentPath="/provenance" />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-xs font-bold text-cyan-400 border border-cyan-500/40">
              POLARIS GOVERNANCE PRINCIPLE
            </span>
            <span className="text-xs text-slate-400">Zero Simulation Misrepresentation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Data Provenance, Source Hierarchy &amp; Freshness Policy
          </h1>
          <p className="mt-2 text-sm text-slate-300 max-w-3xl leading-relaxed">
            POLARIS strictly separates physical in-situ observations from numerical models, emergency fallback baselines, and mathematical heuristics.
            Every metric surfaced in the command center preserves its source attribution, timestamp, and methodology.
          </p>
        </div>

        {/* Source Hierarchy Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {weatherTiers.map((t) => (
            <div
              key={t.tier}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col justify-between shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-cyan-400 block mb-0.5">
                      TIER: {t.tier}
                    </span>
                    <h2 className="text-lg font-bold text-white">{t.title}</h2>
                  </div>
                  <ProvenanceBadge tier={t.badge} size="sm" />
                </div>

                <div className="mb-3 rounded bg-slate-950 px-3 py-2 border border-slate-800 text-xs">
                  <span className="text-slate-500 block font-semibold">Authoritative Source:</span>
                  <a
                    href={t.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline font-medium"
                  >
                    {t.source} ↗
                  </a>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  {t.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span className="font-semibold text-slate-500">Freshness Protocol:</span>
                <span className="text-slate-300">{t.freshnessPolicy}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Governance Charter Box */}
        <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/30 p-6 sm:p-8 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-2">
            Non-Negotiable Polar Operational Grounding Principles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300 mt-4">
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
              <span className="font-bold text-cyan-400 block mb-1">1. Real &amp; Official Data First</span>
              Prioritize NCPOR, MoES, and Indian national polar records. Numerical models only supplement unmonitored fields.
            </div>
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
              <span className="font-bold text-cyan-400 block mb-1">2. Zero Paid Data Dependencies</span>
              100% public, free scientific infrastructure. Zero proprietary API keys or commercial weather vendors required.
            </div>
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
              <span className="font-bold text-cyan-400 block mb-1">3. Fully Explainable Decision Support</span>
              Operational readiness and environmental scores are mathematical heuristics for decision support, never certified SOP certifications.
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500 mt-12">
        POLARIS • National Centre for Polar &amp; Ocean Research (NCPOR) Management Foundation • SIH 2026
      </footer>
    </div>
  );
}
