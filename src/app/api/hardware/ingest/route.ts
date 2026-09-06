import { NextRequest, NextResponse } from 'next/server';
import { TelemetryProcessor } from '@/core/hardware-gateway/telemetry-processor';
import { HardwareTelemetryEvent } from '@/core/hardware-gateway/types';

export async function POST(req: NextRequest) {
  try {
    const gatewayId =
      req.headers.get('x-polaris-gateway-id') ||
      req.nextUrl.searchParams.get('gatewayId');
    const gatewayKey =
      req.headers.get('x-polaris-gateway-key') ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    const body = await req.json().catch(() => null);

    const effectiveGatewayId = gatewayId || body?.gatewayId;
    const effectiveGatewayKey = gatewayKey || body?.gatewayKey;

    if (!effectiveGatewayId || !effectiveGatewayKey) {
      return NextResponse.json(
        {
          error:
            'Missing gateway credentials. Provide x-polaris-gateway-id and x-polaris-gateway-key headers.',
        },
        { status: 401 }
      );
    }

    const events: HardwareTelemetryEvent[] = Array.isArray(body?.events)
      ? body.events
      : Array.isArray(body)
      ? body
      : body?.event
      ? [body.event]
      : [];

    if (events.length === 0) {
      return NextResponse.json(
        { error: 'Payload must contain a non-empty list of events' },
        { status: 400 }
      );
    }

    const result = await TelemetryProcessor.processBatch(
      effectiveGatewayId,
      effectiveGatewayKey,
      events
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const err = error as Error;
    console.error('Error in /api/hardware/ingest:', err);
    const isAuthError = err.message?.includes('Authentication failed');
    return NextResponse.json(
      { error: err.message || 'Internal hardware ingestion error' },
      { status: isAuthError ? 401 : 500 }
    );
  }
}
