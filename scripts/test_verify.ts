import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

function parseEnv(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const env: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) {
      const k = m[1].trim();
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[k] = v;
    }
  }
  return env;
}

const env = parseEnv('.env.production');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: sitrep } = await supabase.from('daily_sitreps').select('*').limit(1).single();
  console.log('Sample SITREP in DB:', sitrep?.id, sitrep?.integrity_hash);

  if (sitrep) {
    const res = await fetch('https://polaris-five-eta.vercel.app/api/sitrep/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sitrep.id }),
    });
    const json = await res.json();
    console.log('Verify response status:', res.status);
    console.log('Verify response body:', json);
  }
}

test();
