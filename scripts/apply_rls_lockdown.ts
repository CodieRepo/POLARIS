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

async function main() {
  const sql = fs.readFileSync('supabase/migrations/20260907100000_lockdown_rbac_rls_policies.sql', 'utf-8');
  console.log('Applying RLS Hardening Migration to Supabase...');

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  // Execute SQL statements via Supabase pg / SQL endpoint if available, or direct REST query
  // For Supabase hosted instances, we can execute SQL via postgres connection or management API
  console.log('SQL Migration file is ready in supabase/migrations/20260907100000_lockdown_rbac_rls_policies.sql');
}

main().catch(console.error);
