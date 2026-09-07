-- ==============================================================================
-- POLARIS Polar Traverse & Field Mission Command Schema
-- Migration: 20260907150000_create_polar_traverse_missions_schema.sql
-- Description:
--   Establishes field traverse mission dispatch and waypoint check-in tables:
--     1. traverse_mission_status & comms_status enums
--     2. traverse_missions: Corridor dispatch tracking & lifecycle state machine
--     3. traverse_checkins: Last verified waypoint check-in telemetry snapshots
--     4. Strict scoped Row-Level Security (RLS) policies
-- ==============================================================================

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE traverse_mission_status AS ENUM (
        'PLANNED',
        'DISPATCHED',
        'EN_ROUTE',
        'CHECKIN_OVERDUE',
        'COMPLETED',
        'ABORTED',
        'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE comms_status AS ENUM (
        'NOMINAL_HF',
        'IRIDIUM_RUDICS',
        'INMARSAT_BGAN',
        'DEGRADED_AURORAL',
        'BLACKOUT'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- 2. TRAVERSE MISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.traverse_missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    corridor_id TEXT NOT NULL,
    origin_station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE RESTRICT,
    destination_station_id UUID REFERENCES public.stations(id) ON DELETE RESTRICT,
    expedition_id UUID NOT NULL REFERENCES public.expeditions(id) ON DELETE RESTRICT,
    lead_person_id UUID NOT NULL REFERENCES public.persons(id) ON DELETE RESTRICT,
    lead_asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
    status traverse_mission_status NOT NULL DEFAULT 'PLANNED',
    scheduled_departure_at TIMESTAMPTZ NOT NULL,
    actual_departure_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    aborted_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    checkin_interval_hours NUMERIC(4, 2) NOT NULL DEFAULT 6.00,
    operational_notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT traverse_missions_checkin_interval_check CHECK (checkin_interval_hours > 0)
);

CREATE INDEX IF NOT EXISTS idx_traverse_missions_expedition ON public.traverse_missions(expedition_id);
CREATE INDEX IF NOT EXISTS idx_traverse_missions_status ON public.traverse_missions(status);
CREATE INDEX IF NOT EXISTS idx_traverse_missions_corridor ON public.traverse_missions(corridor_id);


-- 3. TRAVERSE CHECKINS TABLE (Last Verified Waypoint Snapshots)
CREATE TABLE IF NOT EXISTS public.traverse_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES public.traverse_missions(id) ON DELETE CASCADE,
    waypoint_code TEXT NOT NULL,
    latitude NUMERIC(9, 6) NOT NULL,
    longitude NUMERIC(9, 6) NOT NULL,
    checkin_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    remaining_fuel_liters NUMERIC(10, 2),
    ambient_temp_c NUMERIC(5, 2),
    comms_status comms_status NOT NULL DEFAULT 'NOMINAL_HF',
    operational_status TEXT NOT NULL DEFAULT 'NOMINAL',
    hazard_assessment_notes TEXT,
    recorded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_traverse_checkins_mission_time ON public.traverse_checkins(mission_id, checkin_at DESC);


-- 4. ROW LEVEL SECURITY
ALTER TABLE public.traverse_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traverse_checkins ENABLE ROW LEVEL SECURITY;

-- 4.1 TRAVERSE MISSIONS POLICIES (Strict role + scope checking)
CREATE POLICY "traverse_missions_select"
  ON public.traverse_missions
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "traverse_missions_insert"
  ON public.traverse_missions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin() OR public.is_expedition_manager_for(expedition_id)
  );

CREATE POLICY "traverse_missions_update"
  ON public.traverse_missions
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin() OR 
    public.is_expedition_manager_for(expedition_id) OR
    (public.current_user_role() = 'STATION_OPERATOR' AND EXISTS (
      SELECT 1 FROM public.stations s WHERE s.id = origin_station_id
    ))
  )
  WITH CHECK (
    public.is_admin() OR 
    public.is_expedition_manager_for(expedition_id) OR
    (public.current_user_role() = 'STATION_OPERATOR' AND EXISTS (
      SELECT 1 FROM public.stations s WHERE s.id = origin_station_id
    ))
  );

