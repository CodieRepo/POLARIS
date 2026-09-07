export type TraverseMissionStatus =
  | 'PLANNED'
  | 'DISPATCHED'
  | 'EN_ROUTE'
  | 'CHECKIN_OVERDUE'
  | 'COMPLETED'
  | 'ABORTED'
  | 'CANCELLED';

export type CommsStatus =
  | 'NOMINAL_HF'
  | 'IRIDIUM_RUDICS'
  | 'INMARSAT_BGAN'
  | 'DEGRADED_AURORAL'
  | 'BLACKOUT';

export interface TraverseMissionRow {
  id: string;
  mission_code: string;
  title: string;
  corridor_id: string;
  origin_station_id: string;
  destination_station_id: string | null;
  expedition_id: string;
  lead_person_id: string;
  lead_asset_id: string;
  status: TraverseMissionStatus;
  scheduled_departure_at: string;
  actual_departure_at: string | null;
  completed_at: string | null;
  aborted_at: string | null;
  cancelled_at: string | null;
  checkin_interval_hours: number;
  operational_notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TraverseCheckinRow {
  id: string;
  mission_id: string;
  waypoint_code: string;
  latitude: number;
  longitude: number;
  checkin_at: string;
  remaining_fuel_liters: number | null;
  ambient_temp_c: number | null;
  comms_status: CommsStatus;
  operational_status: string;
  hazard_assessment_notes: string | null;
  recorded_by: string;
  created_at: string;
}

export interface CreateMissionPayload {
  mission_code: string;
  title: string;
  corridor_id: string;
  origin_station_id: string;
  destination_station_id?: string | null;
  expedition_id: string;
  lead_person_id: string;
  lead_asset_id: string;
  scheduled_departure_at: string;
  checkin_interval_hours?: number;
  operational_notes?: string | null;
}

export interface RecordCheckinPayload {
  waypoint_code: string;
  latitude: number;
  longitude: number;
  checkin_at?: string;
  remaining_fuel_liters?: number | null;
  ambient_temp_c?: number | null;
  comms_status?: CommsStatus;
  operational_status?: string;
  hazard_assessment_notes?: string | null;
}

export interface TraverseMissionWithDetails extends TraverseMissionRow {
  originStation?: { id: string; code: string; name: string };
  destinationStation?: { id: string; code: string; name: string } | null;
  expedition?: { id: string; code: string; name: string };
  leader?: { id: string; display_name: string; role_title: string | null };
  asset?: { id: string; asset_code: string; name: string; category: string };
  latestCheckin?: TraverseCheckinRow | null;
  checkinCount?: number;
  isOverdue?: boolean;
}
