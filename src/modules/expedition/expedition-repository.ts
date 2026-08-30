import type { Database } from "@/infrastructure/db/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ExpeditionListFilters,
  ExpeditionMemberRow,
  ExpeditionRow,
} from "./types/expedition.types";

/**
 * Explicit column projection for the expeditions table.
 * Strictly avoids `select('*')` to maintain explicit, bounded data selection.
 */
const EXPEDITION_SELECT_COLUMNS =
  "id, code, name, description, status, data_classification, origin_station_id, destination_station_id, planned_start_at, planned_end_at, actual_start_at, actual_end_at, created_at, updated_at" as const;

/**
 * Explicit column projection for the expedition_members table.
 */
const EXPEDITION_MEMBER_SELECT_COLUMNS =
  "id, expedition_id, person_id, assignment_role, joined_at, left_at, created_at, updated_at" as const;

/**
 * Repository for managing access to polar expedition data and rosters.
 *
 * Responsibilities:
 * - Direct, typed read operations against `public.expeditions` and `public.expedition_members`.
 * - Executes within the authenticated caller's security context (subject to PostgreSQL RLS).
 * - Deterministic error propagation and null handling.
 * - Pure data-access boundary (no business logic, HTTP, or UI concerns).
 */
export class ExpeditionRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  /**
   * Retrieves a single expedition record by its unique alphanumeric code (e.g., 'EXP-01').
   *
   * @param code - The unique human-readable expedition code.
   * @returns The expedition row if found and accessible under RLS, or `null`.
   * @throws Error if an unexpected database infrastructure error occurs.
   */
  async getByCode(code: string): Promise<ExpeditionRow | null> {
    const normalizedCode = code?.trim();
    if (!normalizedCode) {
      return null;
    }

    const { data, error } = await this.client
      .from("expeditions")
      .select(EXPEDITION_SELECT_COLUMNS)
      .eq("code", normalizedCode)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to fetch expedition by code '${normalizedCode}': ${error.message}`
      );
    }

    return (data as ExpeditionRow | null) ?? null;
  }

  /**
   * Retrieves a single expedition record by its UUID primary key.
   *
   * @param id - The UUID of the expedition.
   * @returns The expedition row if found and accessible under RLS, or `null`.
   * @throws Error if an unexpected database infrastructure error occurs.
   */
  async getById(id: string): Promise<ExpeditionRow | null> {
    const normalizedId = id?.trim();
    if (!normalizedId) {
      return null;
    }

    const { data, error } = await this.client
      .from("expeditions")
      .select(EXPEDITION_SELECT_COLUMNS)
      .eq("id", normalizedId)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to fetch expedition by id '${normalizedId}': ${error.message}`
      );
    }

    return (data as ExpeditionRow | null) ?? null;
  }

  /**
   * Retrieves all expedition records accessible to the authenticated user under RLS,
   * optionally filtered by operational status.
   *
   * @param filters - Optional query filters (e.g. status).
   * @returns An array of expedition rows ordered deterministically by code.
   * @throws Error if an unexpected database infrastructure error occurs.
   */
  async list(filters?: ExpeditionListFilters): Promise<ExpeditionRow[]> {
    let query = this.client
      .from("expeditions")
      .select(EXPEDITION_SELECT_COLUMNS)
      .order("code", { ascending: true });

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list expeditions: ${error.message}`);
    }

    return (data as ExpeditionRow[] | null) ?? [];
  }

  /**
   * Retrieves member roster records for a specific expedition.
   *
   * @param expeditionId - The UUID of the expedition.
   * @returns An array of expedition member rows ordered by joined_at.
   * @throws Error if an unexpected database infrastructure error occurs.
   */
  async getMembers(expeditionId: string): Promise<ExpeditionMemberRow[]> {
    const normalizedId = expeditionId?.trim();
    if (!normalizedId) {
      return [];
    }

    const { data, error } = await this.client
      .from("expedition_members")
      .select(EXPEDITION_MEMBER_SELECT_COLUMNS)
      .eq("expedition_id", normalizedId)
      .order("joined_at", { ascending: true });

    if (error) {
      throw new Error(
        `Failed to fetch expedition members for expedition '${normalizedId}': ${error.message}`
      );
    }

    return (data as ExpeditionMemberRow[] | null) ?? [];
  }
}
