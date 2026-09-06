-- ==============================================================================
-- POLARIS Phase 2 Hardware Gateway, Notifications & Offline Sync Schema
-- Migration: create_phase2_hardware_and_notifications_schema
-- Description:
--   Establishes authentic operational tables for Phase 2:
--     1. gateway_credentials: Edge gateway hardware credentials with revocation
--     2. hardware_devices: Registered field telemetry sensors (Modbus/SNMP/MQTT/NMEA)
--     3. hardware_telemetry_history: Time-series telemetry with reboot-safe deduplication
--     4. notification_outbox: Asynchronous external alert dispatch queue
--     5. notification_deliveries: Delivery audit trail across Telegram/Email/Push/Mock
--     6. push_subscriptions: Web Push subscription registry
--     7. offline_sync_idempotency: Zero-trust idempotent sync tracking
-- ==============================================================================

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE hardware_protocol AS ENUM ('MODBUS_RTU', 'MODBUS_TCP', 'MQTT', 'SNMP', 'NMEA', 'VIRTUAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE telemetry_quality AS ENUM ('GOOD', 'SUSPECT', 'BAD', 'SIMULATED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE telemetry_source AS ENUM ('MODBUS', 'MQTT', 'SNMP', 'NMEA', 'VIRTUAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE telemetry_classification AS ENUM ('PHYSICAL_TELEMETRY', 'SIMULATED_TELEMETRY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE notification_channel AS ENUM ('TELEGRAM', 'EMAIL', 'WEB_PUSH', 'MOCK');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE outbox_status AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE delivery_status AS ENUM ('SUCCESS', 'PERMANENT_FAILURE', 'RATE_LIMITED', 'TEST_MODE_SIMULATED');
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- 2. GATEWAY CREDENTIALS
CREATE TABLE IF NOT EXISTS public.gateway_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway_id TEXT UNIQUE NOT NULL,
    station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    revoked_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gateway_credentials IS 'Hashed API authentication credentials for remote edge telemetry gateways.';


-- 3. HARDWARE DEVICES
CREATE TABLE IF NOT EXISTS public.hardware_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_code TEXT UNIQUE NOT NULL,
    station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
    gateway_id TEXT NOT NULL REFERENCES public.gateway_credentials(gateway_id) ON DELETE CASCADE,
    protocol hardware_protocol NOT NULL DEFAULT 'MODBUS_TCP',
    target_tank_id UUID REFERENCES public.station_fuel_tanks(id) ON DELETE SET NULL,
    target_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    polling_interval_sec INTEGER NOT NULL DEFAULT 60,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.hardware_devices IS 'Registered sensor devices associated with an edge gateway and station asset/tank.';


-- 4. HARDWARE TELEMETRY HISTORY
CREATE TABLE IF NOT EXISTS public.hardware_telemetry_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL UNIQUE,
    gateway_id TEXT NOT NULL REFERENCES public.gateway_credentials(gateway_id) ON DELETE CASCADE,
    device_id TEXT NOT NULL REFERENCES public.hardware_devices(device_code) ON DELETE CASCADE,
    sequence_number BIGINT NOT NULL,
    boot_session_id TEXT NOT NULL DEFAULT 'boot-0',
    observed_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metric TEXT NOT NULL,
    value NUMERIC(12, 4) NOT NULL,
    unit TEXT NOT NULL,
    quality telemetry_quality NOT NULL DEFAULT 'GOOD',
    source telemetry_source NOT NULL DEFAULT 'VIRTUAL',
    classification telemetry_classification NOT NULL DEFAULT 'SIMULATED_TELEMETRY',
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Reboot-safe composite uniqueness constraint:
    CONSTRAINT uq_telemetry_reboot_safe UNIQUE (gateway_id, device_id, boot_session_id, sequence_number)
);

COMMENT ON TABLE public.hardware_telemetry_history IS 'Time-series sensor telemetry readings with reboot-safe deduplication and explicit simulation watermarks.';


-- 5. NOTIFICATION OUTBOX
CREATE TABLE IF NOT EXISTS public.notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID REFERENCES public.operational_alerts(id) ON DELETE CASCADE,
    channel notification_channel NOT NULL,
    recipient TEXT NOT NULL,
    subject TEXT,
    payload JSONB NOT NULL,
    status outbox_status NOT NULL DEFAULT 'QUEUED',
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_outbox IS 'Decoupled persistent queue for external notification dispatch.';


-- 6. NOTIFICATION DELIVERIES
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outbox_id UUID NOT NULL REFERENCES public.notification_outbox(id) ON DELETE CASCADE,
    alert_id UUID REFERENCES public.operational_alerts(id) ON DELETE CASCADE,
    channel notification_channel NOT NULL,
    recipient TEXT NOT NULL,
    delivery_status delivery_status NOT NULL,
    external_reference_id TEXT,
    failure_reason TEXT,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_deliveries IS 'Audit log of dispatch results to third-party notification APIs.';


-- 7. PUSH SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    station_id UUID REFERENCES public.stations(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.push_subscriptions IS 'Browser Web Push API subscriptions for critical station alert delivery.';


-- 8. OFFLINE SYNC IDEMPOTENCY
CREATE TABLE IF NOT EXISTS public.offline_sync_idempotency (
    idempotency_key UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response_payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.offline_sync_idempotency IS 'Idempotency ledger ensuring offline queued mutations cannot be executed twice.';


-- 9. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_hardware_telemetry_device_time ON public.hardware_telemetry_history(device_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_hardware_telemetry_gateway_time ON public.hardware_telemetry_history(gateway_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_queue ON public.notification_outbox(status, next_retry_at) WHERE status = 'QUEUED';
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_alert ON public.notification_deliveries(alert_id, delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_station ON public.push_subscriptions(station_id) WHERE is_active = true;


-- 10. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.gateway_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hardware_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hardware_telemetry_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_sync_idempotency ENABLE ROW LEVEL SECURITY;

-- Read policies
DO $$ BEGIN
    CREATE POLICY "Allow public read on hardware_devices" ON public.hardware_devices FOR SELECT USING (true);
    CREATE POLICY "Allow public read on hardware_telemetry_history" ON public.hardware_telemetry_history FOR SELECT USING (true);
    CREATE POLICY "Allow public read on gateway_credentials" ON public.gateway_credentials FOR SELECT USING (true);
    CREATE POLICY "Allow public read on notification_outbox" ON public.notification_outbox FOR SELECT USING (true);
    CREATE POLICY "Allow public read on notification_deliveries" ON public.notification_deliveries FOR SELECT USING (true);
    CREATE POLICY "Allow public read on push_subscriptions" ON public.push_subscriptions FOR SELECT USING (true);
    CREATE POLICY "Allow public read on offline_sync_idempotency" ON public.offline_sync_idempotency FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Write & mutation policies
DO $$ BEGIN
    CREATE POLICY "Allow insert on hardware_telemetry_history" ON public.hardware_telemetry_history FOR INSERT WITH CHECK (true);
    CREATE POLICY "Allow update on gateway_credentials" ON public.gateway_credentials FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY "Allow insert on notification_outbox" ON public.notification_outbox FOR INSERT WITH CHECK (true);
    CREATE POLICY "Allow update on notification_outbox" ON public.notification_outbox FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY "Allow insert on notification_deliveries" ON public.notification_deliveries FOR INSERT WITH CHECK (true);
    CREATE POLICY "Allow insert on push_subscriptions" ON public.push_subscriptions FOR INSERT WITH CHECK (true);
    CREATE POLICY "Allow update on push_subscriptions" ON public.push_subscriptions FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY "Allow insert on offline_sync_idempotency" ON public.offline_sync_idempotency FOR INSERT WITH CHECK (true);
    CREATE POLICY "Allow update on offline_sync_idempotency" ON public.offline_sync_idempotency FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- 11. BASELINE SEED DATA
-- 11.1 Gateway Credentials
INSERT INTO public.gateway_credentials (id, gateway_id, station_id, name, key_hash, is_active, last_seen_at)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'EDGE-GW-BHR-01', 'b0000000-0000-0000-0000-000000000001', 'Bharati Main Edge Gateway (Moxaworks / Linux)', '5ea63dc0d012c99e9fe948d21cfafd150fa97e1239fcb595fd62a23b7f1b4b02', true, now()),
  ('c0000000-0000-0000-0000-000000000002', 'EDGE-GW-MTR-01', 'b0000000-0000-0000-0000-000000000002', 'Maitri Powerhouse Edge Gateway (Raspberry Pi CM4 / Debian)', 'd1b96963523409d1a731dafe1182be92dd4ef74982040af75f60e173d041ef72', true, now())
ON CONFLICT (gateway_id) DO NOTHING;

-- 11.2 Hardware Devices
INSERT INTO public.hardware_devices (id, device_code, station_id, gateway_id, protocol, target_tank_id, target_asset_id, name, description, polling_interval_sec)
VALUES
  ('d1000000-0000-0000-0000-000000000001', 'BHR-MODBUS-TK01', 'b0000000-0000-0000-0000-000000000001', 'EDGE-GW-BHR-01', 'MODBUS_TCP', '70000000-0000-0000-0000-000000000001', NULL, 'Main Bulk Tank Alpha Hydrostatic Level Transmitter', 'Yokogawa EJA530E hydrostatic level gauge via Modbus TCP gateway', 30),
  ('d1000000-0000-0000-0000-000000000002', 'BHR-MODBUS-GEN01', 'b0000000-0000-0000-0000-000000000001', 'EDGE-GW-BHR-01', 'MODBUS_RTU', '70000000-0000-0000-0000-000000000003', NULL, 'Prime Generator 1 ComAp Controller', 'ComAp InteliLite4 generator controller Modbus RTU RS-485 bus', 15),
  ('d1000000-0000-0000-0000-000000000003', 'BHR-SNMP-UPS01', 'b0000000-0000-0000-0000-000000000001', 'EDGE-GW-BHR-01', 'SNMP', NULL, NULL, 'Station Communications UPS Network Card', 'APC Smart-UPS RT 10000VA SNMP card monitoring DC bus and runtime', 60),
  ('d1000000-0000-0000-0000-000000000004', 'MTR-MODBUS-TK01', 'b0000000-0000-0000-0000-000000000002', 'EDGE-GW-MTR-01', 'MODBUS_TCP', '70000000-0000-0000-0000-000000000005', NULL, 'Maitri Central Storage Tank Pressure Sensor', 'WIKA S-20 pressure transmitter on bulk fuel manifold', 30),
  ('d1000000-0000-0000-0000-000000000005', 'MTR-NMEA-GPS01', 'b0000000-0000-0000-0000-000000000002', 'EDGE-GW-MTR-01', 'NMEA', NULL, NULL, 'Base Camp Master GPS Time & Position Receiver', 'Trimble Thunderbolt NMEA-0183 serial stream', 10)
ON CONFLICT (device_code) DO NOTHING;

-- 11.3 Baseline Telemetry Historical Record (Simulated Telemetry watermark)
INSERT INTO public.hardware_telemetry_history (id, event_id, gateway_id, device_id, sequence_number, boot_session_id, observed_at, metric, value, unit, quality, source, classification)
VALUES
  ('e1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'EDGE-GW-BHR-01', 'BHR-MODBUS-TK01', 101, 'boot-001', now() - interval '1 hour', 'FUEL_LEVEL_LITERS', 122400.00, 'liters', 'SIMULATED', 'MODBUS', 'SIMULATED_TELEMETRY'),
  ('e1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000002', 'EDGE-GW-BHR-01', 'BHR-MODBUS-GEN01', 102, 'boot-001', now() - interval '30 minutes', 'GENERATOR_POWER_KW', 142.50, 'kW', 'SIMULATED', 'MODBUS', 'SIMULATED_TELEMETRY'),
  ('e1000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000003', 'EDGE-GW-MTR-01', 'MTR-MODBUS-TK01', 201, 'boot-001', now() - interval '45 minutes', 'FUEL_LEVEL_LITERS', 92500.00, 'liters', 'SIMULATED', 'MODBUS', 'SIMULATED_TELEMETRY')
ON CONFLICT (event_id) DO NOTHING;
