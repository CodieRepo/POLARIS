import { createServerClient } from '@/infrastructure/db/supabase-server';
import type {
  TraverseMissionRow,
  TraverseCheckinRow,
  TraverseMissionWithDetails,
  CreateMissionPayload,
  RecordCheckinPayload,
  TraverseMissionStatus,
} from './types';
import { TraverseStateMachine } from './traverse-state-machine';

export class TraverseRepository {
  /**
   * Retrieves all traverse missions with resolved relations and latest verified check-in snapshot.
   */
  public static async listMissions(): Promise<TraverseMissionWithDetails[]> {
    const supabase = createServerClient();

    const [missionsRes, stationsRes, expeditionsRes, personsRes, assetsRes, checkinsRes] =
      await Promise.all([
        supabase
          .from('traverse_missions')
          .select('*')
          .order('scheduled_departure_at', { ascending: false }),
        supabase.from('stations').select('id, code, name'),
        supabase.from('expeditions').select('id, code, name'),
        supabase.from('persons').select('id, display_name, role_title'),
        supabase.from('assets').select('id, asset_code, name, category'),
        supabase
          .from('traverse_checkins')
          .select('*')
          .order('checkin_at', { ascending: false }),
      ]);

    if (missionsRes.error) {
      throw new Error(`Failed to list traverse missions: ${missionsRes.error.message}`);
    }

    const missions: TraverseMissionRow[] = (missionsRes.data || []) as unknown as TraverseMissionRow[];
    const stationsMap = new Map((stationsRes.data || []).map((s) => [s.id, s]));
    const expeditionsMap = new Map((expeditionsRes.data || []).map((e) => [e.id, e]));
    const personsMap = new Map((personsRes.data || []).map((p) => [p.id, p]));
    const assetsMap = new Map((assetsRes.data || []).map((a) => [a.id, a]));

    const checkinsByMission = new Map<string, TraverseCheckinRow[]>();
    for (const c of (checkinsRes.data || []) as unknown as TraverseCheckinRow[]) {
      const list = checkinsByMission.get(c.mission_id) || [];
      list.push(c);
      checkinsByMission.set(c.mission_id, list);
    }

    return missions.map((m) => {
      const missionCheckins = checkinsByMission.get(m.id) || [];
      const latestCheckin = missionCheckins.length > 0 ? missionCheckins[0] : null;
      const isOverdue = TraverseStateMachine.isCheckinOverdue(m, latestCheckin);

      return {
        ...m,
        originStation: stationsMap.get(m.origin_station_id),
        destinationStation: m.destination_station_id ? stationsMap.get(m.destination_station_id) : null,
        expedition: expeditionsMap.get(m.expedition_id),
        leader: personsMap.get(m.lead_person_id),
        asset: assetsMap.get(m.lead_asset_id),
        latestCheckin,
        checkinCount: missionCheckins.length,
        isOverdue,
      };
    });
  }

