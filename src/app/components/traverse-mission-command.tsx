'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/infrastructure/auth/auth-provider';
import { MutationQueue } from '@/core/offline/mutation-queue';
import { useOfflineSync } from '@/core/offline/use-offline-sync';
import type {
  TraverseMissionWithDetails,
  CreateMissionPayload,
  RecordCheckinPayload,
  TraverseMissionStatus,
  CommsStatus,
} from '@/core/traverse/types';
import {
  MAITRI_SHELF_TRAVERSE,
  BHARATI_AMERY_TRAVERSE,
  POLAR_HAZARD_ZONES,
  type TraverseCorridor,
} from '@/core/spatial/traverse-routes';
import { calculateHaversineDistance } from '@/core/spatial/geodesic';

interface TraverseMissionCommandProps {
  onFocusCoordinates?: (lon: number, lat: number, zoom?: number) => void;
  onMissionSelected?: (mission: TraverseMissionWithDetails | null) => void;
}

export function TraverseMissionCommand({
  onFocusCoordinates,
  onMissionSelected,
}: TraverseMissionCommandProps) {
  const { can } = useAuth();
  const { syncState } = useOfflineSync();

  const [missions, setMissions] = useState<TraverseMissionWithDetails[]>([]);
  const [selectedMission, setSelectedMission] = useState<TraverseMissionWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TraverseMissionStatus | null>(null);
  const [transitionNotes, setTransitionNotes] = useState('');

  // Create Form State
  const [newMissionCode, setNewMissionCode] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newCorridorId, setNewCorridorId] = useState<'TRV-MTR-SHELF' | 'TRV-BHR-AMERY'>('TRV-MTR-SHELF');
  const [newExpeditionId] = useState('d0000000-0000-0000-0000-000000000001');
  const [newLeadPersonId] = useState('c0000000-0000-0000-0000-000000000002');
  const [newLeadAssetId, setNewLeadAssetId] = useState('f0000000-0000-0000-0000-000000000001');
  const [newDepartureTime, setNewDepartureTime] = useState(
    new Date(Date.now() + 3600000 * 2).toISOString().slice(0, 16)
  );
  const [newCheckinInterval, setNewCheckinInterval] = useState('6');
  const [newNotes, setNewNotes] = useState('');

  // Check-in Form State
  const [selectedWaypointCode, setSelectedWaypointCode] = useState('');
  const [checkinFuel, setCheckinFuel] = useState('');
  const [checkinTemp, setCheckinTemp] = useState('-15');
  const [checkinComms, setCheckinComms] = useState<CommsStatus>('NOMINAL_HF');
  const [checkinOpStatus, setCheckinOpStatus] = useState('NOMINAL');
  const [checkinHazardNotes, setCheckinHazardNotes] = useState('');

  // 1. Fetch Missions
  const fetchMissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/traverse/missions');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setMissions(json.data);
        if (selectedMission) {
          const updated = json.data.find((m: TraverseMissionWithDetails) => m.id === selectedMission.id);
          if (updated) setSelectedMission(updated);
        }
      }
    } catch (err) {
      console.warn('Failed to load traverse missions:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMission]);

  useEffect(() => {
    fetchMissions();
  }, [fetchMissions]);

  const handleSelectMission = (m: TraverseMissionWithDetails) => {
    setSelectedMission(m);
    if (onMissionSelected) onMissionSelected(m);

    // If mission has a latest check-in, focus that waypoint; otherwise focus origin corridor
    if (m.latestCheckin && onFocusCoordinates) {
      onFocusCoordinates(m.latestCheckin.longitude, m.latestCheckin.latitude, 5.0);
    } else {
      const corridor = m.corridor_id === 'TRV-MTR-SHELF' ? MAITRI_SHELF_TRAVERSE : BHARATI_AMERY_TRAVERSE;
      if (onFocusCoordinates) {
        onFocusCoordinates(corridor.waypoints[0].longitude, corridor.waypoints[0].latitude, 4.8);
      }
    }
  };

  // Active Corridor Definition
  const activeCorridor: TraverseCorridor =
    selectedMission?.corridor_id === 'TRV-BHR-AMERY' ? BHARATI_AMERY_TRAVERSE : MAITRI_SHELF_TRAVERSE;

  // Evaluate nearby hazards from latest verified check-in
  const nearbyHazards = React.useMemo(() => {
    if (!selectedMission?.latestCheckin) return [];
    const loc = {
      lat: selectedMission.latestCheckin.latitude,
      lon: selectedMission.latestCheckin.longitude,
    };
    return POLAR_HAZARD_ZONES.map((haz) => {
      const dist = calculateHaversineDistance(loc, {
        lat: haz.centerCoordinates[1],
        lon: haz.centerCoordinates[0],
      });
      return { hazard: haz, distanceKm: dist, isWithinZone: dist <= haz.radiusKm };
    }).sort((a, b) => a.distanceKm - b.distanceKm);
  }, [selectedMission]);

  // 3. Create Mission
  const handleCreateMission = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const originStationId =
        newCorridorId === 'TRV-MTR-SHELF'
          ? 'b0000000-0000-0000-0000-000000000002' // MTR
          : 'b0000000-0000-0000-0000-000000000001'; // BHR

      const payload: CreateMissionPayload = {
        mission_code: newMissionCode || `TRV-${Date.now().toString().slice(-6)}`,
        title: newTitle || 'Polar Overland Traverse Run',
        corridor_id: newCorridorId,
        origin_station_id: originStationId,
        expedition_id: newExpeditionId,
        lead_person_id: newLeadPersonId,
        lead_asset_id: newLeadAssetId,
        scheduled_departure_at: new Date(newDepartureTime).toISOString(),
        checkin_interval_hours: parseFloat(newCheckinInterval) || 6.0,
        operational_notes: newNotes || 'Field mission planned.',
      };

      const res = await fetch('/api/traverse/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to create mission');

      setSuccessMsg(`Mission ${payload.mission_code} registered in PLANNED state.`);
      setShowCreateModal(false);
      setNewMissionCode('');
      setNewTitle('');
      await fetchMissions();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Transition Status (Dispatch, Complete, Abort, Cancel)
  const handleExecuteTransition = async () => {
    if (!selectedMission || !pendingStatus) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/traverse/missions/${selectedMission.id}/transition`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: pendingStatus, notes: transitionNotes }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Transition failed');

      setSuccessMsg(`Mission transitioned to ${pendingStatus}.`);
      setShowTransitionModal(false);
      setPendingStatus(null);
      setTransitionNotes('');
      await fetchMissions();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Record Check-in (Supports Offline Queue)
  const handleRecordCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMission) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);

    const wp = activeCorridor.waypoints.find((w) => w.code === selectedWaypointCode);
    if (!wp) {
      setError('Please select a valid surveyed waypoint.');
      setActionLoading(false);
      return;
    }

    const payload: RecordCheckinPayload = {
      waypoint_code: wp.code,
      latitude: wp.latitude,
      longitude: wp.longitude,
      checkin_at: new Date().toISOString(),
      remaining_fuel_liters: checkinFuel ? parseFloat(checkinFuel) : null,
      ambient_temp_c: checkinTemp ? parseFloat(checkinTemp) : null,
      comms_status: checkinComms,
      operational_status: checkinOpStatus,
      hazard_assessment_notes: checkinHazardNotes || null,
    };

    try {
      if (syncState === 'OFFLINE') {
        // Enqueue to IndexedDB for offline synchronization
        await MutationQueue.enqueue(
          'RECORD_TRAVERSE_CHECKIN',
          selectedMission.origin_station_id,
          {
            missionId: selectedMission.id,
            waypointCode: payload.waypoint_code,
            latitude: payload.latitude,
            longitude: payload.longitude,
            remainingFuelLiters: payload.remaining_fuel_liters,
            ambientTempC: payload.ambient_temp_c,
            commsStatus: payload.comms_status,
            operationalStatus: payload.operational_status,
            hazardAssessmentNotes: payload.hazard_assessment_notes,
            checkinAt: payload.checkin_at,
          }
        );
        setSuccessMsg(`Check-in buffered to IndexedDB queue (OFFLINE PENDING SYNC).`);
      } else {
        const res = await fetch(`/api/traverse/missions/${selectedMission.id}/checkin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to record check-in');

        setSuccessMsg(`Verified check-in logged at ${wp.code}.`);
      }

      setShowCheckinModal(false);
      setSelectedWaypointCode('');
      setCheckinFuel('');
      setCheckinHazardNotes('');
      await fetchMissions();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4 font-mono text-xs text-slate-800">
      {/* Header & Mission Action Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div>
          <span className="text-[10px] uppercase font-bold text-sky-700 block">
            Overland Traverse Mission Command
          </span>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Discrete waypoint check-ins, convoy state machine &amp; hazard proximity.
          </p>
        </div>

        {can('TRAVERSE_MISSION_CREATE') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-sky-700 transition cursor-pointer shadow-xs"
          >
            + Create Mission
          </button>
        )}
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-rose-800 text-[11px]">
          <strong>Error:</strong> {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-emerald-800 text-[11px]">
          {successMsg}
        </div>
      )}

      {/* Active Missions List */}
      <div className="space-y-2">
        <span className="text-[10px] text-slate-500 uppercase font-bold block">
          Active Traverse Missions ({missions.length})
        </span>

        {missions.length === 0 && !loading && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-slate-400">
            No active traverse missions registered.
          </div>
        )}

        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {missions.map((m) => {
            const isSelected = selectedMission?.id === m.id;
            const statusColor =
              m.status === 'EN_ROUTE'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : m.status === 'CHECKIN_OVERDUE'
                ? 'bg-rose-50 text-rose-800 border-rose-200 animate-pulse'
                : m.status === 'DISPATCHED'
                ? 'bg-sky-50 text-sky-800 border-sky-200'
                : m.status === 'COMPLETED'
                ? 'bg-purple-50 text-purple-800 border-purple-200'
                : 'bg-slate-100 text-slate-700 border-slate-200';

            return (
              <div
                key={m.id}
                onClick={() => handleSelectMission(m)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-sky-50 border-sky-300 shadow-xs'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">{m.mission_code}</span>
                    <span className="text-[10px] text-slate-600 truncate max-w-[180px] block font-sans">
                      {m.title}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${statusColor}`}>
                    {m.isOverdue && m.status === 'EN_ROUTE' ? 'CHECKIN OVERDUE' : m.status}
                  </span>
                </div>

                <div className="mt-2 flex justify-between text-[10px] text-slate-500 border-t border-slate-200 pt-1.5">
                  <span>Base: <strong className="text-slate-800">{m.originStation?.code || 'Base'}</strong></span>
                  <span>Vehicle: <strong className="text-sky-700">{m.asset?.asset_code || 'Snowcat'}</strong></span>
                  <span>Checkins: <strong className="text-emerald-700">{m.checkinCount || 0}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Mission Command Center */}
      {selectedMission && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3 shadow-xs">
          <div className="flex justify-between items-start border-b border-slate-200 pb-2">
            <div>
              <span className="text-[10px] text-sky-700 font-bold block uppercase">MISSION DOSSIER</span>
              <h4 className="text-slate-900 font-bold text-sm">{selectedMission.title}</h4>
              <span className="text-[10px] text-slate-500">
                Corridor: {activeCorridor.name} ({activeCorridor.totalDistanceKm} km)
              </span>
            </div>
            <button
              onClick={() => setSelectedMission(null)}
              className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Last Verified Waypoint Telemetry Snapshot */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500 uppercase font-bold">
                LAST VERIFIED WAYPOINT
              </span>
              <span className="text-[10px] font-mono text-sky-700 font-bold">
                {selectedMission.latestCheckin
                  ? selectedMission.latestCheckin.waypoint_code
                  : 'NO CHECK-IN YET (AT BASE)'}
              </span>
            </div>

            {selectedMission.latestCheckin ? (
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-white p-1.5 rounded border border-slate-200">
                  <span className="text-slate-500 block">Verified At</span>
                  <span className="text-slate-900 font-bold">
                    {new Date(selectedMission.latestCheckin.checkin_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="bg-white p-1.5 rounded border border-slate-200">
                  <span className="text-slate-500 block">Comms Mode</span>
                  <span className="text-emerald-700 font-bold">
                    {selectedMission.latestCheckin.comms_status}
                  </span>
                </div>
                <div className="bg-white p-1.5 rounded border border-slate-200">
                  <span className="text-slate-500 block">Remaining Fuel</span>
                  <span className="text-amber-700 font-bold">
                    {selectedMission.latestCheckin.remaining_fuel_liters !== null
                      ? `${selectedMission.latestCheckin.remaining_fuel_liters} L`
                      : 'Unrecorded'}
                  </span>
                </div>
                <div className="bg-white p-1.5 rounded border border-slate-200">
                  <span className="text-slate-500 block">Ambient Temp</span>
                  <span className="text-sky-700 font-bold">
                    {selectedMission.latestCheckin.ambient_temp_c !== null
                      ? `${selectedMission.latestCheckin.ambient_temp_c}°C`
                      : '--'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-slate-500 italic">
                Awaiting departure confirmation and initial waypoint report.
              </p>
            )}
          </div>

          {/* Surveyed Cryospheric Hazard Proximity */}
          {nearbyHazards.length > 0 && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-rose-700 block">
                Surveyed Cryospheric Hazard Proximity (Scenario)
              </span>
              {nearbyHazards.slice(0, 2).map(({ hazard, distanceKm, isWithinZone }) => (
                <div key={hazard.id} className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-700">
                    {isWithinZone ? '⚠️ IN ZONE:' : '•'} {hazard.name}
                  </span>
                  <span className={`font-bold ${isWithinZone ? 'text-rose-700' : 'text-slate-600'}`}>
                    {distanceKm.toFixed(1)} km away
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Operational Control Buttons (RBAC Gated) */}
          <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-200">
            {selectedMission.status === 'PLANNED' && can('TRAVERSE_MISSION_DISPATCH') && (
              <button
                onClick={() => {
                  setPendingStatus('DISPATCHED');
                  setShowTransitionModal(true);
                }}
                className="flex-1 rounded-lg bg-sky-600 px-3 py-1.5 font-bold text-white hover:bg-sky-700 cursor-pointer text-center shadow-xs"
              >
                🚀 Dispatch Mission
              </button>
            )}

            {(selectedMission.status === 'DISPATCHED' ||
              selectedMission.status === 'EN_ROUTE' ||
              selectedMission.status === 'CHECKIN_OVERDUE') &&
              can('TRAVERSE_CHECKIN_RECORD') && (
                <button
                  onClick={() => setShowCheckinModal(true)}
                  className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-700 cursor-pointer text-center shadow-xs"
                >
                  📍 Log Waypoint Check-in
                </button>
              )}

            {(selectedMission.status === 'EN_ROUTE' || selectedMission.status === 'CHECKIN_OVERDUE') &&
              can('TRAVERSE_MISSION_ABORT_COMPLETE') && (
                <>
                  <button
                    onClick={() => {
                      setPendingStatus('COMPLETED');
                      setShowTransitionModal(true);
                    }}
                    className="flex-1 rounded-lg bg-purple-600 px-2 py-1.5 font-bold text-white hover:bg-purple-700 cursor-pointer text-center shadow-xs"
                  >
                    ✓ Complete
                  </button>
                  <button
                    onClick={() => {
                      setPendingStatus('ABORTED');
                      setShowTransitionModal(true);
                    }}
                    className="flex-1 rounded-lg bg-rose-600 px-2 py-1.5 font-bold text-white hover:bg-rose-700 cursor-pointer text-center shadow-xs"
                  >
                    ✕ Abort
                  </button>
                </>
              )}

            {(selectedMission.status === 'PLANNED' || selectedMission.status === 'DISPATCHED') &&
              can('TRAVERSE_MISSION_ABORT_COMPLETE') && (
                <button
                  onClick={() => {
                    setPendingStatus('CANCELLED');
                    setShowTransitionModal(true);
                  }}
                  className="rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1.5 text-[10px] text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  Cancel Mission
                </button>
              )}
          </div>
        </div>
      )}

      {/* CREATE MISSION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">Create Polar Traverse Mission</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMission} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Mission Code</label>
                <input
                  type="text"
                  value={newMissionCode}
                  onChange={(e) => setNewMissionCode(e.target.value)}
                  placeholder="e.g. TRV-44-MTR-SHELF-02"
                  className="w-full rounded-lg bg-white border border-slate-300 p-2 text-slate-900 focus:border-sky-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Mission Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Emergency Fuel Haul to India Bay"
                  className="w-full rounded-lg bg-white border border-slate-300 p-2 text-slate-900 focus:border-sky-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Surveyed Corridor</label>
                <select
                  value={newCorridorId}
                  onChange={(e) => setNewCorridorId(e.target.value as 'TRV-MTR-SHELF' | 'TRV-BHR-AMERY')}
                  className="w-full rounded-lg bg-white border border-slate-300 p-2 text-slate-900 focus:border-sky-500 focus:outline-none"
                >
                  <option value="TRV-MTR-SHELF">Maitri to Shelf Barrier (104.5 km, Origin: MTR)</option>
                  <option value="TRV-BHR-AMERY">Bharati to Amery Ice Shelf (162.0 km, Origin: BHR)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Lead Vehicle Asset</label>
                  <select
                    value={newLeadAssetId}
                    onChange={(e) => setNewLeadAssetId(e.target.value)}
                    className="w-full rounded-lg bg-white border border-slate-300 p-2 text-slate-900 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="f0000000-0000-0000-0000-000000000001">VEH-PB-01 (PB 300 Polar)</option>
                    <option value="f0000000-0000-0000-0000-000000000002">VEH-PB-02 (PB 100 Scout)</option>
                    <option value="f0000000-0000-0000-0000-000000000008">VEH-CRN-01 (Polar Crane)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Check-in Interval (hrs)</label>
                  <input
                    type="number"
                    value={newCheckinInterval}
                    onChange={(e) => setNewCheckinInterval(e.target.value)}
                    className="w-full rounded-lg bg-white border border-slate-300 p-2 text-slate-900 focus:border-sky-500 focus:outline-none"
                    min="1"
                    max="24"
                    step="0.5"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Scheduled Departure</label>
                <input
                  type="datetime-local"
                  value={newDepartureTime}
                  onChange={(e) => setNewDepartureTime(e.target.value)}
                  className="w-full rounded-lg bg-white border border-slate-300 p-2 text-slate-900 focus:border-sky-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Operational Notes</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Payload summary, radar sounding requirements, weather go/no-go limits..."
                  className="w-full rounded-lg bg-white border border-slate-300 p-2 text-slate-900 focus:border-sky-500 focus:outline-none h-16"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-lg bg-sky-600 px-4 py-1.5 font-bold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {actionLoading ? 'Creating...' : 'Register Mission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD CHECKIN MODAL */}
      {showCheckinModal && selectedMission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Log Waypoint Check-in</h3>
                <span className="text-[10px] text-sky-700 font-bold">{selectedMission.mission_code}</span>
              </div>
              <button
                onClick={() => setShowCheckinModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordCheckin} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Surveyed Waypoint</label>
                <select
                  value={selectedWaypointCode}
                  onChange={(e) => setSelectedWaypointCode(e.target.value)}
                  className="w-full rounded-lg bg-white border border-slate-300 p-2 text-slate-900 focus:border-sky-500 focus:outline-none font-mono"
                  required
                >
                  <option value="">-- Select Waypoint along Corridor --</option>
                  {activeCorridor.waypoints.map((wp) => (
                    <option key={wp.code} value={wp.code}>
                      {wp.code}: {wp.name} ({wp.latitude.toFixed(4)}°, {wp.longitude.toFixed(4)}°)
                      {wp.isFuelCache ? ' [FUEL DEPOT]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Remaining Fuel (Liters)</label>
                  <input
                    type="number"
                    value={checkinFuel}
                    onChange={(e) => setCheckinFuel(e.target.value)}
                    placeholder="e.g. 950"
                    className="w-full rounded-lg bg-white border border-slate-300 p-2 text-slate-900 focus:border-sky-500 focus:outline-none"
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Ambient Temp (°C)</label>
                  <input
                    type="number"
                    value={checkinTemp}
                    onChange={(e) => setCheckinTemp(e.target.value)}
                    placeholder="e.g. -18.5"
                    className="w-full rounded-lg bg-white border border-slate-300 p-2 text-slate-900 focus:border-sky-500 focus:outline-none"
                    step="0.1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Comms Carrier Mode</label>
                  <select
                    value={checkinComms}
                    onChange={(e) => setCheckinComms(e.target.value as CommsStatus)}
                    className="w-full rounded-lg bg-white border border-slate-300 p-2 text-slate-900 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="NOMINAL_HF">HF Radio (Nominal)</option>
                    <option value="IRIDIUM_RUDICS">Iridium Satellite RUDICS</option>
                    <option value="INMARSAT_BGAN">Inmarsat BGAN</option>
                    <option value="DEGRADED_AURORAL">Degraded (Auroral Solar Storm)</option>
                    <option value="BLACKOUT">Comms Blackout</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Operational State</label>
                  <select
                    value={checkinOpStatus}
                    onChange={(e) => setCheckinOpStatus(e.target.value)}
                    className="w-full rounded-lg bg-white border border-slate-300 p-2 text-slate-900 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="NOMINAL">NOMINAL (Proceeding)</option>
                    <option value="HOLDING_WEATHER">HOLDING (Weather/Visibility)</option>
                    <option value="REFUELING">REFUELING AT DEPOT</option>
                    <option value="MECHANICAL_CAUTION">MECHANICAL CAUTION</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Field Assessment &amp; Radar Notes</label>
                <textarea
                  value={checkinHazardNotes}
                  onChange={(e) => setCheckinHazardNotes(e.target.value)}
                  placeholder="Surface condition, blue ice sastrugi, ground-penetrating radar observations..."
                  className="w-full rounded-lg bg-white border border-slate-300 p-2 text-slate-900 focus:border-sky-500 focus:outline-none h-16"
                />
              </div>

              {syncState === 'OFFLINE' && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-[10px] text-amber-800">
                  ⚡ Network connection offline. Check-in will be buffered locally in IndexedDB queue (OFFLINE PENDING SYNC).
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCheckinModal(false)}
                  className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 font-bold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {actionLoading ? 'Logging...' : 'Confirm Check-in'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STATE TRANSITION CONFIRMATION MODAL */}
      {showTransitionModal && selectedMission && pendingStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Confirm Transition: {selectedMission.status} → {pendingStatus}
              </h3>
              <span className="text-[10px] text-sky-700 font-bold">{selectedMission.mission_code}</span>
            </div>

            <p className="text-slate-600 text-xs leading-relaxed font-sans">
              Are you sure you want to transition this mission to{' '}
              <strong className="text-slate-900 font-bold">{pendingStatus}</strong>?
              This state transition will be authoritatively recorded with server-side lifecycle validation.
            </p>

            <div>
              <label className="text-slate-600 block mb-1 font-semibold">Operational Log Entry</label>
              <textarea
                value={transitionNotes}
                onChange={(e) => setTransitionNotes(e.target.value)}
                placeholder="Reason for dispatch, completion report, or abort rationale..."
                className="w-full rounded-lg bg-white border border-slate-300 p-2 text-slate-900 focus:border-sky-500 focus:outline-none h-16"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowTransitionModal(false)}
                className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteTransition}
                disabled={actionLoading}
                className={`rounded-lg px-4 py-1.5 font-bold text-white disabled:opacity-50 cursor-pointer shadow-xs ${
                  pendingStatus === 'ABORTED' || pendingStatus === 'CANCELLED'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-sky-600 hover:bg-sky-700'
                }`}
              >
                {actionLoading ? 'Executing...' : `Confirm ${pendingStatus}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
