/**
 * Standard compile-time constrained union of application error codes.
 * Ensures typo-free error handling across use-case boundaries without runtime string bloat.
 */
export type ApplicationErrorCode =
  | "STATION_NOT_FOUND"
  | "EXPEDITION_NOT_FOUND"
  | "EXPEDITION_ALREADY_EXISTS"
  | "EXPEDITION_MEMBER_NOT_FOUND"
  | "EXPEDITION_MEMBER_ALREADY_EXISTS"
  | "EXPEDITION_LEADER_REQUIRED"
  | "INVALID_EXPEDITION_INPUT"
  | "INVALID_EXPEDITION_STATE"
  | "INFRASTRUCTURE_ERROR"
  | "UNAUTHENTICATED"
  | "UNAUTHORIZED"
  | "ACCOUNT_DEACTIVATED"
  | "PROFILE_NOT_FOUND";

/**
 * Standard structured error representation returned by application use cases.
 */
export interface ApplicationError<
  TCode extends ApplicationErrorCode = ApplicationErrorCode,
> {
  readonly code: TCode;
  readonly message: string;
}

/**
 * Discriminated union for application use-case execution results.
 * Guarantees compile-time type narrowing between success and failure states.
 */
export type UseCaseResult<
  TData,
  TCode extends ApplicationErrorCode = ApplicationErrorCode,
> =
  | { readonly success: true; readonly data: TData }
  | { readonly success: false; readonly error: ApplicationError<TCode> };
