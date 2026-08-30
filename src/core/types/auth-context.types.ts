import type { Database } from "@/infrastructure/db/database.types";
import type { UseCaseResult } from "@/core/errors/application-errors";

/**
 * Application capability profile role derived directly from the generated database schema.
 */
export type AppRole = Database["public"]["Enums"]["app_role"];

/**
 * Core authenticated user context representing the verified application identity.
 * Transmitted across transport and application use-case boundaries.
 */
export interface UserContext {
  /** The immutable Supabase Auth user ID (auth.users.id) */
  readonly userId: string;
  /** Primary email address of the authenticated user */
  readonly email: string;
  /** The application capability profile role */
  readonly role: AppRole;
  /** Account activation status (always true for successful context) */
  readonly active: boolean;
  /** Optional link to operational field personnel record (persons.id) */
  readonly personId: string | null;
}

/**
 * Compile-time constrained subset of error codes specific to authentication & authorization.
 */
export type AuthErrorCode =
  | "UNAUTHENTICATED"
  | "UNAUTHORIZED"
  | "ACCOUNT_DEACTIVATED"
  | "PROFILE_NOT_FOUND"
  | "INFRASTRUCTURE_ERROR";

/**
 * Discriminated result union for UserContext resolution.
 */
export type UserContextResult = UseCaseResult<UserContext, AuthErrorCode>;
