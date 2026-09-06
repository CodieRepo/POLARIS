import { getCurrentUserContext } from "./auth-context";
import { isActionPermitted, type PolarisAction } from "@/core/auth/rbac-permissions";
import type { AppRole, UserContext } from "@/core/types/auth-context.types";
import { NextResponse } from "next/server";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 403,
    public readonly code: string = "UNAUTHORIZED"
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Authoritatively verifies that the incoming request is from an active authenticated user
 * and that the user's role is in the allowed list.
 *
 * @param allowedRoles - Explicit list of permitted application roles.
 * @returns Verified UserContext
 * @throws AuthError with HTTP 401 or 403 status code
 */
export async function requireAuthorizedRole(allowedRoles: readonly AppRole[]): Promise<UserContext> {
  const result = await getCurrentUserContext();

  if (!result.success) {
    const err = result.error;
    if (err.code === "ACCOUNT_DEACTIVATED") {
      throw new AuthError("Application account has been deactivated.", 403, "ACCOUNT_DEACTIVATED");
    }
    throw new AuthError(err.message || "Authentication required.", 401, "UNAUTHENTICATED");
  }

  const user = result.data;

  if (!allowedRoles.includes(user.role)) {
    throw new AuthError(
      `Role '${user.role}' is not authorized to execute this operational action.`,
      403,
      "UNAUTHORIZED"
    );
  }

  return user;
}

/**
 * Authoritatively verifies that the incoming request is permitted to perform the specified PolarisAction.
 *
 * @param action - The domain action contract.
 * @returns Verified UserContext
 * @throws AuthError with HTTP 401 or 403 status code
 */
export async function requireActionPermission(
  action: PolarisAction
): Promise<UserContext> {
  const result = await getCurrentUserContext();

  if (!result.success) {
    const err = result.error;
    if (err.code === "ACCOUNT_DEACTIVATED") {
      throw new AuthError("Application account has been deactivated.", 403, "ACCOUNT_DEACTIVATED");
    }
    throw new AuthError(err.message || "Authentication required.", 401, "UNAUTHENTICATED");
  }

  const user = result.data;

  if (!isActionPermitted(user.role, action)) {
    throw new AuthError(
      `Role '${user.role}' does not possess permission for action '${action}'.`,
      403,
      "UNAUTHORIZED"
    );
  }

  return user;
}

/**
 * Helper to catch AuthError and return consistent JSON response in API routes.
 */
export function handleAuthError(err: unknown): NextResponse | null {
  if (err instanceof AuthError) {
    return NextResponse.json(
      {
        success: false,
        error: err.message,
        code: err.code,
      },
      { status: err.statusCode }
    );
  }
  return null;
}
