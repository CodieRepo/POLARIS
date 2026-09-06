import fs from 'fs';

// 1. Load environment variables
const envContent = fs.readFileSync('.env.production', 'utf-8');
for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}
process.env.POLARIS_NOTIFICATION_SANDBOX = 'true';

import { OutboxProcessor } from '@/core/notifications/outbox-processor';
import { MockChannelAdapter } from '@/core/notifications/adapters/mock-adapter';

async function testMilestone3() {
  console.log('--- Testing Milestone 3 External Notification Outbox ---');

  // 1. Enqueue an alert to Telegram & Email in Sandbox Mode
  const testPayload = {
    severity: 'WARNING' as const,
    category: 'METEOROLOGICAL',
    title: 'Automated Blizzard Alert Test',
    message: 'Extreme wind gusts recorded at Bharati Station AWS. Convoy movement on hold.',
    stationCode: 'BHR',
  };

  console.log('1. Enqueueing alert to outbox...');
  const queuedIds = await OutboxProcessor.enqueueAlert(
    '90000000-0000-0000-0000-000000000001',
    [
      { channel: 'TELEGRAM', recipient: '@polaris_ops_channel' },
      { channel: 'EMAIL', recipient: 'comms-officer@ncaor.gov.in' },
    ],
    testPayload
  );
  console.log(`Enqueued ${queuedIds.length} outbox items. IDs:`, queuedIds);

  if (queuedIds.length !== 2) {
    throw new Error(`Expected 2 items enqueued, got ${queuedIds.length}`);
  }

  // 2. Check Outbox Queue Summary
  const summaryBefore = await OutboxProcessor.getOutboxQueueSummary();
  console.log('Outbox summary before processing:', summaryBefore);

  // 3. Process Pending Queue
  console.log('2. Processing pending queue...');
  const dispatchResult = await OutboxProcessor.processPendingQueue(10);
  console.log('Dispatch result:', dispatchResult);

  if (dispatchResult.succeeded !== 2) {
    throw new Error(`Expected 2 succeeded dispatches, got ${dispatchResult.succeeded}`);
  }

  // 4. Verify Delivery Log
  const deliveries = await OutboxProcessor.getRecentDeliveries(5);
  console.log(`Retrieved ${deliveries.length} recent deliveries.`);
  const latestTg = deliveries.find(d => d.channel === 'TELEGRAM');
  const latestEmail = deliveries.find(d => d.channel === 'EMAIL');

  console.log('Latest Telegram Delivery:', latestTg?.delivery_status, latestTg?.external_reference_id);
  console.log('Latest Email Delivery:', latestEmail?.delivery_status, latestEmail?.external_reference_id);

  if (latestTg?.delivery_status !== 'TEST_MODE_SIMULATED' || latestEmail?.delivery_status !== 'TEST_MODE_SIMULATED') {
    throw new Error('Expected TEST_MODE_SIMULATED in sandbox mode');
  }

  // 5. Test Mock Adapter
  console.log('3. Testing Mock adapter injection...');
  const mockAdapter = new MockChannelAdapter();
  OutboxProcessor.registerAdapter('MOCK', mockAdapter);

  const mockQueued = await OutboxProcessor.enqueueAlert(
    '90000000-0000-0000-0000-000000000001',
    [{ channel: 'MOCK', recipient: 'mock-target' }],
    testPayload
  );
  await OutboxProcessor.processPendingQueue(5);
  console.log('Mock adapter dispatched count:', mockAdapter.dispatched.length);

  if (mockAdapter.dispatched.length !== 1) {
    throw new Error('Mock adapter did not receive dispatched payload');
  }

  console.log('--- Milestone 3 PASSED ALL CHECKS ---');
}

testMilestone3().catch(e => {
  console.error('Milestone 3 test failed:', e);
  process.exit(1);
});
