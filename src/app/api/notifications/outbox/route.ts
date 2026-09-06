import { NextRequest, NextResponse } from 'next/server';
import { OutboxProcessor } from '@/core/notifications/outbox-processor';

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  // If CRON_SECRET is not configured on the server, allow internal/local requests
  if (!cronSecret) return true;

  const authHeader = req.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * GET /api/notifications/outbox
 * - When invoked by Vercel Cron with Authorization: Bearer <CRON_SECRET>,
 *   it triggers autonomous queue processing.
 * - When invoked without cron authorization, it provides read-only queue telemetry & summary.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Vercel Cron trigger:
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      const searchParams = req.nextUrl.searchParams;
      const batchSize = Number(searchParams.get('batchSize')) || 25;
      const dispatchSummary = await OutboxProcessor.processPendingQueue(batchSize);
      return NextResponse.json({
        success: true,
        source: 'vercel_cron',
        dispatchSummary,
      });
    }

    // Otherwise, provide read-only status and recent delivery logs
    const summary = await OutboxProcessor.getOutboxQueueSummary();
    const recentDeliveries = await OutboxProcessor.getRecentDeliveries(25);
    return NextResponse.json({ summary, recentDeliveries });
  } catch (error) {
    const err = error as Error;
    console.error('Error in GET /api/notifications/outbox:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to process notification outbox request' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications/outbox
 * Manual or webhook trigger for outbox batch dispatch.
 * Requires Bearer <CRON_SECRET> authorization if CRON_SECRET is configured.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing CRON_SECRET authorization bearer token' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const batchSize = Number(body.batchSize) || 25;

    const dispatchSummary = await OutboxProcessor.processPendingQueue(batchSize);
    return NextResponse.json({
      success: true,
      source: 'api_dispatch',
      dispatchSummary,
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error in POST /api/notifications/outbox:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to process notification outbox' },
      { status: 500 }
    );
  }
}
