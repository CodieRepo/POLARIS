-- ==============================================================================
-- POLARIS Extended Polar Operations Schema
-- Migration: create_polar_operations_extended_schema
-- Description:
--   Establishes authentic operational domains:
--     1. station_fuel_tanks: Bulk fuel tanks, dips, and autonomy tracking
--     2. daily_sitreps: Station Commander Daily Situation Reports
--     3. weather_telemetry_history: Time-series meteorological observations
--     4. cargo_containers & cargo_manifests: Maritime & air resupply tracking
--     5. operational_alerts: Persistent threshold-driven alert records
--     6. safety_incidents: COMNAP polar safety & incident logs
-- ==============================================================================

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE fuel_type AS ENUM ('ARCTIC_HSD', 'JET_A1', 'LUBE_OIL', 'MOGAS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE tank_type AS ENUM ('MAIN_BULK', 'DAY_TANK', 'RESERVE_CACHE', 'MOBILE_BOWSER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE outdoor_clearance_status AS ENUM ('GREEN_NORMAL', 'YELLOW_RESTRICTED', 'RED_LOCKDOWN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE cargo_container_type AS ENUM ('ISO_20FT_DRY', 'ISO_20FT_REEFER', 'BREAKBULK_PALLET', 'HAZMAT_DRUM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE logistics_transit_stage AS ENUM ('GOA_MOBILIZATION', 'CAPE_TOWN_BUNKERING', 'SOUTHERN_OCEAN_TRANSIT', 'ICE_SHELF_BARRIER', 'STATION_DELIVERED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE alert_severity AS ENUM ('INFO', 'WATCH', 'WARNING', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE alert_status AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE incident_type AS ENUM ('COLD_INJURY', 'EQUIPMENT_FAILURE', 'FIRE_ALARM', 'VEHICLE_BREAKDOWN', 'CREVASSE_HAZARD', 'COMMS_BLACKOUT', 'FUEL_SPILL');
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- 2. STATION FUEL TANKS
CREATE TABLE IF NOT EXISTS public.station_fuel_tanks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE RESTRICT,
    tank_code TEXT NOT NULL,
    tank_name TEXT NOT NULL,
    tank_type tank_type NOT NULL DEFAULT 'MAIN_BULK',
    fuel_type fuel_type NOT NULL DEFAULT 'ARCTIC_HSD',
    capacity_liters NUMERIC(12, 2) NOT NULL,
    current_level_liters NUMERIC(12, 2) NOT NULL,
    daily_burn_rate_liters NUMERIC(10, 2) NOT NULL DEFAULT 320.00,
    last_dip_reading_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT station_fuel_tanks_station_tank_unique UNIQUE (station_id, tank_code),
    CONSTRAINT station_fuel_tanks_capacity_check CHECK (capacity_liters > 0),
    CONSTRAINT station_fuel_tanks_level_check CHECK (current_level_liters >= 0 AND current_level_liters <= capacity_liters)
);


-- 3. DAILY SITREPS
CREATE TABLE IF NOT EXISTS public.daily_sitreps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE RESTRICT,
    report_date DATE NOT NULL,
    submitted_by UUID REFERENCES auth.users(id),
    commander_name TEXT NOT NULL,
    signer_identity TEXT NOT NULL DEFAULT 'STATION_COMMANDER',
    integrity_hash TEXT NOT NULL,
    winter_over_headcount INT NOT NULL DEFAULT 0,
    summer_science_headcount INT NOT NULL DEFAULT 0,
    transient_headcount INT NOT NULL DEFAULT 0,
    min_temp_c NUMERIC(5, 2),
    max_temp_c NUMERIC(5, 2),
    peak_wind_kmh NUMERIC(5, 2),
    pressure_hpa NUMERIC(6, 2),
    pressure_trend_6h NUMERIC(5, 2) DEFAULT 0.0,
    fuel_consumed_24h_liters NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
    generator_runtime_hours NUMERIC(6, 2) NOT NULL DEFAULT 24.0,
    outdoor_status outdoor_clearance_status NOT NULL DEFAULT 'GREEN_NORMAL',
    operational_remarks TEXT,
    signed_off_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT daily_sitreps_station_date_unique UNIQUE (station_id, report_date)
);


-- 4. WEATHER TELEMETRY HISTORY (Time-Series Observations)
CREATE TABLE IF NOT EXISTS public.weather_telemetry_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_code TEXT NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    temperature_c NUMERIC(5, 2) NOT NULL,
    relative_humidity_pct NUMERIC(5, 2),
    pressure_hpa NUMERIC(6, 2) NOT NULL,
    wind_speed_kmh NUMERIC(5, 2) NOT NULL,
    apparent_temp_c NUMERIC(5, 2) NOT NULL,
    solar_elevation_deg NUMERIC(5, 2),
    provenance_tier TEXT NOT NULL DEFAULT 'OBSERVED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weather_hist_station_time ON public.weather_telemetry_history(station_code, observed_at DESC);


-- 5. CARGO CONTAINERS & VOYAGE LOGISTICS
CREATE TABLE IF NOT EXISTS public.cargo_containers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    container_id TEXT NOT NULL UNIQUE,
    expedition_id UUID REFERENCES public.expeditions(id),
    destination_station_id UUID REFERENCES public.stations(id),
    container_type cargo_container_type NOT NULL DEFAULT 'ISO_20FT_DRY',
    tare_weight_kg NUMERIC(8, 2) NOT NULL DEFAULT 2200.0,
    payload_weight_kg NUMERIC(8, 2) NOT NULL,
    manifest_description TEXT NOT NULL,
    transit_stage logistics_transit_stage NOT NULL DEFAULT 'GOA_MOBILIZATION',
    vessel_name TEXT DEFAULT 'MV Vasily Golovnin',
    voyage_number TEXT DEFAULT 'ISEA-44-SEA',
    priority TEXT NOT NULL DEFAULT 'ROUTINE',
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- 6. OPERATIONAL ALERTS
CREATE TABLE IF NOT EXISTS public.operational_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID REFERENCES public.stations(id),
    severity alert_severity NOT NULL DEFAULT 'WATCH',
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    details TEXT NOT NULL,
    status alert_status NOT NULL DEFAULT 'ACTIVE',
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- 7. SAFETY & INCIDENT RECORDS
CREATE TABLE IF NOT EXISTS public.safety_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID REFERENCES public.stations(id),
    incident_type incident_type NOT NULL,
    severity alert_severity NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reported_by TEXT NOT NULL,
    description TEXT NOT NULL,
    actions_taken TEXT NOT NULL,
    resolution_status TEXT NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- 8. ROW-LEVEL SECURITY & POLICIES
ALTER TABLE public.station_fuel_tanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_sitreps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_telemetry_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_incidents ENABLE ROW LEVEL SECURITY;

-- Operational read policies (accessible to public and authenticated)
DO $$ BEGIN
    CREATE POLICY "Allow public read on station_fuel_tanks" ON public.station_fuel_tanks FOR SELECT USING (true);
    CREATE POLICY "Allow public read on daily_sitreps" ON public.daily_sitreps FOR SELECT USING (true);
    CREATE POLICY "Allow public read on weather_telemetry_history" ON public.weather_telemetry_history FOR SELECT USING (true);
    CREATE POLICY "Allow public read on cargo_containers" ON public.cargo_containers FOR SELECT USING (true);
    CREATE POLICY "Allow public read on operational_alerts" ON public.operational_alerts FOR SELECT USING (true);
    CREATE POLICY "Allow public read on safety_incidents" ON public.safety_incidents FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Operational write & mutation policies
DO $$ BEGIN
    CREATE POLICY "Allow insert on daily_sitreps" ON public.daily_sitreps FOR INSERT WITH CHECK (true);
    CREATE POLICY "Allow update on station_fuel_tanks" ON public.station_fuel_tanks FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY "Allow insert on weather_telemetry_history" ON public.weather_telemetry_history FOR INSERT WITH CHECK (true);
    CREATE POLICY "Allow update on operational_alerts" ON public.operational_alerts FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY "Allow insert on operational_alerts" ON public.operational_alerts FOR INSERT WITH CHECK (true);
    CREATE POLICY "Allow update on cargo_containers" ON public.cargo_containers FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- 9. SEED OPERATIONAL BASELINE & SCENARIO RECORDS
-- 9.1 Station Fuel Tanks
INSERT INTO public.station_fuel_tanks (id, station_id, tank_code, tank_name, tank_type, fuel_type, capacity_liters, current_level_liters, daily_burn_rate_liters, last_dip_reading_at)
VALUES
  -- Bharati Station (b0000000-0000-0000-0000-000000000001)
  ('70000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'BHR-TK-01', 'Main Bulk Fuel Farm Alpha', 'MAIN_BULK', 'ARCTIC_HSD', 150000.00, 122400.00, 320.00, now() - interval '4 hours'),
  ('70000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'BHR-TK-02', 'Main Bulk Fuel Farm Bravo', 'MAIN_BULK', 'ARCTIC_HSD', 50000.00, 38000.00, 0.00, now() - interval '4 hours'),
  ('70000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'BHR-TK-03', 'Generator Day Tank (Active)', 'DAY_TANK', 'ARCTIC_HSD', 10000.00, 8200.00, 160.00, now() - interval '1 hour'),
  ('70000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'BHR-TK-04', 'Aviation Fuel Cache (Helicopter)', 'RESERVE_CACHE', 'JET_A1', 40000.00, 29800.00, 0.00, now() - interval '8 hours'),
  -- Maitri Station (b0000000-0000-0000-0000-000000000002)
  ('70000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'MTR-TK-01', 'Maitri Central Storage Tank', 'MAIN_BULK', 'ARCTIC_HSD', 120000.00, 92500.00, 280.00, now() - interval '5 hours'),
  ('70000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000002', 'MTR-TK-02', 'Power House Day Tank', 'DAY_TANK', 'ARCTIC_HSD', 20000.00, 16000.00, 140.00, now() - interval '2 hours'),
  ('70000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000002', 'MTR-TK-03', 'Traverse & Emergency Reserve', 'RESERVE_CACHE', 'ARCTIC_HSD', 40000.00, 28000.00, 0.00, now() - interval '12 hours'),
  -- Himadri Station (b0000000-0000-0000-0000-000000000003)
  ('70000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000003', 'HMD-TK-01', 'Emergency Generator Day Tank', 'DAY_TANK', 'ARCTIC_HSD', 15000.00, 12800.00, 45.00, now() - interval '6 hours')
ON CONFLICT (station_id, tank_code) DO NOTHING;

-- 9.2 Cargo Containers (ISEA-44 Expedition d0000000-0000-0000-0000-000000000001)
INSERT INTO public.cargo_containers (id, container_id, expedition_id, destination_station_id, container_type, tare_weight_kg, payload_weight_kg, manifest_description, transit_stage, vessel_name, voyage_number, priority)
VALUES
  ('80000000-0000-0000-0000-000000000001', 'IND-POL-2026-01', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'ISO_20FT_REEFER', 2850.00, 14200.00, 'Winter-over temperature-controlled provisions (Frozen meats, dairy, fresh vegetables buffer)', 'SOUTHERN_OCEAN_TRANSIT', 'MV Vasily Golovnin', 'ISEA-44-SEA', 'COLD_CHAIN'),
  ('80000000-0000-0000-0000-000000000002', 'IND-POL-2026-02', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'ISO_20FT_DRY', 2200.00, 11800.00, 'PistenBully PB300 spare track belts, hydraulic cylinder kits, and Arctic low-temp filters', 'SOUTHERN_OCEAN_TRANSIT', 'MV Vasily Golovnin', 'ISEA-44-SEA', 'MISSION_CRITICAL'),
  ('80000000-0000-0000-0000-000000000003', 'IND-POL-2026-03', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'ISO_20FT_DRY', 2200.00, 9400.00, 'Cummins QSB6.7 generator alternator replacement rotor and electronic governor modules', 'SOUTHERN_OCEAN_TRANSIT', 'MV Vasily Golovnin', 'ISEA-44-SEA', 'MISSION_CRITICAL'),
  ('80000000-0000-0000-0000-000000000004', 'IND-POL-2026-04', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'HAZMAT_DRUM', 1800.00, 12500.00, '55-gallon steel drums of Shell Tellus Arctic 32 hydraulic fluid and low-pour diesel additives', 'CAPE_TOWN_BUNKERING', 'MV Vasily Golovnin', 'ISEA-44-SEA', 'ROUTINE'),
  ('80000000-0000-0000-0000-000000000005', 'IND-POL-2026-05', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'ISO_20FT_DRY', 2200.00, 8100.00, 'Deep Ice Core Drilling System (NCPOR Glaciology Lab) and thermal drilling fluid coils', 'STATION_DELIVERED', 'MV Vasily Golovnin', 'ISEA-44-SEA', 'ROUTINE')
ON CONFLICT (container_id) DO NOTHING;

-- 9.3 Operational Alerts
INSERT INTO public.operational_alerts (id, station_id, severity, category, title, details, status, triggered_at)
VALUES
  ('90000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'WATCH', 'METEOROLOGICAL', 'Surface Wind Blizzard Watch Active', 'In-situ AWS reporting surface wind speed > 38 km/h at Larsemann Hills. Field traverse operations restricted; outdoor movement requires buddy-system.', 'ACTIVE', now() - interval '3 hours'),
  ('90000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'INFO', 'POWER_SYSTEMS', 'Hydraulic Crane Maintenance In-Progress', 'VEH-CRN-01 All-Terrain Polar Crane undergoing scheduled sub-zero hydraulic fluid flush and boom seal replacement by Heavy Plant Engineers.', 'ACTIVE', now() - interval '18 hours'),
  ('90000000-0000-0000-0000-000000000003', NULL, 'WARNING', 'TRAVERSE', 'Sorsdal Glacier Crevasse Shear Margin Warning', 'Tidal shear margin flexing detected along Amery transect. Convoy routing restricted to verified radar-sounded waypoints.', 'ACTIVE', now() - interval '24 hours')
ON CONFLICT (id) DO NOTHING;

-- 9.4 Baseline Historical SITREPs
INSERT INTO public.daily_sitreps (id, station_id, report_date, commander_name, signer_identity, integrity_hash, winter_over_headcount, summer_science_headcount, transient_headcount, min_temp_c, max_temp_c, peak_wind_kmh, pressure_hpa, pressure_trend_6h, fuel_consumed_24h_liters, generator_runtime_hours, outdoor_status, operational_remarks, signed_off_at)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '2026-09-05', 'Cmdr. Vikram Shekhawat', 'STATION_COMMANDER_BHR', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 24, 18, 0, -16.20, -11.40, 46.50, 984.20, -2.10, 480.00, 24.00, 'YELLOW_RESTRICTED', 'Blizzard watch active due to 46 km/h surface wind gusts. Heavy snow clearing around main modules completed. Prime Generator 1 running nominal on Day Tank 3.', now() - interval '1 day'),
  ('a1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', '2026-09-05', 'Dr. Rajesh Nair', 'EXPEDITION_LEADER_MTR', '8294c7989eb25e4c767db326e0e02c526d11e4bf3cb306a4bc4d46cfc6109961', 19, 0, 2, -18.50, -12.00, 28.00, 976.00, 0.50, 420.00, 24.00, 'GREEN_NORMAL', 'Priyadarshini Lake water pumping line operational with electric trace heating. Vehicle crane VEH-CRN-01 sub-zero hydraulic fluid replacement ongoing.', now() - interval '1 day')
ON CONFLICT (station_id, report_date) DO NOTHING;

