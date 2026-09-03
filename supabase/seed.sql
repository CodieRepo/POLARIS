-- ==============================================================================
-- POLARIS Master Seed Dataset
-- Milestone: SIH-Demo Baseline Seed
-- Description:
--   Populates realistic reference and operational data:
--     1. data_sources: NCPOR, ECMWF/Copernicus, NSIDC
--     2. stations: Bharati, Maitri, Himadri, IndARC, Dakshin Gangotri (Historical)
--     3. persons: Station leaders, scientists, mechanics, medical officers
--     4. expeditions: Active 44th ISEA, Planned Arctic Summer, Draft Deep Traverse
--     5. assets: Vehicles (PistenBully), Comms, Generators, Scientific Spectrometers
--     6. initial assignments & maintenance records
-- ==============================================================================

-- 1. DATA SOURCES
INSERT INTO public.data_sources (id, name, provider, dataset_name, source_type, base_url, active)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'National Centre for Polar and Ocean Research', 'NCPOR / MoES India', 'Polar Operations Registry', 'AUTHORITATIVE_REAL', 'https://ncpor.res.in', true),
  ('a0000000-0000-0000-0000-000000000002', 'Copernicus Climate Change Service', 'ECMWF', 'ERA5 Reanalysis', 'EXTERNAL_REAL', 'https://cds.climate.copernicus.eu', true),
  ('a0000000-0000-0000-0000-000000000003', 'National Snow and Ice Data Center', 'NSIDC / NASA', 'Sea Ice Index', 'EXTERNAL_REAL', 'https://nsidc.org', true)
ON CONFLICT (id) DO NOTHING;

-- 2. STATIONS
INSERT INTO public.stations (id, code, name, region, country, latitude, longitude, elevation_m, capacity, status, source_id)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'BHR', 'Bharati Station', 'Larsemann Hills, East Antarctica', 'India', -69.407222, 76.194722, 35, 47, 'ACTIVE', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'MTR', 'Maitri Station', 'Schirmacher Oasis, Queen Maud Land', 'India', -70.766389, 11.733333, 117, 25, 'ACTIVE', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000003', 'HMD', 'Himadri Station', 'Ny-Ålesund, Svalbard', 'India / Norway', 78.923333, 11.928889, 20, 8, 'ACTIVE', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000004', 'DGT', 'Dakshin Gangotri', 'Schirmacher Hills, Antarctica', 'India', -70.083333, 12.000000, 50, 0, 'HISTORICAL', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- 3. PERSONS (Field personnel)
INSERT INTO public.persons (id, display_name, role_title, organization, active)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Dr. Rajesh Nair', 'Expedition Leader & Cryosphere Lead', 'NCPOR', true),
  ('c0000000-0000-0000-0000-000000000002', 'Cmdr. Vikram Shekhawat', 'Logistics Officer & Station Leader', 'Indian Navy / NCPOR', true),
  ('c0000000-0000-0000-0000-000000000003', 'Dr. Ananya Sen', 'Atmospheric Physicist', 'IMD / MoES', true),
  ('c0000000-0000-0000-0000-000000000004', 'Subedar M. Gurung', 'Heavy Plant Engineer', 'Corps of Engineers', true),
  ('c0000000-0000-0000-0000-000000000005', 'Dr. Preeti Sharma', 'Medical Officer & Cold-Region Specialist', 'AIIMS / ITBP', true)
ON CONFLICT (id) DO NOTHING;

