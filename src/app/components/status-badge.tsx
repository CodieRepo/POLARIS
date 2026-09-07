import React from "react";

interface StatusBadgeProps {
  status: string;
  type?: "asset" | "expedition" | "station" | "condition" | "criticality" | "classification" | "general";
  size?: "xs" | "sm";
}

export function StatusBadge({ status, size = "xs" }: StatusBadgeProps) {
  let colorClass = "bg-slate-100 text-slate-700 border-slate-300";
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
      colorClass = "bg-emerald-50 text-emerald-800 border-emerald-300";
      break;
    case "ASSIGNED":
    case "IN_USE":
    case "PLANNED":
    case "GOOD":
    case "MEDIUM":
    case "EXTERNAL_REAL":
      colorClass = "bg-sky-50 text-sky-800 border-sky-300";
      break;
    case "MAINTENANCE":
    case "ATTENTION_REQUIRED":
    case "WATCH":
    case "RESUPPLY_REQUIRED":
    case "HIGH":
    case "DRAFT":
    case "SIMULATED":
      colorClass = "bg-amber-50 text-amber-800 border-amber-300";
      break;
    case "CRITICAL":
    case "DAMAGED":
    case "CANCELLED":
    case "RETIRED":
    case "HISTORICAL":
    case "POOR":
      colorClass = "bg-rose-50 text-rose-800 border-rose-300";
      break;
    case "COMPLETED":
    case "DERIVED":
      colorClass = "bg-violet-50 text-violet-800 border-violet-300";
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

