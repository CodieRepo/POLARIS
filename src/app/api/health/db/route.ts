import { createServerClient } from "@/infrastructure/db/supabase-server";
import { NextResponse } from "next/server";

/**
 * GET /api/health/db
 *
 * Minimal non-destructive connectivity verification for the Supabase
 * database connection. This endpoint:
 *
 * - Checks that required environment variables are configured
 * - Instantiates the server-side Supabase client
 * - Executes a safe read-only query (SELECT 1) to verify connectivity
 * - Does NOT create tables, write data, or require authentication
 *
 * Intended for development/verification only.
 */
export async function GET() {
  // Step 1: Check environment variables are present
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        status: "not_configured",
        message:
          "Supabase credentials are not configured. " +
          "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
        checks: {
          NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? "set" : "missing",
          SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey ? "set" : "missing",
        },
      },
      { status: 503 }
    );
  }

  // Step 2: Attempt client instantiation and safe connectivity check
  try {
    const supabase = createServerClient();

    // Safe, read-only typed probe — verifies connectivity and schema access.
    const result = await supabase.from("stations").select("id").limit(1);

    if (result.error) {
      return NextResponse.json(
        {
          status: "error",
          message: "Database query failed.",
          supabaseUrl,
          serverResponse: result.error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "connected",
      message: "Supabase connection verified successfully.",
      supabaseUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to connect to Supabase.",
        error: message,
      },
      { status: 500 }
    );
  }
}
