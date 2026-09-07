// ==============================================================================
// POLARIS Offline Domain Types
// Description: Type definitions for IndexedDB client store, mutation queue,
//              idempotency, and network synchronization states.
// ==============================================================================

export type OfflineActionType =
  | 'SUBMIT_SITREP'
  | 'LOG_FUEL_DIP'
  | 'LOG_MAINTENANCE'
  | 'UPDATE_CONTAINER'
  | 'RECORD_TRAVERSE_CHECKIN';

export type MutationStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

export type SyncState = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'SYNCED' | 'SYNC_FAILED';

export interface OfflineMutation {
  idempotencyKey: string; // UUID v4 primary key
  actionType: OfflineActionType;
  stationId: string;
  payload: Record<string, unknown>;
  createdAt: string; // ISO 8601
  syncAttempts: number;
  status: MutationStatus;
  lastError?: string | null;
}

export interface OfflineSnapshot {
  key: string; // e.g. 'station_baseline'
  data: unknown;
  cachedAt: string;
}

export interface OfflineSyncRequest {
  mutations: OfflineMutation[];
}

export interface MutationSyncResult {
  idempotencyKey: string;
  status: 'COMPLETED' | 'FAILED';
  error?: string;
  data?: unknown;
}

export interface OfflineSyncResponse {
  success: boolean;
  synced: number;
  failed: number;
  results: MutationSyncResult[];
  processedAt: string;
}
