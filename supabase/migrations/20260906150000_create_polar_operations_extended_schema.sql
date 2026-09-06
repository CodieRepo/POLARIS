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


-- 8. ROW-LEVEL SECURITY
ALTER TABLE public.station_fuel_tanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_sitreps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_telemetry_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_incidents ENABLE ROW LEVEL SECURITY;

-- Public read policies for operational visibility
DO $$ BEGIN
    CREATE POLICY "Allow public read on station_fuel_tanks" ON public.station_fuel_tanks FOR SELECT USING (true);
    CREATE POLICY "Allow public read on daily_sitreps" ON public.daily_sitreps FOR SELECT USING (true);
    CREATE POLICY "Allow public read on weather_telemetry_history" ON public.weather_telemetry_history FOR SELECT USING (true);
    CREATE POLICY "Allow public read on cargo_containers" ON public.cargo_containers FOR SELECT USING (true);
    CREATE POLICY "Allow public read on operational_alerts" ON public.operational_alerts FOR SELECT USING (true);
    CREATE POLICY "Allow public read on safety_incidents" ON public.safety_incidents FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Authenticated write policies for SITREPs
DO $$ BEGIN
    CREATE POLICY "Allow authenticated insert on daily_sitreps" ON public.daily_sitreps
    FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