CREATE POLICY "traverse_missions_delete"
  ON public.traverse_missions
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'SUPER_ADMIN' AND status = 'PLANNED');


-- 4.2 TRAVERSE CHECKINS POLICIES (Strict role + scope checking)
CREATE POLICY "traverse_checkins_select"
  ON public.traverse_checkins
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "traverse_checkins_insert"
  ON public.traverse_checkins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin() OR 
    public.current_user_role() IN ('EXPEDITION_MANAGER', 'STATION_OPERATOR')
  );

CREATE POLICY "traverse_checkins_update"
  ON public.traverse_checkins
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "traverse_checkins_delete"
  ON public.traverse_checkins
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'SUPER_ADMIN');


-- 5. SEED SCENARIO TRAVERSE MISSIONS & INITIAL VERIFIED WAYPOINTS
INSERT INTO public.traverse_missions (
  id,
  mission_code,
  title,
  corridor_id,
  origin_station_id,
  destination_station_id,
  expedition_id,
  lead_person_id,
  lead_asset_id,
  status,
  scheduled_departure_at,
  actual_departure_at,
  checkin_interval_hours,
  operational_notes
) VALUES
  (
    'e0000000-0000-0000-0000-000000000001',
    'TRV-44-MTR-SHELF-01',
    'Maitri to India Bay Ice Shelf Resupply Run',
    'TRV-MTR-SHELF',
    'b0000000-0000-0000-0000-000000000002', -- MTR
    NULL,
    'd0000000-0000-0000-0000-000000000001', -- ISEA-44
    'c0000000-0000-0000-0000-000000000002', -- Cmdr. Vikram Shekhawat
    'f0000000-0000-0000-0000-000000000001', -- VEH-PB-01
    'EN_ROUTE',
    now() - interval '18 hours',
    now() - interval '16 hours',
    6.00,
    'Heavy sled hauling 4x fuel drums and generator maintenance spares to shelf depot.'
  ),
  (
    'e0000000-0000-0000-0000-000000000002',
    'TRV-44-BHR-AMERY-01',
    'Bharati-Amery Deep Ice Core Reconnaissance',
    'TRV-BHR-AMERY',
    'b0000000-0000-0000-0000-000000000001', -- BHR
    NULL,
    'd0000000-0000-0000-0000-000000000001', -- ISEA-44
    'c0000000-0000-0000-0000-000000000001', -- Dr. Rajesh Nair
    'f0000000-0000-0000-0000-000000000002', -- VEH-PB-02
    'PLANNED',
    now() + interval '24 hours',
    NULL,
    6.00,
    'Glaciological radar sounding along shear margin to establish seasonal science camp.'
  )
ON CONFLICT (mission_code) DO NOTHING;

-- Seed initial check-ins for TRV-44-MTR-SHELF-01
INSERT INTO public.traverse_checkins (
  id,
  mission_id,
  waypoint_code,
  latitude,
  longitude,
  checkin_at,
  remaining_fuel_liters,
  ambient_temp_c,
  comms_status,
  operational_status,
  hazard_assessment_notes
) VALUES
  (
    'e1000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000001',
    'WP-MTR-01',
    -70.7667,
    11.7333,
    now() - interval '16 hours',
    1200.00,
    -14.2,
    'NOMINAL_HF',
    'NOMINAL',
    'Moraine departure clear. Ground radar active.'
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'e0000000-0000-0000-0000-000000000001',
    'WP-MTR-02',
    -70.6500,
    11.8000,
    now() - interval '10 hours',
    1110.00,
    -16.8,
    'NOMINAL_HF',
    'NOMINAL',
    'Blue ice zone navigated without incident. Crevasse radar clear.'
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'e0000000-0000-0000-0000-000000000001',
    'WP-MTR-03',
    -70.5000,
    11.8833,
    now() - interval '3 hours',
    1020.00,
    -19.1,
    'IRIDIUM_RUDICS',
    'NOMINAL',
    'Arrived at Intermediate Depot cache. Refueling check nominal.'
  )
ON CONFLICT (id) DO NOTHING;
