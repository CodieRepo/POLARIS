import type { Database } from "@/infrastructure/db/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateExpeditionInput,
  ExpeditionListFilters,
  ExpeditionMemberRow,
  ExpeditionRow,
  ExpeditionStatus,
  ReplaceExpeditionLeaderInput,
  UpdateExpeditionMemberInput,
  UpdateExpeditionMetadataInput,
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
 * Custom error indicating a PostgreSQL unique constraint violation (e.g. duplicate expedition code).
 */
export class ExpeditionConflictError extends Error {
  readonly code = "23505";
  constructor(message: string) {
    super(message);
    this.name = "ExpeditionConflictError";
  }
}

/**
 * Custom error indicating a database-level state machine or check constraint violation (e.g. trigger error 22000).
 */
export class ExpeditionStateViolationError extends Error {
  readonly code = "22000";
  constructor(message: string) {
    super(message);
    this.name = "ExpeditionStateViolationError";
  }
}

/**
 * Custom error indicating an authorization or privilege rejection from PostgreSQL (e.g. 42501).
 */
export class UnauthorizedDatabaseError extends Error {
  readonly code = "42501";
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedDatabaseError";
  }
}

/**
 * Repository for managing access and mutations for polar expeditions and rosters.
 *
 * Responsibilities:
 * - Direct, typed operations against `public.expeditions` and `public.expedition_members`.
 * - Executes strictly within the caller's authenticated security context (PostgreSQL RLS).
 * - Enforces status initialization to DRAFT on creation.
 * - Pure data-access boundary (no HTTP, session handling, or UI concerns).
 */
