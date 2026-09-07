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
  let colorStyle = "bg-slate-100 text-slate-700 border-slate-300";
  let symbol = "●";

  const raw = (tier || type || "").toString().toUpperCase();

  if (raw === "OBSERVED" || raw === "AUTHORITATIVE_OBSERVED" || raw === "AUTHORITATIVE_REAL" || raw === "REAL") {
    label = "REAL IN-SITU";
    colorStyle = "bg-emerald-50 text-emerald-800 border-emerald-300";
    symbol = "●";
  } else if (raw === "COMPOSITE" || raw === "COMPOSITE_OBSERVED") {
    label = "COMPOSITE OBS";
    colorStyle = "bg-teal-50 text-teal-800 border-teal-300";
    symbol = "◈";
  } else if (raw === "MODELLED" || raw === "VERIFIED_MODEL" || raw === "EXTERNAL_REAL" || raw === "EXTERNAL") {
    label = "EXTERNAL MODEL";
    colorStyle = "bg-sky-50 text-sky-800 border-sky-300";
    symbol = "◇";
  } else if (raw === "CACHED" || raw === "CACHED_OBSERVED") {
    label = "CACHED";
    colorStyle = "bg-amber-50 text-amber-800 border-amber-300";
    symbol = "○";
  } else if (raw === "BASELINE" || raw === "OFFLINE_CLIMATIC_BASELINE") {
    label = "CLIMATIC BASELINE";
    colorStyle = "bg-purple-50 text-purple-800 border-purple-300";
    symbol = "◌";
  } else if (raw === "DERIVED" || raw === "DERIVED_HEURISTIC" || raw === "DERIVED_SPATIAL") {
    label = raw.includes("SPATIAL") ? "DERIVED SPATIAL" : "DERIVED HEURISTIC";
    colorStyle = "bg-violet-50 text-violet-800 border-violet-300";
    symbol = "ƒ(x)";
  } else if (raw === "SIMULATED") {
    label = "SIMULATED";
    colorStyle = "bg-amber-50 text-amber-800 border-amber-400 border-dashed";
    symbol = "◌";
  } else if (raw === "REFERENCE_GEOMETRY" || raw === "SIMPLIFIED_BASEMAP") {
    label = "REFERENCE GEOMETRY";
    colorStyle = "bg-slate-100 text-slate-700 border-slate-300";
    symbol = "◬";
  } else if (raw === "HISTORICAL_REFERENCE" || raw === "HISTORICAL") {
    label = "HISTORICAL";
    colorStyle = "bg-slate-100 text-slate-700 border-slate-300";
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
      {showDot && <span className="text-[10px] opacity-90">{symbol}</span>}
      {label}
    </span>
  );
}

interface SourceHealthIndicatorProps {
  health: "ONLINE" | "STALE" | "FALLBACK" | "DATA_UNAVAILABLE" | string;
}

export function SourceHealthIndicator({ health }: SourceHealthIndicatorProps) {
  let style = "bg-emerald-50 text-emerald-800 border-emerald-300";
  let dot = "bg-emerald-600";
  let label = "ONLINE";

  if (health === "STALE") {
    style = "bg-amber-50 text-amber-800 border-amber-300";
    dot = "bg-amber-500";
    label = "DATA DELAYED";
  } else if (health === "FALLBACK") {
    style = "bg-purple-50 text-purple-800 border-purple-300";
    dot = "bg-purple-600";
    label = "FALLBACK BASELINE";
  } else if (health === "DATA_UNAVAILABLE") {
    style = "bg-rose-50 text-rose-800 border-rose-300";
    dot = "bg-rose-600";
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

