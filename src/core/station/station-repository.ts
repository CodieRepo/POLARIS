import { createServerClient } from "@/infrastructure/db/supabase-server";
import type { Database } from "@/infrastructure/db/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Direct database row representation for the stations table.
 * Sourced directly from the generated Supabase schema contract.
 */
export type StationRow = Database["public"]["Tables"]["stations"]["Row"];

/**
 * Repository for managing access to the polar research stations reference data.
 *
 * Responsibilities:
 * - Direct, typed read operations against the `stations` PostgreSQL table.
 * - Deterministic error propagation and null handling.
 * - Pure data-access boundary (no business logic, HTTP, or UI concerns).
 */
export class StationRepository {
  private readonly client: SupabaseClient<Database>;

  constructor(client?: SupabaseClient<Database>) {
    this.client = client ?? createServerClient();
  }

  /**
   * Retrieves a single station record by its unique UUID.
   *
   * @param id - The UUID primary key of the station.
   * @returns The station row if found, or `null` if no record exists.
   * @throws Error if an unexpected database error occurs.
   */
  async getById(id: string): Promise<StationRow | null> {
    const { data, error } = await this.client
      .from("stations")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch station by id '${id}': ${error.message}`);
    }

    return data;
  }

  /**
   * Retrieves a single station record by its unique station code (e.g., 'BHR', 'MTR').
   *
   * @param code - The unique alphanumeric station code.
   * @returns The station row if found, or `null` if no record exists.
   * @throws Error if an unexpected database error occurs.
   */
  async getByCode(code: string): Promise<StationRow | null> {
    const { data, error } = await this.client
      .from("stations")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch station by code '${code}': ${error.message}`);
    }

    return data;
  }

  /**
   * Retrieves all station records ordered deterministically by station code.
   *
   * @returns An array of station rows (empty array if no records exist).
   * @throws Error if an unexpected database error occurs.
   */
  async list(): Promise<StationRow[]> {
    const { data, error } = await this.client
      .from("stations")
      .select("*")
      .order("code", { ascending: true });

    if (error) {
      throw new Error(`Failed to list stations: ${error.message}`);
    }

    return data ?? [];
  }
}