-- 4. EXPEDITIONS
INSERT INTO public.expeditions (id, code, name, description, status, data_classification, origin_station_id, destination_station_id, planned_start_at, planned_end_at, actual_start_at)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'ISEA-44', '44th Indian Scientific Expedition to Antarctica', 'Annual summer science & winter-over maintenance mission across Larsemann Hills and Schirmacher Oasis.', 'ACTIVE', 'AUTHORITATIVE_REAL', 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '2025-11-15T00:00:00Z', '2026-03-30T00:00:00Z', '2025-11-20T08:00:00Z'),
  ('d0000000-0000-0000-0000-000000000002', 'ARC-26-S', 'Arctic Summer Svalbard Observation Campaign', 'Atmospheric boundary layer profiling and fjord oceanographic surveys based at Ny-Ålesund.', 'PLANNED', 'SIMULATED', 'b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', '2026-06-01T00:00:00Z', '2026-08-31T00:00:00Z', NULL),
  ('d0000000-0000-0000-0000-000000000003', 'TRV-44-DP', 'Deep Continental Traverse & Radar Sounding', 'Inland ice sheet traverse towards Amery Ice Shelf for deep ice radar sounding.', 'DRAFT', 'SIMULATED', 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', '2026-12-01T00:00:00Z', '2027-01-20T00:00:00Z', NULL)
ON CONFLICT (id) DO NOTHING;

-- 5. EXPEDITION ROSTER
INSERT INTO public.expedition_members (id, expedition_id, person_id, assignment_role, joined_at)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'EXPEDITION_LEADER', '2025-11-15T00:00:00Z'),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'EXPEDITION_MEMBER', '2025-11-15T00:00:00Z'),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'EXPEDITION_MEMBER', '2025-11-15T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- 6. ASSETS
INSERT INTO public.assets (id, asset_code, name, category, type, station_id, status, condition, criticality, manufacturer, model, commissioned_at, data_classification)
VALUES
  ('f0000000-0000-0000-0000-000000000001', 'VEH-PB-01', 'PistenBully 300 Polar Snowcat', 'VEHICLES', 'Over-snow Tracked Vehicle', 'b0000000-0000-0000-0000-000000000001', 'AVAILABLE', 'EXCELLENT', 'CRITICAL', 'Kässbohrer Geländefahrzeug', 'PB300 Polar', '2022-01-10T00:00:00Z', 'AUTHORITATIVE_REAL'),
  ('f0000000-0000-0000-0000-000000000002', 'VEH-PB-02', 'PistenBully 100 Scout Track', 'VEHICLES', 'Lightweight Tracked Vehicle', 'b0000000-0000-0000-0000-000000000001', 'AVAILABLE', 'GOOD', 'HIGH', 'Kässbohrer Geländefahrzeug', 'PB100 Polar', '2023-02-15T00:00:00Z', 'AUTHORITATIVE_REAL'),
  ('f0000000-0000-0000-0000-000000000003', 'PWR-GEN-01', 'Prime Power Generator 1 (125 kVA)', 'POWER_SYSTEMS', 'Diesel Synchronous Generator', 'b0000000-0000-0000-0000-000000000001', 'IN_USE', 'GOOD', 'CRITICAL', 'Cummins India', 'QSB6.7 Polar Spec', '2021-11-01T00:00:00Z', 'AUTHORITATIVE_REAL'),
  ('f0000000-0000-0000-0000-000000000004', 'PWR-GEN-02', 'Auxiliary Emergency Generator (80 kVA)', 'POWER_SYSTEMS', 'Cold-Start Diesel Generator', 'b0000000-0000-0000-0000-000000000002', 'AVAILABLE', 'GOOD', 'CRITICAL', 'Kirloskar Oil Engines', 'KG-80 Arctic', '2020-12-10T00:00:00Z', 'AUTHORITATIVE_REAL'),
  ('f0000000-0000-0000-0000-000000000005', 'COM-SAT-01', 'BGAN Inmarsat High-Rate Satellite Terminal', 'COMMUNICATIONS', 'Satellite Transceiver', 'b0000000-0000-0000-0000-000000000001', 'AVAILABLE', 'EXCELLENT', 'HIGH', 'Cobham Explorer', 'Explorer 710', '2023-03-01T00:00:00Z', 'AUTHORITATIVE_REAL'),
  ('f0000000-0000-0000-0000-000000000006', 'SCI-GPR-01', 'Ground Penetrating Ice Radar (GPR-400)', 'SCIENTIFIC_PAYLOADS', 'Deep Ice Subsurface Radar', 'b0000000-0000-0000-0000-000000000001', 'AVAILABLE', 'GOOD', 'HIGH', 'Sensors & Software', 'pulseEKKO Pro 100MHz', '2023-01-20T00:00:00Z', 'SIMULATED'),
  ('f0000000-0000-0000-0000-000000000007', 'SCI-SPCT-01', 'Multi-Axis Differential Optical Spectrometer', 'SCIENTIFIC_PAYLOADS', 'Trace Gas Spectrometer', 'b0000000-0000-0000-0000-000000000003', 'AVAILABLE', 'ATTENTION_REQUIRED', 'MEDIUM', 'Hoffmann Messtechnik', 'MAX-DOAS Mark IV', '2019-07-15T00:00:00Z', 'SIMULATED'),
  ('f0000000-0000-0000-0000-000000000008', 'VEH-CRN-01', 'All-Terrain Polar Crane Truck', 'VEHICLES', 'Hydraulic Mobile Crane', 'b0000000-0000-0000-0000-000000000002', 'MAINTENANCE', 'ATTENTION_REQUIRED', 'HIGH', 'Tatra', 'Phoenix 8x8 Arctic', '2018-01-10T00:00:00Z', 'AUTHORITATIVE_REAL'),
  ('f0000000-0000-0000-0000-000000000009', 'LGT-SKD-01', 'Decommissioned Skidoo Alpine II', 'VEHICLES', 'Snowmobile', 'b0000000-0000-0000-0000-000000000004', 'RETIRED', 'CRITICAL', 'LOW', 'Bombardier', 'Alpine II 1989', '1989-12-01T00:00:00Z', 'HISTORICAL_RECORD')
ON CONFLICT (id) DO NOTHING;

-- 7. INITIAL MAINTENANCE RECORDS
INSERT INTO public.maintenance_records (id, asset_id, maintenance_type, status, scheduled_at, started_at, description, performed_by, cost)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000008', 'CORRECTIVE', 'IN_PROGRESS', '2026-08-25T00:00:00Z', '2026-08-26T06:00:00Z', 'Hydraulic hose replacement and sub-zero fluid flush on main boom.', 'Subedar M. Gurung', 1450.00),
  ('10000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', 'PREVENTIVE', 'COMPLETED', '2026-07-01T00:00:00Z', '2026-07-01T08:00:00Z', '500-hour fuel filter change, glow plug inspection, alternator calibration.', 'Subedar M. Gurung', 820.00)
ON CONFLICT (id) DO NOTHING;
