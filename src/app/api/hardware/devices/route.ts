import { NextRequest, NextResponse } from 'next/server';
import { TelemetryProcessor } from '@/core/hardware-gateway/telemetry-processor';
import { VirtualTelemetryAdapter } from '@/core/hardware-gateway/virtual-telemetry-adapter';

export async function GET(req: NextRequest) {
  try {
    const stationId = req.nextUrl.searchParams.get('stationId') || undefined;
    const devices = await TelemetryProcessor.getDevices(stationId);
    return NextResponse.json({ devices });
  } catch (error) {
    const err = error as Error;
    console.error('Error in GET /api/hardware/devices:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to list hardware devices' },
      { status: 500 }
    );
  }
}

import { requireActionPermission, handleAuthError } from '@/infrastructure/auth/role-guard';

/**
 * POST /api/hardware/devices
 * Allows simulating a live polling tick from the Virtual Telemetry Adapter
 * for interactive demo / operational verification purposes.
 * Authorized Roles: SUPER_ADMIN, COMMAND_ADMIN, STATION_OPERATOR.
 */
export async function POST(req: NextRequest) {
  try {
    await requireActionPermission('HARDWARE_SIMULATE_POLL');
    const body = await req.json().catch(() => ({}));
    const gatewayId = body.gatewayId || 'EDGE-GW-BHR-01';

    const adapter = new VirtualTelemetryAdapter(gatewayId);
    const events = await adapter.pollAll();

    const result = await TelemetryProcessor.processVirtualBatch(gatewayId, events);
    return NextResponse.json({
      success: true,
      simulated: true,
      disclaimer:
        'Watermarked: SIMULATED_TELEMETRY generated via in-process VirtualTelemetryAdapter',
      result,
      events,
    });
  } catch (error) {
    const authRes = handleAuthError(error);
    if (authRes) return authRes;

    const err = error as Error;
    console.error('Error in POST /api/hardware/devices:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to simulate hardware poll' },
      { status: 500 }
    );
  }
}
