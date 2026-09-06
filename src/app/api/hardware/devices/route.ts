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

/**
 * POST /api/hardware/devices
 * Allows simulating a live polling tick from the Virtual Telemetry Adapter
 * for interactive demo / operational verification purposes.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const gatewayId = body.gatewayId || 'EDGE-GW-BHR-01';
    // Gateway key retrieved securely from server environment
    const rawKey =
      (gatewayId === 'EDGE-GW-MTR-01'
        ? process.env.POLARIS_GATEWAY_KEY_MTR
        : process.env.POLARIS_GATEWAY_KEY) ||
      process.env.POLARIS_GATEWAY_KEY ||
      '';

    const adapter = new VirtualTelemetryAdapter(gatewayId);
    const events = await adapter.pollAll();

    const result = await TelemetryProcessor.processBatch(gatewayId, rawKey, events);
    return NextResponse.json({
      success: true,
      simulated: true,
      disclaimer:
        'Watermarked: SIMULATED_TELEMETRY generated via in-process VirtualTelemetryAdapter',
      result,
      events,
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error in POST /api/hardware/devices:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to simulate hardware poll' },
      { status: 500 }
    );
  }
}
