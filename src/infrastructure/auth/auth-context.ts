import { createAuthenticatedServerClient } from "./supabase-auth-server";
import type { UserContextResult } from "@/core/types/auth-context.types";

/**
 * Resolves the authenticated UserContext for the current server request.
 *
 * Flow:
 * 1. Obtains the user-scoped authenticated Supabase client (using HTTP-only cookies).
 * 2. Cryptographically verifies session token via `supabase.auth.getUser()`.
 * 3. Concurrently queries `public.profiles` (for application role & active status)
 *    and `public.persons` (for optional linked field personnel identity).
 * 4. Enforces active profile verification (inactive accounts return ACCOUNT_DEACTIVATED).
 * 5. Returns a deterministic, typed `UserContextResult` discriminated union.
 *
 * @returns UserContextResult containing active UserContext on success or typed error.
 */
export async function getCurrentUserContext(): Promise<UserContextResult> {
  const supabase = await createAuthenticatedServerClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return {
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "No active authenticated session.",
      },
    };
  }

  const user = authData.user;
  const email = user.email ?? "";

  // Concurrently query profile and optional field-person link by auth.users.id
  const [profileResult, personResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, active")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("persons")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    return {
      success: false,
      error: {
        code: "INFRASTRUCTURE_ERROR",
        message: "Failed to retrieve user profile.",
      },
    };
  }

  const profile = profileResult.data;

  if (!profile) {
    return {
      success: false,
      error: {
        code: "PROFILE_NOT_FOUND",
        message: `Application profile not found for user '${user.id}'.`,
      },
    };
  }

  if (!profile.active) {
    return {
      success: false,
      error: {
        code: "ACCOUNT_DEACTIVATED",
        message: "Application account has been deactivated.",
      },
    };
  }

  const personId = personResult.data?.id ?? null;

  return {
    success: true,
    data: {
      userId: user.id,
      email,
      role: profile.role,
      active: profile.active,
      personId,
    },
  };
}

/**
 * Requires an authenticated, active UserContext for protected use cases and route handlers.
 *
 * Pattern:
 * Returns `UseCaseResult<UserContext, AuthErrorCode>` to allow transport callers
 * to map failure codes directly to HTTP 401/403 responses without throwing exceptions.
 *
 * @returns UserContextResult containing guaranteed active UserContext on success.
 */
export async function requireUserContext(): Promise<UserContextResult> {
  return getCurrentUserContext();
}