export class ExpeditionRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  /**
   * Retrieves a single expedition record by its unique alphanumeric code (e.g., 'EXP-01').
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

  /**
   * Inserts a new expedition row in DRAFT status.
   * Status is strictly non-caller-controlled.
   */
  async create(
    input: Omit<CreateExpeditionInput, "initial_leader_person_id">
  ): Promise<ExpeditionRow> {
    const { data, error } = await this.client
      .from("expeditions")
      .insert({
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        origin_station_id: input.origin_station_id ?? null,
        destination_station_id: input.destination_station_id,
        planned_start_at: input.planned_start_at,
        planned_end_at: input.planned_end_at,
        data_classification: input.data_classification ?? "AUTHORITATIVE_REAL",
        status: "DRAFT",
      })
      .select(EXPEDITION_SELECT_COLUMNS)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new ExpeditionConflictError(
          `Expedition with code '${input.code}' already exists.`
        );
      }
      throw new Error(`Failed to create expedition: ${error.message}`);
    }

    return data as ExpeditionRow;
  }

  /**
   * Updates descriptive metadata for an existing expedition.
   * Mutates only allowed metadata fields.
   */
  async updateMetadata(
    id: string,
    input: UpdateExpeditionMetadataInput
  ): Promise<ExpeditionRow | null> {
    const normalizedId = id?.trim();
    if (!normalizedId) {
      return null;
    }

    const updatePayload: Database["public"]["Tables"]["expeditions"]["Update"] = {};
    if (input.name !== undefined) updatePayload.name = input.name;
    if (input.description !== undefined) updatePayload.description = input.description;
    if (input.origin_station_id !== undefined) updatePayload.origin_station_id = input.origin_station_id;
    if (input.destination_station_id !== undefined) updatePayload.destination_station_id = input.destination_station_id;
    if (input.planned_start_at !== undefined) updatePayload.planned_start_at = input.planned_start_at;
    if (input.planned_end_at !== undefined) updatePayload.planned_end_at = input.planned_end_at;

    const { data, error } = await this.client
      .from("expeditions")
      .update(updatePayload)
      .eq("id", normalizedId)
      .select(EXPEDITION_SELECT_COLUMNS)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to update expedition metadata for '${normalizedId}': ${error.message}`
      );
    }

    return (data as ExpeditionRow | null) ?? null;
  }

  /**
   * Updates the lifecycle status and actual timestamps of an expedition.
   * Subject to the database-level state machine trigger.
   */
  async updateStatus(
    id: string,
    status: ExpeditionStatus,
    timestamps?: {
      actual_start_at?: string | null;
      actual_end_at?: string | null;
    }
  ): Promise<ExpeditionRow | null> {
    const normalizedId = id?.trim();
    if (!normalizedId) {
      return null;
    }

    const updatePayload: Database["public"]["Tables"]["expeditions"]["Update"] = { status };
    if (timestamps?.actual_start_at !== undefined) {
      updatePayload.actual_start_at = timestamps.actual_start_at;
    }
    if (timestamps?.actual_end_at !== undefined) {
      updatePayload.actual_end_at = timestamps.actual_end_at;
    }

    const { data, error } = await this.client
      .from("expeditions")
      .update(updatePayload)
      .eq("id", normalizedId)
      .select(EXPEDITION_SELECT_COLUMNS)
      .maybeSingle();

    if (error) {
      if (error.code === "22000" || error.message.includes("Invalid expedition status transition")) {
        throw new ExpeditionStateViolationError(error.message);
      }
      throw new Error(
        `Failed to update expedition status for '${normalizedId}': ${error.message}`
      );
    }

    return (data as ExpeditionRow | null) ?? null;
  }

  /**
   * Deletes an expedition by UUID primary key.
   * Subject to PostgreSQL RLS (SUPER_ADMIN and status = 'DRAFT').
   */
  async delete(id: string): Promise<boolean> {
    const normalizedId = id?.trim();
    if (!normalizedId) {
      return false;
    }

    const { data, error } = await this.client
      .from("expeditions")
      .delete()
      .eq("id", normalizedId)
      .select("id");

    if (error) {
      throw new Error(`Failed to delete expedition '${normalizedId}': ${error.message}`);
    }

    return (data?.length ?? 0) > 0;
  }

  /**
   * Retrieves an active member record for a specific expedition and person (left_at IS NULL).
   */
  async getActiveMember(
    expeditionId: string,
    personId: string
  ): Promise<ExpeditionMemberRow | null> {
    const normalizedExpeditionId = expeditionId?.trim();
    const normalizedPersonId = personId?.trim();
    if (!normalizedExpeditionId || !normalizedPersonId) {
      return null;
    }

    const { data, error } = await this.client
      .from("expedition_members")
      .select(EXPEDITION_MEMBER_SELECT_COLUMNS)
      .eq("expedition_id", normalizedExpeditionId)
      .eq("person_id", normalizedPersonId)
      .is("left_at", null)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to fetch active member for expedition '${normalizedExpeditionId}' and person '${normalizedPersonId}': ${error.message}`
      );
    }

    return (data as ExpeditionMemberRow | null) ?? null;
  }

  /**
   * Retrieves the currently active EXPEDITION_LEADER for an expedition (left_at IS NULL).
   * Guaranteed to be at most one by PostgreSQL partial unique index.
   */
  async getActiveLeader(
    expeditionId: string
  ): Promise<ExpeditionMemberRow | null> {
    const normalizedExpeditionId = expeditionId?.trim();
    if (!normalizedExpeditionId) {
      return null;
    }

    const { data, error } = await this.client
      .from("expedition_members")
      .select(EXPEDITION_MEMBER_SELECT_COLUMNS)
      .eq("expedition_id", normalizedExpeditionId)
      .eq("assignment_role", "EXPEDITION_LEADER")
      .is("left_at", null)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to fetch active leader for expedition '${normalizedExpeditionId}': ${error.message}`
      );
    }

    return (data as ExpeditionMemberRow | null) ?? null;
  }

  /**
   * Soft-removes an active member by setting left_at = now().
   * Preserves full operational roster history.
   */
  async removeMember(
    expeditionId: string,
    personId: string
  ): Promise<ExpeditionMemberRow | null> {
    const normalizedExpeditionId = expeditionId?.trim();
    const normalizedPersonId = personId?.trim();
    if (!normalizedExpeditionId || !normalizedPersonId) {
      return null;
    }

    const nowIso = new Date().toISOString();
    const { data, error } = await this.client
      .from("expedition_members")
      .update({
        left_at: nowIso,
        updated_at: nowIso,
      })
      .eq("expedition_id", normalizedExpeditionId)
      .eq("person_id", normalizedPersonId)
      .is("left_at", null)
      .select(EXPEDITION_MEMBER_SELECT_COLUMNS)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to remove member '${normalizedPersonId}' from expedition '${normalizedExpeditionId}': ${error.message}`
      );
    }

    return (data as ExpeditionMemberRow | null) ?? null;
  }

  /**
   * Updates mutable fields on an expedition member record (assignment_role, joined_at, left_at).
   * Supports role changes and rejoining departed members (clearing left_at).
   */
  async updateMember(
    expeditionId: string,
    personId: string,
    updates: UpdateExpeditionMemberInput
  ): Promise<ExpeditionMemberRow | null> {
    const normalizedExpeditionId = expeditionId?.trim();
    const normalizedPersonId = personId?.trim();
    if (!normalizedExpeditionId || !normalizedPersonId) {
      return null;
    }

    const updatePayload: Database["public"]["Tables"]["expedition_members"]["Update"] = {
      updated_at: new Date().toISOString(),
    };

    if (updates.assignment_role !== undefined) {
      updatePayload.assignment_role = updates.assignment_role;
    }
    if (updates.joined_at !== undefined) {
      updatePayload.joined_at = updates.joined_at;
    }
    if (updates.left_at !== undefined) {
      updatePayload.left_at = updates.left_at;
    }

    const { data, error } = await this.client
      .from("expedition_members")
      .update(updatePayload)
      .eq("expedition_id", normalizedExpeditionId)
      .eq("person_id", normalizedPersonId)
      .select(EXPEDITION_MEMBER_SELECT_COLUMNS)
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        throw new ExpeditionConflictError(
          `Expedition member conflict for person '${normalizedPersonId}' in expedition '${normalizedExpeditionId}': ${error.message}`
        );
      }
      if (error.code === "23514" || error.code === "22000") {
        throw new ExpeditionStateViolationError(
          `Invalid expedition member update: ${error.message}`
        );
      }
      throw new Error(
        `Failed to update expedition member '${normalizedPersonId}' in expedition '${normalizedExpeditionId}': ${error.message}`
      );
    }

    return (data as ExpeditionMemberRow | null) ?? null;
  }

  /**
   * Adds a member to an expedition roster.
   */
  async addMember(input: {
    expedition_id: string;
    person_id: string;
    assignment_role: string;
    joined_at?: string;
  }): Promise<ExpeditionMemberRow> {
    const { data, error } = await this.client
      .from("expedition_members")
      .insert({
        expedition_id: input.expedition_id,
        person_id: input.person_id,
        assignment_role: input.assignment_role,
        joined_at: input.joined_at ?? new Date().toISOString(),
      })
      .select(EXPEDITION_MEMBER_SELECT_COLUMNS)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new ExpeditionConflictError(
          `Expedition member conflict for person '${input.person_id}' in expedition '${input.expedition_id}': ${error.message}`
        );
      }
      if (error.code === "23514" || error.code === "22000") {
        throw new ExpeditionStateViolationError(
          `Invalid expedition member insert: ${error.message}`
        );
      }
      throw new Error(`Failed to add expedition member: ${error.message}`);
    }

    return data as ExpeditionMemberRow;
  }

  /**
   * Invokes the PostgreSQL SECURITY DEFINER RPC `replace_expedition_leader`
   * to atomically replace an active operational expedition leader.
   */
  async callReplaceLeaderRpc(
    input: ReplaceExpeditionLeaderInput
  ): Promise<ExpeditionMemberRow> {
    const { data, error } = await this.client.rpc("replace_expedition_leader", {
      target_expedition_id: input.expedition_id,
      new_leader_person_id: input.new_leader_person_id,
    });

    if (error) {
      if (error.code === "42501") {
        throw new UnauthorizedDatabaseError(error.message);
      }
      if (error.code === "22000") {
        throw new ExpeditionStateViolationError(error.message);
      }
      if (error.code === "23505") {
        throw new ExpeditionConflictError(error.message);
      }
      throw new Error(`Failed to replace expedition leader: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error("RPC returned no records after leader replacement.");
    }

    if (data.length > 1) {
      throw new Error(
        "RPC returned unexpected multiple rows for active leader replacement."
      );
    }

    return data[0] as ExpeditionMemberRow;
  }
}
