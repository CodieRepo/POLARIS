"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { PolarisHeader } from "../../components/polaris-header";
import { StatusBadge } from "../../components/status-badge";
import type {
  AssetHistory,
  AssetAssignmentRow,
  MaintenanceRecordRow,
} from "@/modules/asset/types/asset.types";
import type { StationRow } from "@/core/station/station-repository";
import type { ExpeditionRow } from "@/modules/expedition/types/expedition.types";

interface PageProps {
  params: Promise<{ code: string }>;
}

export default function AssetDetailPage({ params }: PageProps) {
  const { code } = use(params);

  const [assetHistory, setAssetHistory] = useState<AssetHistory | null>(null);
  const [stations, setStations] = useState<StationRow[]>([]);
  const [expeditions, setExpeditions] = useState<ExpeditionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Assignment Modal / Form state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignType, setAssignType] = useState<
    "STATION_DEPLOYMENT" | "EXPEDITION_FIELD_OPERATION"
  >("EXPEDITION_FIELD_OPERATION");
  const [targetStationId, setTargetStationId] = useState("");
  const [targetExpeditionId, setTargetExpeditionId] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const refreshAsset = async () => {
    try {
      const res = await fetch(`/api/assets/${code}?history=true`);
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "Failed to load asset");
      } else {
        setAssetHistory(json.data);
      }
    } catch {
      setErrorMsg("Network error fetching asset history");
    }
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [assetRes, stRes, expRes] = await Promise.all([
          fetch(`/api/assets/${code}?history=true`),
          fetch("/api/stations"),
          fetch("/api/expeditions"),
        ]);

        const assetJson = await assetRes.json();
        const stJson = await stRes.json();
        const expJson = await expRes.json();

        if (assetJson.data) setAssetHistory(assetJson.data);
        if (stJson.data) {
          setStations(stJson.data);
          if (stJson.data.length > 0) setTargetStationId(stJson.data[0].id);
        }
        if (expJson.data) {
          setExpeditions(expJson.data);
          if (expJson.data.length > 0) setTargetExpeditionId(expJson.data[0].id);
        }
      } catch {
        setErrorMsg("Failed to initialize asset management screen");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [code]);

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetHistory?.asset) return;

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload: {
        asset_id: string;
        assignment_type: "STATION_DEPLOYMENT" | "EXPEDITION_FIELD_OPERATION";
        notes?: string;
        station_id?: string;
        expedition_id?: string;
      } = {
        asset_id: assetHistory.asset.id,
        assignment_type: assignType,
        notes: assignNotes || undefined,
      };

      if (assignType === "STATION_DEPLOYMENT") {
        payload.station_id = targetStationId;
      } else {
        payload.expedition_id = targetExpeditionId;
      }

      const res = await fetch("/api/assets/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorMsg(`Assignment rejected: ${json.error || "Engine error"}`);
      } else {
        setSuccessMsg("Asset successfully assigned via PostgreSQL atomic RPC.");
        setShowAssignModal(false);
        await refreshAsset();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Workflow exception: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReleaseSubmit = async (assignmentId: string) => {
    if (!confirm("Are you sure you want to release this active allocation?")) return;

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/assets/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_id: assignmentId }),
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorMsg(`Release rejected: ${json.error || "Engine error"}`);
      } else {
        setSuccessMsg("Assignment released and asset returned to AVAILABLE status.");
        await refreshAsset();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Workflow exception: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetire = async () => {
    if (!confirm("Permanently transition this asset to RETIRED status? Once retired, no further state mutations are permitted.")) return;

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/assets/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RETIRED" }),
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorMsg(`Retirement rejected: ${json.error || "Unauthorized"}`);
      } else {
        setSuccessMsg("Asset permanently retired under SUPER_ADMIN authority.");
        await refreshAsset();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Retirement exception: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <PolarisHeader currentPath="/assets" />
        <div className="flex-1 flex items-center justify-center p-8 text-sm text-slate-400">
          Loading asset record [{code}]...
        </div>
      </div>
    );
  }

  const asset = assetHistory?.asset;
  const assignments: readonly AssetAssignmentRow[] =
    assetHistory?.assignments ?? [];
  const maintenance: readonly MaintenanceRecordRow[] =
    assetHistory?.maintenance ?? [];
  const activeAssignment = assignments.find(
    (a: AssetAssignmentRow) => a.released_at === null
  );

  const stationMap = new Map(stations.map((s) => [s.id, s.name]));
  const expeditionMap = new Map(expeditions.map((e) => [e.id, e.name]));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PolarisHeader currentPath="/assets" />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {/* Navigation Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-xs text-slate-400">
          <Link href="/assets" className="hover:text-cyan-400">
            ← Back to Asset Inventory
          </Link>
          <span>/</span>
          <span className="font-mono text-cyan-400">{code}</span>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="mb-6 rounded-lg border border-rose-500/40 bg-rose-950/40 p-4 text-sm text-rose-300 flex items-center justify-between">
            <span>⚠️ {errorMsg}</span>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-xs text-rose-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 rounded-lg border border-emerald-500/40 bg-emerald-950/40 p-4 text-sm text-emerald-300 flex items-center justify-between">
            <span>✅ {successMsg}</span>
            <button
              onClick={() => setSuccessMsg(null)}
              className="text-xs text-emerald-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Header Summary */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-black text-white">
                  {asset?.name}
                </h1>
                <StatusBadge status={asset?.status || "AVAILABLE"} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="font-mono text-cyan-400 font-bold">{asset?.asset_code}</span>
                <span>•</span>
                <span>Category: <strong className="text-slate-200">{asset?.category}</strong></span>
                <span>•</span>
                <span>
                  Current Location:{" "}
                  <strong className="text-slate-200">
                    {asset?.station_id
                      ? stationMap.get(asset.station_id) || "Field / Transit"
                      : "Field / Transit"}
                  </strong>
                </span>
                <span>•</span>
                <span>Data Classification: <StatusBadge status={asset?.data_classification || "SIMULATED"} type="classification" /></span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              {asset?.status === "AVAILABLE" && (
                <button
                  onClick={() => setShowAssignModal(true)}
                  disabled={actionLoading}
                  className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  🚀 Assign Asset Workflow
                </button>
              )}

              {activeAssignment && (
                <button
                  onClick={() => handleReleaseSubmit(activeAssignment.id)}
                  disabled={actionLoading}
                  className="rounded-lg bg-amber-500/20 border border-amber-500/40 px-4 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/30 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  🔓 Release Active Assignment
                </button>
              )}

              {asset?.status !== "RETIRED" && (
                <button
                  onClick={handleRetire}
                  disabled={actionLoading}
                  className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Permanently Retire
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Specifications Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 border-b border-slate-800 pb-2">
              Technical Specifications
            </h2>
            <dl className="space-y-3 text-xs">
              <div className="flex justify-between">
                <dt className="text-slate-400">Manufacturer</dt>
                <dd className="font-semibold text-slate-200">{asset?.manufacturer || "Unspecified"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Model / Serial</dt>
                <dd className="font-semibold text-slate-200">{asset?.model || "Standard Spec"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Commissioned Date</dt>
                <dd className="font-semibold text-slate-200">
                  {asset?.commissioned_at ? new Date(asset.commissioned_at).toLocaleDateString() : "Historical"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Operational Criticality</dt>
                <dd><StatusBadge status={asset?.criticality || "MEDIUM"} type="criticality" /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Physical Degradation</dt>
                <dd><StatusBadge status={asset?.condition || "GOOD"} type="condition" /></dd>
              </div>
            </dl>
          </div>

          {/* Active Allocation Context */}
          <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 border-b border-slate-800 pb-2">
              Active Operational Allocation
            </h2>
            {activeAssignment ? (
              <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                    {activeAssignment.assignment_type.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-slate-400">
                    Deployed: {new Date(activeAssignment.assigned_at).toLocaleString()}
                  </span>
                </div>
                <div className="mt-2 text-sm text-slate-200">
                  {activeAssignment.expedition_id && (
                    <p>
                      Assigned to Expedition:{" "}
                      <strong className="text-white">
                        {expeditionMap.get(activeAssignment.expedition_id) || activeAssignment.expedition_id}
                      </strong>
                    </p>
                  )}
                  {activeAssignment.station_id && (
                    <p>
                      Station Base:{" "}
                      <strong className="text-white">
                        {stationMap.get(activeAssignment.station_id) || activeAssignment.station_id}
                      </strong>
                    </p>
                  )}
                  {activeAssignment.notes && (
                    <p className="mt-2 text-xs text-slate-400 italic">
                      Notes: {activeAssignment.notes}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-6 text-center text-xs text-slate-400">
                Asset is currently unallocated. Available for expedition or station deployment via atomic transaction.
              </div>
            )}
          </div>
        </div>

        {/* History Tabs / Records */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Assignment History */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">
              Assignment &amp; Deployment History ({assignments.length})
            </h2>
            {assignments.length === 0 ? (
              <p className="text-xs text-slate-500">No previous deployment records found.</p>
            ) : (
              <div className="space-y-3">
                {assignments.map((asgn: AssetAssignmentRow) => (
                  <div
                    key={asgn.id}
                    className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">
                        {asgn.assignment_type.replace(/_/g, " ")}
                      </span>
                      <span className="text-slate-400">
                        {asgn.released_at ? "RELEASED" : "ACTIVE"}
                      </span>
                    </div>
                    <div className="mt-1 text-slate-400">
                      <span>Assigned: {new Date(asgn.assigned_at).toLocaleDateString()}</span>
                      {asgn.released_at && (
                        <span> • Concluded: {new Date(asgn.released_at).toLocaleDateString()}</span>
                      )}
                    </div>
                    {asgn.notes && (
                      <p className="mt-1 text-slate-400 italic">
                        &quot;{asgn.notes}&quot;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Maintenance Servicing Records */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">
              Maintenance Work Orders ({maintenance.length})
            </h2>
            {maintenance.length === 0 ? (
              <p className="text-xs text-slate-500">No scheduled or historical maintenance logs.</p>
            ) : (
              <div className="space-y-3">
                {maintenance.map((m: MaintenanceRecordRow) => (
                  <div
                    key={m.id}
                    className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{m.maintenance_type}</span>
                      <StatusBadge status={m.status} />
                    </div>
                    <p className="mt-1 text-slate-300">{m.description || "Routine cold-region check"}</p>
                    <div className="mt-1 flex items-center justify-between text-slate-400">
                      <span>Technician: {m.performed_by || "Station Plant Engineer"}</span>
                      {m.cost && <span>Cost: ${m.cost}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Atomic Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Assign Asset [{code}]</h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Deployment Scope
                </label>
                <select
                  value={assignType}
                  onChange={(e) =>
                    setAssignType(
                      e.target.value as
                        | "EXPEDITION_FIELD_OPERATION"
                        | "STATION_DEPLOYMENT"
                    )
                  }
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="EXPEDITION_FIELD_OPERATION">
                    Expedition Field Operation
                  </option>
                  <option value="STATION_DEPLOYMENT">
                    Station Permanent Deployment
                  </option>
                </select>
              </div>

              {assignType === "EXPEDITION_FIELD_OPERATION" ? (
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Target Expedition
                  </label>
                  <select
                    value={targetExpeditionId}
                    onChange={(e) => setTargetExpeditionId(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                  >
                    {expeditions.map((exp) => (
                      <option key={exp.id} value={exp.id}>
                        {exp.code} - {exp.name} ({exp.status})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Destination Station
                  </label>
                  <select
                    value={targetStationId}
                    onChange={(e) => setTargetStationId(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                  >
                    {stations.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.code} - {st.name} ({st.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Operational Mission Notes (Optional)
                </label>
                <textarea
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="e.g. Assigned to 44th ISEA team for radar survey in Sector 4"
                  rows={3}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-lg bg-cyan-500 px-4 py-2 font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? "Executing RPC..." : "Confirm Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
