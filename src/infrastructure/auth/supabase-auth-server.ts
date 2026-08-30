import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/infrastructure/db/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Retrieves a required environment variable or throws a deterministic error.
 */
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Ensure it is configured in .env.local.`
    );
  }
  return value;
}

/**
 * Creates an authenticated, user-scoped Supabase client for Next.js 15 Server contexts
 * (Server Components, Server Actions, and Route Handlers).
 *
 * Security & Architectural Boundaries:
 * - Uses the public anonymous key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`).
 * - Forwards the user's session JWT stored in HTTP-only cookies.
 * - Subject to PostgreSQL Row-Level Security (RLS) policies.
 * - NEVER uses or exposes `SUPABASE_SERVICE_ROLE_KEY`.
 * - Awaits Next.js 15 asynchronous `cookies()` API.
 *
 * @returns A typed SupabaseClient instance scoped to the requesting user session.
 */
export async function createAuthenticatedServerClient(): Promise<
  SupabaseClient<Database>
> {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if middleware or a Server Action refreshes sessions.
        }
      },
    },
  });
}
