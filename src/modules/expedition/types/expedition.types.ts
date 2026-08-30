import type { Database } from "@/infrastructure/db/database.types";

/**
 * Direct database row representation for the expeditions table.
 * Sourced directly from the generated Supabase schema contract.
 */
export type ExpeditionRow = Database["public"]["Tables"]["expeditions"]["Row"];

/**
 * Expedition operational lifecycle status enum.
 * Sourced directly from the generated Supabase schema contract.
 */
export type ExpeditionStatus =
  Database["public"]["Enums"]["expedition_status"];

/**
 * Data classification level for polar expedition data.
 * Sourced directly from the generated Supabase schema contract.
 */
export type DataClassification =
  Database["public"]["Enums"]["data_classification"];

/**
 * Direct database row representation for the expedition_members table.
 * Sourced directly from the generated Supabase schema contract.
 */
export type ExpeditionMemberRow =
  Database["public"]["Tables"]["expedition_members"]["Row"];

/**
 * Filter options for querying expedition collections.
 */
export interface ExpeditionListFilters {
  readonly status?: ExpeditionStatus;
}

/**
 * Input contract for creating a new polar expedition.
 * Note: Status is not caller-controlled; new expeditions always begin as DRAFT.
 */
export interface CreateExpeditionInput {
  readonly code: string;
  readonly name: string;
  readonly description?: string | null;
  readonly origin_station_id?: string | null;
  readonly destination_station_id: string;
  readonly planned_start_at: string;
  readonly planned_end_at: string;
  readonly data_classification?: DataClassification;
  readonly initial_leader_person_id?: string | null;
}

/**
 * Input contract for updating descriptive metadata of an existing expedition.
 * Strictly excludes immutable fields (id, code, data_classification) and lifecycle status.
 */
export interface UpdateExpeditionMetadataInput {
  readonly name?: string;
  readonly description?: string | null;
  readonly origin_station_id?: string | null;
  readonly destination_station_id?: string;
  readonly planned_start_at?: string;
  readonly planned_end_at?: string;
}

/**
 * Input contract for executing lifecycle status transitions.
 * Bounded strictly to the target state and operational timestamps required by the state machine.
 */
export interface UpdateExpeditionStatusInput {
  readonly targetStatus: ExpeditionStatus;
  readonly actual_start_at?: string;
  readonly actual_end_at?: string;
}

/**
 * Validated domain assignment roles for expedition roster members.
 * Enforced at database level via CHECK constraint.
 */
export type ExpeditionAssignmentRole =
  | "EXPEDITION_LEADER"
  | "EXPEDITION_MEMBER";

/**
 * Input contract for adding a member to an expedition roster.
 */
export interface AddExpeditionMemberInput {
  readonly expedition_id: string;
  readonly person_id: string;
  readonly assignment_role: ExpeditionAssignmentRole;
  readonly joined_at?: string;
}

/**
 * Input contract for removing a member from an expedition roster (soft departure).
 */
export interface RemoveExpeditionMemberInput {
  readonly expedition_id: string;
  readonly person_id: string;
}

/**
 * Input contract for updating a member's operational role.
 * Restricted to non-leader role modifications.
 */
export interface UpdateMemberRoleInput {
  readonly expedition_id: string;
  readonly person_id: string;
  readonly new_role: ExpeditionAssignmentRole;
}

/**
 * Input contract for atomically replacing an operational expedition leader.
 */
export interface ReplaceExpeditionLeaderInput {
  readonly expedition_id: string;
  readonly new_leader_person_id: string;
}

/**
 * Input contract for directly updating mutable fields on an expedition_members row in the repository.
 * Strictly excludes primary key, foreign keys, and audit creation timestamps.
 */
export interface UpdateExpeditionMemberInput {
  readonly assignment_role?: ExpeditionAssignmentRole;
  readonly joined_at?: string;
  readonly left_at?: string | null;
}

/**
 * Public field person profile embedded within an expedition roster projection.
 * Strictly excludes auth_user_id to prevent leaking identity linkage.
 */
export interface ExpeditionRosterPerson {
  readonly id: string;
  readonly display_name: string;
  readonly role_title: string | null;
  readonly organization: string | null;
  readonly active: boolean;
}

/**
 * Composite expedition roster member representation combining assignment metadata with operational person profile.
 */
export interface ExpeditionRosterMember {
  readonly id: string;
  readonly expedition_id: string;
  readonly person_id: string;
  readonly assignment_role: string;
  readonly joined_at: string;
  readonly left_at: string | null;
  readonly person: ExpeditionRosterPerson | null;
}

/**
 * Filter options for querying expedition roster records.
 */
export interface GetExpeditionRosterFilters {
  readonly includeDeparted?: boolean;
}
