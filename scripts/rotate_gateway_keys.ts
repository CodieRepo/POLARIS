import fs from 'fs';
import { randomBytes, createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

function parseEnv(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const env: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

function updateEnvFile(filePath: string, updates: Record<string, string>) {
  let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
  const lines = content.split(/\r?\n/);
  const foundKeys = new Set<string>();

  const newLines = lines.map((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      if (key in updates) {
        foundKeys.add(key);
        return `${key}="${updates[key]}"`;
      }
    }
    return line;
  });

  for (const [key, val] of Object.entries(updates)) {
    if (!foundKeys.has(key)) {
      newLines.push(`${key}="${val}"`);
    }
  }

  fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
}

async function main() {
  console.log('--- Starting Gateway Key Rotation & Remediation ---');
  const env = parseEnv('.env.production');
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase credentials in .env.production');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. Revoke existing credentials
  console.log('Revoking old gateway credentials in Supabase...');
  const { data: revoked, error: revokeError } = await supabase
    .from('gateway_credentials')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    })
    .in('gateway_id', ['EDGE-GW-BHR-01', 'EDGE-GW-MTR-01', 'TEST-EDGE-GW'])
    .select('id, gateway_id, is_active, revoked_at');

  if (revokeError) {
    console.error('Error revoking existing credentials:', revokeError);
    process.exit(1);
  }
  console.log(`Successfully revoked ${revoked?.length ?? 0} existing credential records.`);

  // 2. Generate new random keys
  const newBhrKey = randomBytes(32).toString('hex');
  const newMtrKey = randomBytes(32).toString('hex');
  const cronSecret = randomBytes(32).toString('hex');

  const bhrHash = createHash('sha256').update(newBhrKey).digest('hex');
  const mtrHash = createHash('sha256').update(newMtrKey).digest('hex');

  // Query station UUIDs
  const { data: stations } = await supabase.from('stations').select('id, name');
  const bharatiStation = stations?.find(s => s.name?.toLowerCase().includes('bharati'))?.id || null;
  const maitriStation = stations?.find(s => s.name?.toLowerCase().includes('maitri'))?.id || null;

  // 3. Update active credentials in Supabase with new hashes
  console.log('Updating gateway credentials with newly generated hashes...');
  const { error: updateBhrError } = await supabase
    .from('gateway_credentials')
    .update({
      name: 'Bharati Edge Gateway (Rotated)',
      key_hash: bhrHash,
      is_active: true,
      revoked_at: null,
      station_id: bharatiStation,
      updated_at: new Date().toISOString(),
    })
    .eq('gateway_id', 'EDGE-GW-BHR-01');

  if (updateBhrError) {
    console.error('Error updating BHR credential hash:', updateBhrError);
    process.exit(1);
  }

  const { error: updateMtrError } = await supabase
    .from('gateway_credentials')
    .update({
      name: 'Maitri Edge Gateway (Rotated)',
      key_hash: mtrHash,
      is_active: true,
      revoked_at: null,
      station_id: maitriStation,
      updated_at: new Date().toISOString(),
    })
    .eq('gateway_id', 'EDGE-GW-MTR-01');

  if (updateMtrError) {
    console.error('Error updating MTR credential hash:', updateMtrError);
    process.exit(1);
  }
  console.log('Successfully stored new key hashes in gateway_credentials table.');
  console.log(`BHR hash prefix: ${bhrHash.slice(0, 8)}...`);
  console.log(`MTR hash prefix: ${mtrHash.slice(0, 8)}...`);

  // 4. Update .env.production and .env.local
  console.log('Updating .env.production and .env.local with new keys and CRON_SECRET...');
  const envUpdates = {
    POLARIS_GATEWAY_KEY: newBhrKey,
    POLARIS_GATEWAY_KEY_MTR: newMtrKey,
    CRON_SECRET: cronSecret,
  };

  updateEnvFile('.env.production', envUpdates);
  const fullEnv = parseEnv('.env.production');
  updateEnvFile('.env.local', fullEnv);

  console.log('Environment configuration updated successfully.');
  console.log('--- Key Rotation Complete ---');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
