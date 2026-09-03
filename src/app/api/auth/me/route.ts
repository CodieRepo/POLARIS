import { getCurrentUserContext } from "@/infrastructure/auth/auth-context";
import { NextResponse } from "next/server";

/**
 * GET /api/auth/me
 * Returns current authenticated user context, application role, and linked person profile.
 */
export async function GET() {
  try {
    const contextResult = await getCurrentUserContext();

    if (!contextResult.success) {
      return NextResponse.json(
        { authenticated: false, error: contextResult.error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { authenticated: true, user: contextResult.data },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
