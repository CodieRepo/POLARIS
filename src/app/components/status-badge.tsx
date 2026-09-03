import React from "react";

interface StatusBadgeProps {
  status: string;
  type?: "asset" | "expedition" | "station" | "condition" | "criticality" | "classification";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  let colorClass = "bg-slate-800 text-slate-300 border-slate-700";

  switch (status) {
    case "AVAILABLE":
    case "ACTIVE":
    case "EXCELLENT":
    case "LOW":
    case "AUTHORITATIVE_REAL":
      colorClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      break;
    case "ASSIGNED":
    case "IN_USE":
    case "PLANNED":
    case "GOOD":
    case "MEDIUM":
    case "EXTERNAL_REAL":
      colorClass = "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
      break;
    case "MAINTENANCE":
    case "ATTENTION_REQUIRED":
    case "HIGH":
    case "DRAFT":
    case "SIMULATED":
      colorClass = "bg-amber-500/10 text-amber-400 border-amber-500/30";
      break;
    case "CRITICAL":
    case "DAMAGED":
    case "CANCELLED":
    case "RETIRED":
    case "HISTORICAL":
      colorClass = "bg-rose-500/10 text-rose-400 border-rose-500/30";
      break;
    case "COMPLETED":
    case "DERIVED":
      colorClass = "bg-indigo-500/10 text-indigo-400 border-indigo-500/30";
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${colorClass}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.replace(/_/g, " ")}
    </span>
  );
}
