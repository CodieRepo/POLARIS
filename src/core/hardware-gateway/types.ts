// ==============================================================================
// POLARIS Hardware Gateway Domain Types
// Description: Type definitions for Edge Telemetry Gateways, sensor devices,
//              and time-series observation events.
// ==============================================================================

export type HardwareProtocol =
  | 'MODBUS_RTU'
  | 'MODBUS_TCP'
  | 'MQTT'
  | 'SNMP'
  | 'NMEA'
  | 'VIRTUAL';

export type TelemetryQuality = 'GOOD' | 'SUSPECT' | 'BAD' | 'SIMULATED';

export type TelemetrySource = 'MODBUS' | 'MQTT' | 'SNMP' | 'NMEA' | 'VIRTUAL';

export type TelemetryClassification = 'PHYSICAL_TELEMETRY' | 'SIMULATED_TELEMETRY';

export interface HardwareTelemetryEvent {
  eventId: string; // UUID v4
  gatewayId: string; // e.g. EDGE-GW-BHR-01
  deviceId: string; // e.g. BHR-MODBUS-TK01
  sequenceNumber: number; // Monotonically increasing from device
  bootSessionId: string; // Reboot-safe identifier (e.g. boot-001)
  observedAt: string; // ISO 8601 UTC timestamp
  receivedAt?: string; // ISO 8601 UTC timestamp
  metric: string; // e.g. FUEL_LEVEL_LITERS, GENERATOR_POWER_KW
  value: number;
  unit: string;
  quality: TelemetryQuality;
  source: TelemetrySource;
  classification: TelemetryClassification;
  rawPayload?: Record<string, unknown>;
}

export interface HardwareDevice {
  id: string;
  deviceCode: string;
  stationId: string;
  gatewayId: string;
  protocol: HardwareProtocol;
  targetTankId?: string | null;
  targetAssetId?: string | null;
  name: string;
  description?: string | null;
  pollingIntervalSec: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastReading?: {
    observedAt: string;
    metric: string;
    value: number;
    unit: string;
    quality: TelemetryQuality;
    classification: TelemetryClassification;
  };
}

export interface GatewayCredential {
  id: string;
  gatewayId: string;
  stationId: string;
  name: string;
  isActive: boolean;
  revokedAt?: string | null;
  lastSeenAt?: string | null;
  createdAt: string;
}

export interface TelemetryIngestPayload {
  gatewayId: string;
  events: HardwareTelemetryEvent[];
}

export interface TelemetryIngestResult {
  accepted: number;
  deduplicated: number;
  errors: Array<{ eventId: string; error: string }>;
  timestamp: string;
}
