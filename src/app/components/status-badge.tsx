import React from "react";

interface StatusBadgeProps {
  status: string;
  type?: "asset" | "expedition" | "station" | "condition" | "criticality" | "classification" | "general";
  size?: "xs" | "sm";
}

export function StatusBadge({ status, size = "xs" }: StatusBadgeProps) {
  let colorClass = "bg-slate-800/80 text-slate-300 border-slate-700/60";
  const s = (status || "").toUpperCase();

  switch (s) {
    case "AVAILABLE":
    case "ACTIVE":
    case "EXCELLENT":
    case "LOW":
    case "NORMAL":
    case "HEALTHY":
    case "OPERATIONAL":
    case "OPTIMAL":
    case "AUTHORITATIVE_REAL":
      colorClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      break;
    case "ASSIGNED":
    case "IN_USE":
    case "PLANNED":
    case "GOOD":
    case "MEDIUM":
    case "EXTERNAL_REAL":
      colorClass = "bg-sky-500/10 text-sky-300 border-sky-500/30";
      break;
    case "MAINTENANCE":
    case "ATTENTION_REQUIRED":
    case "WATCH":
    case "RESUPPLY_REQUIRED":
    case "HIGH":
    case "DRAFT":
    case "SIMULATED":
      colorClass = "bg-amber-500/10 text-amber-300 border-amber-500/30";
      break;
    case "CRITICAL":
    case "DAMAGED":
    case "CANCELLED":
    case "RETIRED":
    case "HISTORICAL":
    case "POOR":
      colorClass = "bg-rose-500/10 text-rose-400 border-rose-500/30";
      break;
    case "COMPLETED":
    case "DERIVED":
      colorClass = "bg-indigo-500/10 text-indigo-300 border-indigo-500/30";
      break;
  }

  const sizeClass = size === "sm" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono font-bold uppercase tracking-wider ${sizeClass} ${colorClass}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.replace(/_/g, " ")}
    </span>
  );
}

