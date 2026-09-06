import { NextRequest, NextResponse } from 'next/server';
import { OutboxProcessor } from '@/core/notifications/outbox-processor';
import { NotificationChannel, NotificationPayload } from '@/core/notifications/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const channel: NotificationChannel = body.channel || 'TELEGRAM';
    const recipient = body.recipient || (channel === 'EMAIL' ? 'ops@ncaor.gov.in' : '@polaris_ops_channel');

    const payload: NotificationPayload = {
      severity: body.severity || 'WARNING',
      category: body.category || 'OPERATIONS',
      title: body.title || 'Polar Station Weather Advisory (Test Dispatch)',
      message:
        body.message ||
        'Surface blizzard warning active at Bharati Station. Wind gusts exceeding 45 km/h. Automated dispatch verification via POLARIS Outbox.',
      stationCode: body.stationCode || 'BHR',
    };

    // 1. Enqueue to outbox
    const queuedIds = await OutboxProcessor.enqueueAlert(
      body.alertId || '90000000-0000-0000-0000-000000000001',
      [{ channel, recipient }],
      payload
    );

    // 2. Immediately process pending queue for instant verification
    const dispatchSummary = await OutboxProcessor.processPendingQueue(5);

    return NextResponse.json({
      success: true,
      sandbox: true,
      queuedIds,
      dispatchSummary,
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error in POST /api/notifications/test:', err);
    return NextResponse.json(
      { error: err.message || 'Notification test dispatch failed' },
      { status: 500 }
    );
  }
}
