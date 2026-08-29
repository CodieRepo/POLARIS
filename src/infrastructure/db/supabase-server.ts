import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Environment variable names for Supabase configuration.
 *
 * NEXT_PUBLIC_SUPABASE_URL — The Supabase project URL (public).
 * SUPABASE_SERVICE_ROLE_KEY — The service-role key (SERVER-SIDE ONLY).
 *   This key bypasses RLS. It must NEVER be exposed to browser/client code.
 *   Do not prefix with NEXT_PUBLIC_.
 */

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Ensure it is set in .env.local (never commit real credentials).`
    );
  }
  return value;
}

/**
 * Creates a Supabase client configured with the service-role key.
 *
 * This client has full access and bypasses Row Level Security.
 * It must ONLY be used in server-side contexts (Server Components,
 * Server Actions, Route Handlers, API routes).
 *
 * Usage:
 *   const supabase = createServerClient();
 *
 * Throws if required environment variables are not configured.
 */
export function createServerClient(): SupabaseClient {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
