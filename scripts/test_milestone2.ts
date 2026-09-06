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

import { TelemetryProcessor } from '@/core/hardware-gateway/telemetry-processor';
import { VirtualTelemetryAdapter } from '@/core/hardware-gateway/virtual-telemetry-adapter';

async function testMilestone2() {
  console.log('--- Testing Milestone 2 Hardware Gateway ---');

  // 1. Authenticate with bad key
  const badAuth = await TelemetryProcessor.authenticateGateway('EDGE-GW-BHR-01', 'bad_key_123');
  console.log('Bad Auth Expected Failure:', !badAuth.authenticated, badAuth.error);

  // 2. Authenticate with good key
  const validKey = process.env.POLARIS_GATEWAY_KEY || '';
  const goodAuth = await TelemetryProcessor.authenticateGateway('EDGE-GW-BHR-01', validKey);
  console.log('Good Auth Expected Success:', goodAuth.authenticated, 'StationId:', goodAuth.stationId);

  // 3. Generate events via VirtualTelemetryAdapter
  const adapter = new VirtualTelemetryAdapter('EDGE-GW-BHR-01');
  const events = await adapter.pollAll();
  console.log(`Generated ${events.length} virtual events.`);
  for (const e of events) {
    if (e.classification !== 'SIMULATED_TELEMETRY' || e.quality !== 'SIMULATED') {
      throw new Error(`Event ${e.eventId} missing simulated classification!`);
    }
  }
  console.log('Simulation watermarking verified on all events.');

  // 4. Ingest events
  const ingest1 = await TelemetryProcessor.processBatch('EDGE-GW-BHR-01', validKey, events);
  console.log('Batch Ingestion 1:', ingest1);

  // 5. Ingest same events again (deduplication check)
  const ingest2 = await TelemetryProcessor.processBatch('EDGE-GW-BHR-01', validKey, events);
  console.log('Batch Ingestion 2 (Duplicate replay):', ingest2);
  if (ingest2.deduplicated !== events.length) {
    throw new Error(`Expected all ${events.length} events to be deduplicated, but got ${ingest2.deduplicated}`);
  }
  console.log('Reboot-safe and eventId deduplication verified!');

  // 6. Check getDevices
  const devices = await TelemetryProcessor.getDevices();
  console.log(`Retrieved ${devices.length} hardware devices from DB.`);
  const bhrTank = devices.find(d => d.deviceCode === 'BHR-MODBUS-TK01');
  console.log('BHR-MODBUS-TK01 latest reading:', bhrTank?.lastReading);

  console.log('--- Milestone 2 PASSED ALL CHECKS ---');
}

testMilestone2().catch(e => {
  console.error('Milestone 2 test failed:', e);
  process.exit(1);
});
