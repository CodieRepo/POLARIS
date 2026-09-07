"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { PolarisHeader } from "../../components/polaris-header";
import { StatusBadge } from "../../components/status-badge";
import { useAuth } from "@/infrastructure/auth/auth-provider";
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
  const { role } = useAuth();

  const [assetHistory, setAssetHistory] = useState<AssetHistory | null>(null);
  const [stations, setStations] = useState<StationRow[]>([]);
  const [expeditions, setExpeditions] = useState<ExpeditionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Assignment Modal / Form state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceType, setMaintenanceType] = useState<"PREVENTIVE" | "CORRECTIVE" | "INSPECTION">("PREVENTIVE");
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 16));
  const [maintenanceDesc, setMaintenanceDesc] = useState("");
  const [maintenanceCost, setMaintenanceCost] = useState("");
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

  const handleMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetHistory?.asset) {
      console.error("[handleMaintenanceSubmit] ABORT: No asset record found in state");
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        asset_id: assetHistory.asset.id,
        maintenance_type: maintenanceType,
        scheduled_at: new Date(scheduledDate).toISOString(),
        description: maintenanceDesc || undefined,
        cost: maintenanceCost ? parseFloat(maintenanceCost) : undefined,
        notes: "Scheduled via POLARIS Asset Operations Portal",
      };

      console.log("[handleMaintenanceSubmit] Submitting payload:", JSON.stringify(payload));

      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      console.log("[handleMaintenanceSubmit] Server responded:", res.status, JSON.stringify(json));

      if (!res.ok) {
        setErrorMsg(`Maintenance order rejected: ${json.error || "Engine error"}`);
      } else {
        setSuccessMsg(`Work order scheduled successfully (${maintenanceType}).`);
        setShowMaintenanceModal(false);
        setMaintenanceDesc("");
        setMaintenanceCost("");
        await refreshAsset();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[handleMaintenanceSubmit] Exception:", msg);
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
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
        <PolarisHeader currentPath="/assets" />
        <div className="flex-1 flex items-center justify-center p-8 text-sm text-slate-500 font-mono">
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <PolarisHeader currentPath="/assets" />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {/* Navigation Breadcrumb */}
        <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Link href="/assets" className="hover:text-sky-700 transition-colors">
              ← Back to Asset Registry
            </Link>
            <span>/</span>
            <span className="font-mono text-sky-700 font-bold">{code}</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            NCPOR Asset Master Record
          </span>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-mono text-rose-800 flex items-center justify-between shadow-xs">
            <span>⚠️ {errorMsg}</span>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-xs text-rose-700 hover:text-rose-900 font-bold ml-4 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-mono text-emerald-800 flex items-center justify-between shadow-xs">
            <span>✅ {successMsg}</span>
            <button
              onClick={() => setSuccessMsg(null)}
              className="text-xs text-emerald-700 hover:text-emerald-900 font-bold ml-4 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Header Summary */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 mb-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-md bg-sky-50 px-2.5 py-0.5 text-xs font-mono font-bold text-sky-800 border border-sky-200">
                  ASSET DOSSIER
                </span>
                <span className="text-xs font-mono text-slate-500">
                  Tag: <strong className="text-sky-700 font-bold">{asset?.asset_code}</strong>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {asset?.name}
                </h1>
                <StatusBadge status={asset?.status || "AVAILABLE"} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span>Category: <strong className="text-slate-900">{asset?.category}</strong></span>
                <span>•</span>
                <span>
                  Current Base:{" "}
                  <strong className="text-slate-900">
                    {asset?.station_id
                      ? stationMap.get(asset.station_id) || "Field / Transit"
                      : "Field Traverse / In Transit"}
                  </strong>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  Classification: <StatusBadge status={asset?.data_classification || "SIMULATED"} type="classification" />
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2.5 shrink-0">
              {asset?.status === "AVAILABLE" && (!role || role !== "VIEWER") && (
                <button
                  onClick={() => setShowAssignModal(true)}
                  disabled={actionLoading}
                  className="rounded-lg bg-sky-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-sky-700 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  🚀 Assign Asset Workflow
                </button>
              )}

              {activeAssignment && (!role || role !== "VIEWER") && (
                <button
                  onClick={() => handleReleaseSubmit(activeAssignment.id)}
                  disabled={actionLoading}
                  className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  🔓 Release Active Allocation
                </button>
              )}

              {asset?.status !== "RETIRED" && (role === "SUPER_ADMIN" || role === "COMMAND_ADMIN" || role === "EXPEDITION_MANAGER") && (
                <button
                  onClick={() => setShowMaintenanceModal(true)}
                  disabled={actionLoading}
                  className="rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-2.5 text-xs font-bold text-indigo-800 hover:bg-indigo-100 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  🛠️ Schedule Maintenance
                </button>
              )}

              {asset?.status !== "RETIRED" && role === "SUPER_ADMIN" && (
                <button
                  onClick={handleRetire}
                  disabled={actionLoading}
                  className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  Permanently Retire
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Specifications Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between">
            <div>
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 mb-4 border-b border-slate-200 pb-2.5">
                Technical Specifications
              </h2>
              <dl className="space-y-3.5 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <dt className="text-slate-500">Manufacturer</dt>
                  <dd className="font-semibold text-slate-900">{asset?.manufacturer || "Unspecified"}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-slate-500">Model / Serial</dt>
                  <dd className="font-semibold text-slate-900">{asset?.model || "Standard Spec"}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-slate-500">Commissioned Date</dt>
                  <dd className="font-semibold text-slate-900">
                    {asset?.commissioned_at ? new Date(asset.commissioned_at).toLocaleDateString() : "Historical Ground Asset"}
                  </dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-slate-500">Operational Criticality</dt>
                  <dd><StatusBadge status={asset?.criticality || "MEDIUM"} type="criticality" /></dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-slate-500">Physical Degradation</dt>
                  <dd><StatusBadge status={asset?.condition || "GOOD"} type="condition" /></dd>
                </div>
              </dl>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] font-mono text-slate-400">
              Database UID: {asset?.id}
            </div>
          </div>

          {/* Active Allocation Context */}
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 mb-4 border-b border-slate-200 pb-2.5">
              Active Operational Allocation
            </h2>
            {activeAssignment ? (
              <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-200/60 pb-3">
                  <span className="text-xs font-mono font-bold text-sky-800 uppercase tracking-wider">
                    ● {activeAssignment.assignment_type.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs font-mono text-slate-600">
                    Deployed: {new Date(activeAssignment.assigned_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-sm text-slate-800 space-y-2">
                  {activeAssignment.expedition_id && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-mono">Assigned Expedition:</span>
                      <strong className="text-slate-900 font-semibold">
                        {expeditionMap.get(activeAssignment.expedition_id) || activeAssignment.expedition_id}
                      </strong>
                    </div>
                  )}
                  {activeAssignment.station_id && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-mono">Operating Station:</span>
                      <strong className="text-slate-900 font-semibold">
                        {stationMap.get(activeAssignment.station_id) || activeAssignment.station_id}
                      </strong>
                    </div>
                  )}
                  {activeAssignment.notes && (
                    <div className="rounded-lg bg-white p-3 border border-sky-200 text-xs text-slate-700 italic">
                      &ldquo;{activeAssignment.notes}&rdquo;
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-xs font-mono text-slate-500">
                <p className="text-slate-800 font-semibold mb-1">Asset is currently unallocated and in storage reserves.</p>
                <p className="text-slate-500">Available for immediate expedition traverse or station deployment via atomic transaction.</p>
              </div>
            )}
          </div>
        </div>

        {/* History Tabs / Records */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assignment History */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 mb-4 border-b border-slate-200 pb-2.5">
              Assignment &amp; Deployment History ({assignments.length})
            </h2>
            {assignments.length === 0 ? (
              <p className="text-xs font-mono text-slate-400 py-6 text-center">No previous deployment records found.</p>
            ) : (
              <div className="space-y-3">
                {assignments.map((asgn: AssetAssignmentRow) => (
                  <div
                    key={asgn.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs font-mono space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">
                        {asgn.assignment_type.replace(/_/g, " ")}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        asgn.released_at ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-sky-50 text-sky-800 border-sky-200"
                      }`}>
                        {asgn.released_at ? "RELEASED" : "ACTIVE"}
                      </span>
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      <span>Assigned: {new Date(asgn.assigned_at).toLocaleDateString()}</span>
                      {asgn.released_at && (
                        <span> • Concluded: {new Date(asgn.released_at).toLocaleDateString()}</span>
                      )}
                    </div>
                    {asgn.notes && (
                      <p className="text-slate-600 italic pt-1 border-t border-slate-200">
                        &quot;{asgn.notes}&quot;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Maintenance Servicing Records */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 mb-4 border-b border-slate-200 pb-2.5">
              Maintenance Work Orders ({maintenance.length})
            </h2>
            {maintenance.length === 0 ? (
              <p className="text-xs font-mono text-slate-400 py-6 text-center">No scheduled or historical maintenance logs.</p>
            ) : (
              <div className="space-y-3">
                {maintenance.map((m: MaintenanceRecordRow) => (
                  <div
                    key={m.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs font-mono space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{m.maintenance_type}</span>
                      <StatusBadge status={m.status} />
                    </div>
                    <p className="text-slate-700 font-sans text-xs">{m.description || "Routine cold-region check"}</p>
                    <div className="flex items-center justify-between text-slate-500 text-[11px] pt-1 border-t border-slate-200">
                      <span>Technician: {m.performed_by || "Station Plant Engineer"}</span>
                      {m.cost && <span className="text-slate-900 font-bold">Cost: ${m.cost}</span>}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Assign Asset [{code}]</h3>
                <span className="text-xs font-mono text-slate-500">PostgreSQL Atomic Allocation RPC</span>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
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
                  className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
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
                  <label className="block font-semibold text-slate-700 mb-1">
                    Target Expedition
                  </label>
                  <select
                    value={targetExpeditionId}
                    onChange={(e) => setTargetExpeditionId(e.target.value)}
                    className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
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
                  <label className="block font-semibold text-slate-700 mb-1">
                    Destination Station
                  </label>
                  <select
                    value={targetStationId}
                    onChange={(e) => setTargetStationId(e.target.value)}
                    className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
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
                <label className="block font-semibold text-slate-700 mb-1">
                  Operational Mission Notes (Optional)
                </label>
                <textarea
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="e.g. Assigned to 44th ISEA team for radar survey in Sector 4"
                  rows={3}
                  className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="rounded-lg bg-slate-100 border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-lg bg-sky-600 px-4 py-2 font-bold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {actionLoading ? "Executing RPC..." : "Confirm Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Maintenance Modal */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>🛠️</span> Schedule Maintenance Work Order
              </h3>
              <button
                onClick={() => setShowMaintenanceModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleMaintenanceSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Maintenance Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["PREVENTIVE", "CORRECTIVE", "INSPECTION"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMaintenanceType(type)}
                      className={`p-2 rounded-lg border text-center font-bold transition-colors cursor-pointer ${
                        maintenanceType === type
                          ? "border-sky-500 bg-sky-50 text-sky-800"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Scheduled Service Date &amp; Time
                </label>
                <input
                  id="maintenance-scheduled-date"
                  name="scheduledDate"
                  type="datetime-local"
                  required
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Work Order Description / Sub-Zero Scope
                </label>
                <textarea
                  id="maintenance-desc"
                  name="maintenanceDesc"
                  required
                  rows={2}
                  value={maintenanceDesc}
                  onChange={(e) => setMaintenanceDesc(e.target.value)}
                  placeholder="e.g. 250-hr cold-weather fluid flush, hydraulic track inspection"
                  className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Estimated Servicing Cost ($ USD, Optional)
                </label>
                <input
                  id="maintenance-cost"
                  name="maintenanceCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={maintenanceCost}
                  onChange={(e) => setMaintenanceCost(e.target.value)}
                  placeholder="e.g. 750.00"
                  className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowMaintenanceModal(false)}
                  className="rounded-lg bg-slate-100 border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {actionLoading ? "Logging Order..." : "Schedule Work Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 mt-12">
        POLARIS • National Centre for Polar &amp; Ocean Research (NCPOR) Management Foundation • SIH 2026
      </footer>
    </div>
  );
}