  /**
   * Retrieves a single traverse mission by ID with full chronological check-in ledger.
   */
  public static async getMissionById(
    id: string
  ): Promise<{ mission: TraverseMissionWithDetails; checkins: TraverseCheckinRow[] } | null> {
    const supabase = createServerClient();

    const { data: mission, error: mErr } = await supabase
      .from('traverse_missions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (mErr) {
      throw new Error(`Failed to fetch mission: ${mErr.message}`);
    }
    if (!mission) return null;

    const typedMission = mission as unknown as TraverseMissionRow;

    const [stationRes, destStationRes, expRes, personRes, assetRes, checkinsRes] =
      await Promise.all([
        supabase.from('stations').select('id, code, name').eq('id', typedMission.origin_station_id).maybeSingle(),
        typedMission.destination_station_id
          ? supabase.from('stations').select('id, code, name').eq('id', typedMission.destination_station_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('expeditions').select('id, code, name').eq('id', typedMission.expedition_id).maybeSingle(),
        supabase.from('persons').select('id, display_name, role_title').eq('id', typedMission.lead_person_id).maybeSingle(),
        supabase.from('assets').select('id, asset_code, name, category').eq('id', typedMission.lead_asset_id).maybeSingle(),
        supabase
          .from('traverse_checkins')
          .select('*')
          .eq('mission_id', id)
          .order('checkin_at', { ascending: false }),
      ]);

    const checkins = (checkinsRes.data || []) as unknown as TraverseCheckinRow[];
    const latestCheckin = checkins.length > 0 ? checkins[0] : null;
    const isOverdue = TraverseStateMachine.isCheckinOverdue(typedMission, latestCheckin);

    const detailedMission: TraverseMissionWithDetails = {
      ...typedMission,
      originStation: stationRes.data || undefined,
      destinationStation: destStationRes.data || null,
      expedition: expRes.data || undefined,
      leader: personRes.data || undefined,
      asset: assetRes.data || undefined,
      latestCheckin,
      checkinCount: checkins.length,
      isOverdue,
    };

    return { mission: detailedMission, checkins };
  }

  /**
   * Creates a new field traverse mission in PLANNED state.
   */
  public static async createMission(
    payload: CreateMissionPayload,
    userId: string
  ): Promise<TraverseMissionRow> {
    const supabase = createServerClient();

    const insertData = {
      mission_code: payload.mission_code,
      title: payload.title,
      corridor_id: payload.corridor_id,
      origin_station_id: payload.origin_station_id,
      destination_station_id: payload.destination_station_id || null,
      expedition_id: payload.expedition_id,
      lead_person_id: payload.lead_person_id,
      lead_asset_id: payload.lead_asset_id,
      status: 'PLANNED' as TraverseMissionStatus,
      scheduled_departure_at: payload.scheduled_departure_at,
      checkin_interval_hours: payload.checkin_interval_hours || 6.0,
      operational_notes: payload.operational_notes || null,
      created_by: userId,
    };

    const { data, error } = await supabase
      .from('traverse_missions')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create traverse mission: ${error.message}`);
    }

    return data as unknown as TraverseMissionRow;
  }

  /**
   * Authoritatively updates mission status using the state machine.
   */
  public static async transitionMissionStatus(
    missionId: string,
    targetStatus: TraverseMissionStatus,
    notes?: string
  ): Promise<TraverseMissionRow> {
    const supabase = createServerClient();

    const { data: existing, error: fetchErr } = await supabase
      .from('traverse_missions')
      .select('*')
      .eq('id', missionId)
      .single();

    if (fetchErr || !existing) {
      throw new Error(`Mission not found: ${fetchErr?.message || missionId}`);
    }

    const currentStatus = existing.status as TraverseMissionStatus;

    // Validate transition via authoritative state machine
    TraverseStateMachine.assertValidTransition(currentStatus, targetStatus);

    const now = new Date().toISOString();
    const updateData: Partial<TraverseMissionRow> & { updated_at: string } = {
      status: targetStatus,
      updated_at: now,
    };

    if (notes) {
      updateData.operational_notes = existing.operational_notes
        ? `${existing.operational_notes}\n[${now}] Status changed to ${targetStatus}: ${notes}`
        : `[${now}] Status changed to ${targetStatus}: ${notes}`;
    }

    if (targetStatus === 'EN_ROUTE' && !existing.actual_departure_at) {
      updateData.actual_departure_at = now;
    } else if (targetStatus === 'COMPLETED') {
      updateData.completed_at = now;
    } else if (targetStatus === 'ABORTED') {
      updateData.aborted_at = now;
    } else if (targetStatus === 'CANCELLED') {
      updateData.cancelled_at = now;
    }

    const { data, error } = await supabase
      .from('traverse_missions')
      .update(updateData)
      .eq('id', missionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to transition mission status: ${error.message}`);
    }

    return data as unknown as TraverseMissionRow;
  }

  /**
   * Records a waypoint check-in snapshot.
   * If the mission was DISPATCHED, advances it to EN_ROUTE upon first check-in.
   * If the mission was CHECKIN_OVERDUE, returns it to EN_ROUTE upon receiving verified check-in.
   */
  public static async recordCheckin(
    missionId: string,
    payload: RecordCheckinPayload,
    userId: string
  ): Promise<TraverseCheckinRow> {
    const supabase = createServerClient();

    const { data: mission, error: mErr } = await supabase
      .from('traverse_missions')
      .select('*')
      .eq('id', missionId)
      .single();

    if (mErr || !mission) {
      throw new Error(`Target mission not found: ${mErr?.message || missionId}`);
    }

    const insertData = {
      mission_id: missionId,
      waypoint_code: payload.waypoint_code,
      latitude: payload.latitude,
      longitude: payload.longitude,
      checkin_at: payload.checkin_at || new Date().toISOString(),
      remaining_fuel_liters: payload.remaining_fuel_liters !== undefined ? payload.remaining_fuel_liters : null,
      ambient_temp_c: payload.ambient_temp_c !== undefined ? payload.ambient_temp_c : null,
      comms_status: payload.comms_status || 'NOMINAL_HF',
      operational_status: payload.operational_status || 'NOMINAL',
      hazard_assessment_notes: payload.hazard_assessment_notes || null,
      recorded_by: userId,
    };

    const { data: checkin, error: cErr } = await supabase
      .from('traverse_checkins')
      .insert(insertData)
      .select()
      .single();

    if (cErr) {
      throw new Error(`Failed to record traverse check-in: ${cErr.message}`);
    }

    // Auto-advance or restore mission status on check-in
    if (mission.status === 'DISPATCHED') {
      await this.transitionMissionStatus(missionId, 'EN_ROUTE', `First waypoint check-in logged at ${payload.waypoint_code}`);
    } else if (mission.status === 'CHECKIN_OVERDUE') {
      await this.transitionMissionStatus(missionId, 'EN_ROUTE', `Check-in restored at ${payload.waypoint_code}`);
    }

    return checkin as unknown as TraverseCheckinRow;
  }
}
