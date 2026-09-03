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
  let label = tier || type || "UNKNOWN";
  let colorStyle = "bg-slate-800/80 text-slate-300 border-slate-700/60";

  if (type === "OBSERVED" || tier === "AUTHORITATIVE_OBSERVED") {
    label = "OBSERVED";
    colorStyle = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  } else if (tier === "COMPOSITE_OBSERVED") {
    label = "COMPOSITE OBSERVED";
    colorStyle = "bg-teal-500/10 text-teal-300 border-teal-500/30";
  } else if (type === "MODELLED" || tier === "VERIFIED_MODEL") {
    label = "MODELLED";
    colorStyle = "bg-cyan-500/10 text-cyan-300 border-cyan-500/30";
  } else if (type === "CACHED" || tier === "CACHED_OBSERVED") {
    label = "CACHED";
    colorStyle = "bg-amber-500/10 text-amber-300 border-amber-500/30";
  } else if (type === "BASELINE" || tier === "OFFLINE_CLIMATIC_BASELINE") {
    label = "BASELINE";
    colorStyle = "bg-purple-500/10 text-purple-300 border-purple-500/30";
  } else if (type === "DERIVED" || tier === "DERIVED") {
    label = "DERIVED HEURISTIC";
    colorStyle = "bg-indigo-500/10 text-indigo-300 border-indigo-500/30";
  } else if (type === "DERIVED_SPATIAL" || tier === "DERIVED_SPATIAL") {
    label = "DERIVED SPATIAL";
    colorStyle = "bg-indigo-500/10 text-indigo-300 border-indigo-500/30";
  } else if (type === "REFERENCE_GEOMETRY" || tier === "REFERENCE_GEOMETRY" || tier === "SIMPLIFIED_BASEMAP") {
    label = "REFERENCE GEOMETRY";
    colorStyle = "bg-slate-700/30 text-slate-300 border-slate-600/40";
  } else if (type === "HISTORICAL_REFERENCE" || tier === "HISTORICAL_REFERENCE") {
    label = "HISTORICAL REFERENCE";
    colorStyle = "bg-amber-500/10 text-amber-300 border-amber-500/30";
  }

  const textSizes = {
    xs: "text-[10px] px-1.5 py-0.5",
    sm: "text-xs px-2 py-0.5",
    md: "text-xs px-2.5 py-1 font-bold",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-mono font-bold uppercase tracking-wider border ${textSizes[size]} ${colorStyle}`}
    >
      {showDot && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
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
    label = "STALE DATA";
  } else if (health === "FALLBACK") {
    style = "bg-purple-500/10 text-purple-300 border-purple-500/30";
    dot = "bg-purple-400";
    label = "FALLBACK BASELINE";
  } else if (health === "DATA_UNAVAILABLE") {
    style = "bg-rose-500/10 text-rose-400 border-rose-500/30";
    dot = "bg-rose-400";
    label = "DATA UNAVAILABLE";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${style}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      HEALTH: {label}
    </span>
  );
}
