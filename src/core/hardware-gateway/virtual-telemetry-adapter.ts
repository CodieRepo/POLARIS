// ==============================================================================
// POLARIS Virtual Hardware Telemetry Adapter
// Description: Deterministic in-process virtual telemetry adapter for demonstration
//              and test environments.
// Architectural Constraint:
//   All events emitted by this adapter MUST be explicitly classified as
//   `SIMULATED_TELEMETRY` with quality `SIMULATED` and source `VIRTUAL`.
// ==============================================================================

import { randomUUID } from 'crypto';
import { IHardwareGatewayAdapter } from './gateway-adapter.interface';
import { HardwareTelemetryEvent } from './types';

interface VirtualDeviceConfig {
  deviceCode: string;
  metric: string;
  unit: string;
  baseValue: number;
  variance: number;
  protocol: 'MODBUS_TCP' | 'MODBUS_RTU' | 'SNMP' | 'NMEA';
}

export class VirtualTelemetryAdapter implements IHardwareGatewayAdapter {
  readonly gatewayId: string;
  readonly stationId: string;
  private readonly bootSessionId: string;
  private sequenceCounters: Map<string, number> = new Map();

  private static readonly DEVICE_CATALOG: Record<string, VirtualDeviceConfig[]> = {
    'EDGE-GW-BHR-01': [
      {
        deviceCode: 'BHR-MODBUS-TK01',
        metric: 'FUEL_LEVEL_LITERS',
        unit: 'liters',
        baseValue: 122400.0,
        variance: 150.0,
        protocol: 'MODBUS_TCP',
      },
      {
        deviceCode: 'BHR-MODBUS-GEN01',
        metric: 'GENERATOR_POWER_KW',
        unit: 'kW',
        baseValue: 142.5,
        variance: 8.0,
        protocol: 'MODBUS_RTU',
      },
      {
        deviceCode: 'BHR-SNMP-UPS01',
        metric: 'BATTERY_VOLTAGE_V',
        unit: 'V',
        baseValue: 230.2,
        variance: 1.5,
        protocol: 'SNMP',
      },
    ],
    'EDGE-GW-MTR-01': [
      {
        deviceCode: 'MTR-MODBUS-TK01',
        metric: 'FUEL_LEVEL_LITERS',
        unit: 'liters',
        baseValue: 92500.0,
        variance: 120.0,
        protocol: 'MODBUS_TCP',
      },
      {
        deviceCode: 'MTR-NMEA-GPS01',
        metric: 'GPS_LATITUDE_DEG',
        unit: 'deg',
        baseValue: -70.767,
        variance: 0.0001,
        protocol: 'NMEA',
      },
    ],
  };

  constructor(
    gatewayId: string = 'EDGE-GW-BHR-01',
    stationId: string = 'b0000000-0000-0000-0000-000000000001',
    bootSessionId?: string
  ) {
    this.gatewayId = gatewayId;
    this.stationId = stationId;
    this.bootSessionId = bootSessionId || `boot-virtual-${Date.now().toString(36)}`;
  }

  private getNextSequence(deviceCode: string): number {
    const current = this.sequenceCounters.get(deviceCode) || 100;
    const next = current + 1;
    this.sequenceCounters.set(deviceCode, next);
    return next;
  }

  private generateEvent(config: VirtualDeviceConfig): HardwareTelemetryEvent {
    // Deterministic sine wave variance based on time
    const now = new Date();
    const timeFactor = Math.sin(now.getTime() / 60000);
    const simulatedValue = Number(
      (config.baseValue + timeFactor * config.variance).toFixed(2)
    );

    return {
      eventId: randomUUID(),
      gatewayId: this.gatewayId,
      deviceId: config.deviceCode,
      sequenceNumber: this.getNextSequence(config.deviceCode),
      bootSessionId: this.bootSessionId,
      observedAt: now.toISOString(),
      metric: config.metric,
      value: simulatedValue,
      unit: config.unit,
      quality: 'SIMULATED',
      source: 'VIRTUAL',
      classification: 'SIMULATED_TELEMETRY',
      rawPayload: {
        simulator: 'POLARIS_VIRTUAL_ADAPTER_v2',
        protocol: config.protocol,
        baseValue: config.baseValue,
        simulatedOffset: Number((timeFactor * config.variance).toFixed(2)),
      },
    };
  }

  async pollDevice(deviceCode: string): Promise<HardwareTelemetryEvent | null> {
    const devices = VirtualTelemetryAdapter.DEVICE_CATALOG[this.gatewayId] || [];
    const config = devices.find((d) => d.deviceCode === deviceCode);
    if (!config) return null;
    return this.generateEvent(config);
  }

  async pollAll(): Promise<HardwareTelemetryEvent[]> {
    const devices = VirtualTelemetryAdapter.DEVICE_CATALOG[this.gatewayId] || [];
    return devices.map((cfg) => this.generateEvent(cfg));
  }
}
