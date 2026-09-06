// ==============================================================================
// POLARIS Hardware Gateway Adapter Interface
// Description: Contract for edge/virtual hardware telemetry polling adapters.
// ==============================================================================

import { HardwareTelemetryEvent } from './types';

export interface IHardwareGatewayAdapter {
  readonly gatewayId: string;
  readonly stationId: string;

  /**
   * Polls a specific sensor device by its registered device code.
   */
  pollDevice(deviceCode: string): Promise<HardwareTelemetryEvent | null>;

  /**
   * Polls all devices connected to this gateway instance.
   */
  pollAll(): Promise<HardwareTelemetryEvent[]>;
}
