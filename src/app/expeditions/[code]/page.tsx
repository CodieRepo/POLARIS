"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PolarisHeader } from "@/app/components/polaris-header";
import { StatusBadge } from "@/app/components/status-badge";
import { ProvenanceBadge } from "@/app/components/provenance-badge";

interface Person {
  id: string;
  display_name: string;
  role_title: string;
  organization: string;
  active: boolean;
}

interface RosterMember {
  id: string;
  assignment_role: string;
  joined_at: string;
  person: Person | null;
}

interface AssignedAsset {
  id: string;
  asset_id: string;
  assignment_type: string;
  assigned_at: string;
  notes: string | null;
  asset: {
    id: string;
    asset_code: string;
    name: string;
    category: string;
    type: string | null;
    status: string;
    condition: string;
    criticality: string;
  } | null;
}

interface ExpeditionData {
  expedition: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    status: string;
    data_classification: string;
    planned_start_at: string;
    planned_end_at: string;
    actual_start_at: string | null;
    actual_end_at: string | null;
  };
  roster: RosterMember[];
  assignedAssets: AssignedAsset[];
  originStation: { code: string; name: string } | null;
  destinationStation: { code: string; name: string } | null;
}

export default function ExpeditionDetailPage() {
  const params = useParams();
  const code = (params.code as string)?.toUpperCase();

  const [data, setData] = useState<ExpeditionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;

    let isMounted = true;
    const fetchExpedition = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/expeditions/${code}`);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Failed to load expedition details");
        }

        if (isMounted) {
          setData(json.data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Error fetching mission");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchExpedition();

    return () => {
      isMounted = false;
    };
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
        <PolarisHeader currentPath="/expeditions" />
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-sky-600 border-t-transparent mb-4" />
          <p className="text-xs font-mono">Loading Mission Data [{code}]...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
        <PolarisHeader currentPath="/expeditions" />
        <div className="flex-1 mx-auto max-w-4xl px-4 py-12 w-full">
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-8 text-center space-y-4 shadow-xs">
            <span className="text-3xl block">⚠️</span>
            <h2 className="text-xl font-bold text-rose-800">Expedition Record Not Found</h2>
            <p className="text-xs text-slate-600 max-w-md mx-auto">{error || `No mission data exists for code '${code}'.`}</p>
            <div className="pt-2">
              <Link
                href="/expeditions"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
              >
                ← Return to Expedition Registry
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { expedition, roster, assignedAssets, originStation, destinationStation } = data;
  const leader = roster.find((m) => m.assignment_role === "EXPEDITION_LEADER");
  const scientificMembers = roster.filter((m) => m.assignment_role !== "EXPEDITION_LEADER");

  // Derived Mission Health Heuristic
  const personnelScore = roster.length > 0 ? 25 : 5;
  const assetScore = assignedAssets.length > 0 ? 25 : 10;
  const logisticsScore = 25;
  const environmentScore = 20;
  const totalHealthScore = personnelScore + assetScore + logisticsScore + environmentScore;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <PolarisHeader currentPath="/expeditions" />

      <main className="flex-1 mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500 font-mono">
            <Link href="/expeditions" className="hover:text-sky-700 transition-colors">
              ← Expeditions
            </Link>
            <span>/</span>
            <span className="font-bold text-sky-700">{expedition.code}</span>
          </div>

          <div className="flex items-center gap-2">
            <ProvenanceBadge tier={expedition.data_classification} size="xs" />
            <StatusBadge status={expedition.status} type="expedition" />
          </div>
        </div>

        {/* Mission Command Header Banner */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="rounded bg-sky-50 px-2 py-0.5 text-xs font-mono font-bold text-sky-700 border border-sky-200">
                  {expedition.code}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Phase: {expedition.status === "ACTIVE" ? "STATION OPERATIONS" : "MOBILIZATION"}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                {expedition.name}
              </h1>
              <p className="max-w-3xl text-xs sm:text-sm text-slate-600 leading-relaxed">
                {expedition.description || "Operational scientific campaign and logistics field mission."}
              </p>
            </div>

            {/* Mission Health Card */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 min-w-[220px] text-center shadow-xs shrink-0">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Mission Health
                </span>
                <ProvenanceBadge tier="DERIVED" size="xs" />
              </div>
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="text-3xl font-black font-mono text-emerald-700">
                  {totalHealthScore}
                </span>
                <span className="text-xs font-bold text-slate-400">/ 100</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] font-mono text-slate-500">
                <span>Roster: {roster.length} pers</span>
                <span>Gear: {assignedAssets.length} units</span>
              </div>
            </div>
          </div>

          {/* Mission Waypoints / Stations Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 pt-5 text-xs font-mono">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Origin Staging Base</span>
              <strong className="text-slate-800 text-sm mt-0.5 block truncate">
                {originStation ? `${originStation.name} (${originStation.code})` : "Direct Departure"}
              </strong>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Destination Sector</span>
              <strong className="text-slate-800 text-sm mt-0.5 block truncate">
                {destinationStation ? `${destinationStation.name} (${destinationStation.code})` : "Continental Field Sector"}
              </strong>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Campaign Operational Window</span>
              <strong className="text-sky-700 text-sm mt-0.5 block">
                {new Date(expedition.planned_start_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} → {new Date(expedition.planned_end_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </strong>
            </div>
          </div>
        </div>

        {/* Two-Column Grid: Roster vs Assigned Assets */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Personnel Roster (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <span>👥</span> Operational Roster
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-600 font-bold border border-slate-200">
                  {roster.length} Personnel
                </span>
              </div>

              {/* Expedition Leader Card */}
              {leader && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase tracking-wider font-mono border border-emerald-200">
                      ★ Expedition Leader
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Joined {new Date(leader.joined_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {leader.person?.display_name || "Assigned Officer"}
                    </h3>
                    <p className="text-xs text-emerald-800 font-medium">
                      {leader.person?.role_title || "Field Mission Commander"}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Org: <span className="text-slate-700">{leader.person?.organization || "NCPOR / MoES"}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Other Members List */}
              <div className="space-y-2">
                {scientificMembers.length > 0 ? (
                  scientificMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3 hover:border-slate-300 transition-colors"
                    >
                      <div>
                        <div className="text-xs font-semibold text-slate-900">
                          {member.person?.display_name || "Expedition Specialist"}
                        </div>
                        <div className="text-[11px] text-sky-700 font-medium">
                          {member.person?.role_title || member.assignment_role}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {member.person?.organization || "MoES India"}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(member.joined_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 py-3 text-center">
                    No additional specialists logged in active roster.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Assigned Field Assets (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    🚜 Assigned Field Assets
                  </h2>
                </div>
                <Link
                  href="/assets"
                  className="text-xs font-semibold text-sky-700 hover:text-sky-800 transition-colors"
                >
                  + Assign Gear in Catalog →
                </Link>
              </div>

              {assignedAssets.length > 0 ? (
                <div className="space-y-3">
                  {assignedAssets.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 hover:border-slate-300 transition-colors space-y-2.5 shadow-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/assets/${item.asset?.asset_code}`}
                            className="font-mono text-sm font-bold text-sky-700 hover:underline"
                          >
                            {item.asset?.asset_code}
                          </Link>
                          <span className="text-slate-300">|</span>
                          <span className="text-sm font-semibold text-slate-900">
                            {item.asset?.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={item.asset?.status || "ASSIGNED"} type="asset" />
                          <StatusBadge status={item.asset?.criticality || "MEDIUM"} type="criticality" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 font-mono">
                        <div>
                          Category: <span className="text-slate-900 font-medium">{item.asset?.category}</span>
                        </div>
                        <div>
                          Condition: <span className="text-slate-900 font-medium">{item.asset?.condition}</span>
                        </div>
                        <div>
                          Assigned: <span className="text-slate-900 font-medium">{new Date(item.assigned_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {item.notes && (
                        <div className="rounded-lg bg-white border border-slate-200 p-2 text-[11px] text-slate-700 font-sans">
                          <span className="text-slate-500 font-medium">Mission Note:</span> {item.notes}
                        </div>
                      )}

                      <div className="flex justify-end pt-1">
                        <Link
                          href={`/assets/${item.asset?.asset_code}`}
                          className="text-xs font-semibold text-sky-700 hover:text-sky-800"
                        >
                          Manage Asset Lifecycle →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 border border-dashed border-slate-300 rounded-xl space-y-2">
                  <p className="text-xs text-slate-600">No assets currently allocated to this mission.</p>
                  <p className="text-[11px] text-slate-500">
                    Find available vehicles or scientific equipment in the catalog to deploy.
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/assets"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-sky-700 transition-colors shadow-xs"
                    >
                      Browse Available Assets →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 mt-12">
        POLARIS • National Centre for Polar &amp; Ocean Research (NCPOR) Management Foundation • SIH 2026
      </footer>
    </div>
  );
}

