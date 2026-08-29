-- ==============================================================================
-- POLARIS Core Reference Database Schema
-- Migration: create_core_reference_schema
--
-- Description:
--   Establishes core reference entities:
--     1. data_sources: Provenance and external data provider metadata
--     2. station_status: Operational state enum for polar research stations
--     3. stations: Master registry for polar research stations and field bases
--
-- Architectural Rules:
--   - Plain numeric latitude/longitude with PostgreSQL CHECK constraints
--   - No PostGIS
--   - No RLS policies in this migration (deferred to auth milestone)
--   - No seed data in this migration (deferred to seed milestone)
-- ==============================================================================

-- 1. DATA SOURCES
-- Tracks authoritative and external data provenance (e.g., NCPOR/NPDC, ERA5, NSIDC).
CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    dataset_name TEXT,
    dataset_version TEXT,
    source_type TEXT,
    base_url TEXT,
    license_name TEXT,
    attribution_text TEXT,
    access_method TEXT,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE data_sources IS 'Registry of external and authoritative data providers and datasets for data provenance.';
COMMENT ON COLUMN data_sources.name IS 'Human-readable name of the data source or service.';
COMMENT ON COLUMN data_sources.provider IS 'Organization or institution providing the data (e.g., NCPOR, ECMWF/Copernicus, NSIDC).';
COMMENT ON COLUMN data_sources.active IS 'Flag indicating whether this data source is currently enabled for ingestion or reference.';


-- 2. STATION STATUS ENUM
-- Defines the reference status for research stations and field observatories.
DO $$ BEGIN
    CREATE TYPE station_status AS ENUM ('ACTIVE', 'INACTIVE', 'HISTORICAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- 3. STATIONS
-- Master registry of Antarctic and Arctic research stations and fixed installations.
CREATE TABLE IF NOT EXISTS stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    region TEXT,
    country TEXT,
    latitude NUMERIC(9,6) NOT NULL,
    longitude NUMERIC(9,6) NOT NULL,
    elevation_m NUMERIC,
    capacity INTEGER,
    status station_status NOT NULL DEFAULT 'ACTIVE',
    source_id UUID,
    source_reference TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT stations_code_key UNIQUE (code),
    CONSTRAINT stations_latitude_check CHECK (latitude >= -90.0 AND latitude <= 90.0),
    CONSTRAINT stations_longitude_check CHECK (longitude >= -180.0 AND longitude <= 180.0),
    CONSTRAINT stations_capacity_check CHECK (capacity IS NULL OR capacity >= 0),
    CONSTRAINT stations_source_id_fkey FOREIGN KEY (source_id) REFERENCES data_sources(id) ON DELETE SET NULL
);

COMMENT ON TABLE stations IS 'Master reference entity for polar stations, research facilities, and permanent bases.';
COMMENT ON COLUMN stations.code IS 'Unique alphanumeric station code (e.g., BHR for Bharati, MTR for Maitri).';
COMMENT ON COLUMN stations.latitude IS 'Geographic latitude in decimal degrees [-90.0, 90.0].';
COMMENT ON COLUMN stations.longitude IS 'Geographic longitude in decimal degrees [-180.0, 180.0].';
COMMENT ON COLUMN stations.capacity IS 'Maximum nominal personnel capacity during standard operating season.';
COMMENT ON COLUMN stations.source_id IS 'Foreign key reference to data_sources indicating original provenance.';
COMMENT ON COLUMN stations.metadata IS 'Flexible supplementary station metadata (e.g., operational seasons, communication specs).';

-- Index for foreign key lookup
CREATE INDEX IF NOT EXISTS idx_stations_source_id ON stations(source_id);
