import React from "react";
import type { WeatherProvenanceTier, MeasurementType } from "@/core/weather/types";

interface ProvenanceBadgeProps {
  tier?: WeatherProvenanceTier | string;
  type?: MeasurementType | string;
  size?: "xs" | "sm" | "md";
  showDot?: boolean;
}

export function ProvenanceBadge({
  tier,
  type,
  size = "xs",
  showDot = true,
}: ProvenanceBadgeProps) {
  let label = tier || type || "INTERNAL";
  let colorStyle = "bg-slate-800/80 text-slate-300 border-slate-700/60";
  let symbol = "●";

  const raw = (tier || type || "").toString().toUpperCase();

  if (raw === "OBSERVED" || raw === "AUTHORITATIVE_OBSERVED" || raw === "AUTHORITATIVE_REAL" || raw === "REAL") {
    label = "REAL IN-SITU";
    colorStyle = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    symbol = "●";
  } else if (raw === "COMPOSITE" || raw === "COMPOSITE_OBSERVED") {
    label = "COMPOSITE OBS";
    colorStyle = "bg-teal-500/10 text-teal-300 border-teal-500/30";
    symbol = "◐";
  } else if (raw === "MODELLED" || raw === "VERIFIED_MODEL" || raw === "EXTERNAL_REAL" || raw === "EXTERNAL") {
    label = "EXTERNAL MODEL";
    colorStyle = "bg-sky-500/10 text-sky-300 border-sky-500/30";
    symbol = "●";
  } else if (raw === "CACHED" || raw === "CACHED_OBSERVED") {
    label = "CACHED";
    colorStyle = "bg-amber-500/10 text-amber-300 border-amber-500/30";
    symbol = "○";
  } else if (raw === "BASELINE" || raw === "OFFLINE_CLIMATIC_BASELINE") {
    label = "CLIMATIC BASELINE";
    colorStyle = "bg-purple-500/10 text-purple-300 border-purple-500/30";
    symbol = "◌";
  } else if (raw === "DERIVED" || raw === "DERIVED_HEURISTIC" || raw === "DERIVED_SPATIAL") {
    label = raw.includes("SPATIAL") ? "DERIVED SPATIAL" : "DERIVED HEURISTIC";
    colorStyle = "bg-indigo-500/10 text-indigo-300 border-indigo-500/30";
    symbol = "◆";
  } else if (raw === "SIMULATED") {
    label = "SIMULATED";
    colorStyle = "bg-amber-500/10 text-amber-300 border-amber-500/30";
    symbol = "◌";
  } else if (raw === "REFERENCE_GEOMETRY" || raw === "SIMPLIFIED_BASEMAP") {
    label = "REFERENCE GEOMETRY";
    colorStyle = "bg-slate-700/30 text-slate-300 border-slate-600/40";
    symbol = "◬";
  } else if (raw === "HISTORICAL_REFERENCE" || raw === "HISTORICAL") {
    label = "HISTORICAL";
    colorStyle = "bg-amber-500/10 text-amber-300 border-amber-500/30";
    symbol = "◷";
  }

  const textSizes = {
    xs: "text-[10px] px-1.5 py-0.5",
    sm: "text-xs px-2 py-0.5",
    md: "text-xs px-2.5 py-1 font-bold",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-mono font-bold uppercase tracking-wider border ${textSizes[size]} ${colorStyle}`}
      title={`Data Provenance Class: ${label}`}
    >
      {showDot && <span className="text-[10px] opacity-80">{symbol}</span>}
      {label}
    </span>
  );
}

interface SourceHealthIndicatorProps {
  health: "ONLINE" | "STALE" | "FALLBACK" | "DATA_UNAVAILABLE" | string;
}

export function SourceHealthIndicator({ health }: SourceHealthIndicatorProps) {
  let style = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  let dot = "bg-emerald-400";
  let label = "ONLINE";

  if (health === "STALE") {
    style = "bg-amber-500/10 text-amber-400 border-amber-500/30";
    dot = "bg-amber-400";
    label = "DATA DELAYED";
  } else if (health === "FALLBACK") {
    style = "bg-purple-500/10 text-purple-300 border-purple-500/30";
    dot = "bg-purple-400";
    label = "FALLBACK BASELINE";
  } else if (health === "DATA_UNAVAILABLE") {
    style = "bg-rose-500/10 text-rose-400 border-rose-500/30";
    dot = "bg-rose-400";
    label = "UNAVAILABLE";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wider ${style}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      SOURCE: {label}
    </span>
  );
}

