"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PolarisHeader } from "@/app/components/polaris-header";
import { StatusBadge } from "@/app/components/status-badge";

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
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <PolarisHeader currentPath="/expeditions" />
        <div className="mx-auto max-w-7xl px-4 py-12 text-center text-slate-400">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="mt-4 text-sm">Synchronizing Expedition Telemetry...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <PolarisHeader currentPath="/expeditions" />
        <div className="mx-auto max-w-4xl px-4 py-12">
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-6 text-center">
            <h2 className="text-xl font-bold text-rose-400">Expedition Not Found</h2>
            <p className="mt-2 text-sm text-slate-400">{error || `No mission data exists for '${code}'.`}</p>
            <div className="mt-6">
              <Link
                href="/expeditions"
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                ← Back to Expedition Registry
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <PolarisHeader currentPath="/expeditions" />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb & Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/expeditions"
              className="rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              ← Expeditions
            </Link>
            <span className="text-slate-600">/</span>
            <span className="font-mono text-sm font-semibold text-cyan-400">{expedition.code}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-slate-800 bg-slate-900/80 px-2.5 py-0.5 text-[10px] font-mono text-slate-400">
              CLASS: {expedition.data_classification}
            </span>
            <StatusBadge status={expedition.status} type="expedition" />
          </div>
        </div>

        {/* Mission Header Banner */}
        <div className="mt-6 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-900/50 to-slate-950 p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm">
                  🧭
                </span>
                <h1 className="text-2xl font-black tracking-wide text-white sm:text-3xl">
                  {expedition.name}
                </h1>
              </div>
              <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-slate-300">
                {expedition.description || "Operational field research and logistical campaign in polar sector."}
              </p>
            </div>

            {/* Quick Stats Block */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 text-center min-w-[120px]">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Roster Strength</div>
                <div className="mt-1 text-xl font-mono font-bold text-emerald-400">{roster.length} Personnel</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 text-center min-w-[120px]">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Field Assets</div>
                <div className="mt-1 text-xl font-mono font-bold text-cyan-400">{assignedAssets.length} Deployed</div>
              </div>
            </div>
          </div>

          {/* Mission Waypoints / Stations Strip */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-800/80 pt-6 text-xs">
            <div className="rounded-lg border border-slate-800/60 bg-slate-950/50 p-3">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Origin Staging Base</span>
              <strong className="text-slate-200 text-sm mt-0.5 block">
                {originStation ? `${originStation.name} (${originStation.code})` : "Unassigned Base"}
              </strong>
            </div>

            <div className="rounded-lg border border-slate-800/60 bg-slate-950/50 p-3">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Destination Sector</span>
              <strong className="text-slate-200 text-sm mt-0.5 block">
                {destinationStation ? `${destinationStation.name} (${destinationStation.code})` : "Open Continental Traverse"}
              </strong>
            </div>

            <div className="rounded-lg border border-slate-800/60 bg-slate-950/50 p-3">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Campaign Operational Window</span>
              <strong className="text-cyan-400 text-sm mt-0.5 block font-mono">
                {new Date(expedition.planned_start_at).toLocaleDateString()} → {new Date(expedition.planned_end_at).toLocaleDateString()}
              </strong>
            </div>
          </div>
        </div>

        {/* Two-Column Grid: Roster vs Assigned Assets */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Personnel Roster (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>👥</span> Operational Roster
                </h2>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                  {roster.length} Members
                </span>
              </div>

              {/* Expedition Leader Card */}
              {leader && (
                <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                      ★ Expedition Leader
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Joined {new Date(leader.joined_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <h3 className="text-base font-bold text-white">
                      {leader.person?.display_name || "Assigned Officer"}
                    </h3>
                    <p className="text-xs text-emerald-400/90 font-medium">
                      {leader.person?.role_title || "Field Mission Commander"}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Organization: <span className="text-slate-300">{leader.person?.organization || "NCPOR / MoES"}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Other Members List */}
              <div className="mt-4 space-y-2.5">
                {scientificMembers.length > 0 ? (
                  scientificMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-950/60 p-3 hover:border-slate-700 transition-colors"
                    >
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {member.person?.display_name || "Expedition Specialist"}
                        </div>
                        <div className="text-xs text-cyan-400/80">
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

          {/* Right Column: Assigned Equipment & Field Assets (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">🚜</span>
                  <h2 className="text-base font-bold text-white">Assigned Field Assets</h2>
                </div>
                <Link
                  href="/assets"
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  + Assign Gear in Catalog →
                </Link>
              </div>

              {assignedAssets.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {assignedAssets.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 hover:border-cyan-500/40 transition-colors"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <Link
                            href={`/assets/${item.asset?.asset_code}`}
                            className="font-mono text-sm font-bold text-cyan-400 hover:underline"
                          >
                            {item.asset?.asset_code}
                          </Link>
                          <span className="text-slate-600">|</span>
                          <span className="text-sm font-semibold text-white">
                            {item.asset?.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <StatusBadge status={item.asset?.status || "ASSIGNED"} type="asset" />
                          <StatusBadge status={item.asset?.criticality || "MEDIUM"} type="criticality" />
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-400">
                        <div>
                          Category: <span className="text-slate-300 font-medium">{item.asset?.category}</span>
                        </div>
                        <div>
                          Condition: <span className="text-slate-300 font-medium">{item.asset?.condition}</span>
                        </div>
                        <div>
                          Assigned: <span className="font-mono text-slate-300">{new Date(item.assigned_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {item.notes && (
                        <div className="mt-2.5 rounded bg-slate-900/90 border border-slate-800/80 p-2 text-[11px] text-slate-300">
                          <span className="text-slate-500 font-medium">Mission Note:</span> {item.notes}
                        </div>
                      )}

                      <div className="mt-3 flex justify-end">
                        <Link
                          href={`/assets/${item.asset?.asset_code}`}
                          className="text-xs font-semibold text-cyan-400 hover:text-cyan-300"
                        >
                          View Asset Telemetry &amp; Actions →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-8 text-center py-8 border border-dashed border-slate-800 rounded-xl">
                  <p className="text-sm text-slate-400">No assets currently assigned to this mission.</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Open the Asset Catalog, find an AVAILABLE vehicle or sensor, and assign it to {expedition.code}.
                  </p>
                  <div className="mt-4">
                    <Link
                      href="/assets"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors"
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
    </div>
  );
}
