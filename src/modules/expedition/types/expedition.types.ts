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
