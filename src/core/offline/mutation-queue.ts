// ==============================================================================
// POLARIS Mutation Queue Client Helper
// Description: Generates idempotent UUIDs and buffers actions into IndexedDB.
// ==============================================================================

import { PolarisIndexedDB } from './indexed-db';
import { OfflineActionType, OfflineMutation, OfflineSyncResponse } from './types';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class MutationQueue {
  /**
   * Enqueues an action with a guaranteed client-generated UUID v4 idempotency key.
   */
  static async enqueue(
    actionType: OfflineActionType,
    stationId: string,
    payload: Record<string, unknown>
  ): Promise<string> {
    const idempotencyKey = generateUUID();
    const mutation: OfflineMutation = {
      idempotencyKey,
      actionType,
      stationId,
      payload,
      createdAt: new Date().toISOString(),
      syncAttempts: 0,
      status: 'PENDING',
    };

    await PolarisIndexedDB.enqueueMutation(mutation);
    return idempotencyKey;
  }

  /**
   * Flushes all pending mutations to the server-side zero-trust /api/offline/sync endpoint.
   */
  static async flushQueue(): Promise<OfflineSyncResponse | null> {
    const pending = await PolarisIndexedDB.getPendingMutations();
    if (pending.length === 0) {
      return null;
    }

    // Mark as SYNCING in IndexedDB
    for (const m of pending) {
      await PolarisIndexedDB.updateMutationStatus(m.idempotencyKey, 'SYNCING');
    }

    try {
      const res = await fetch('/api/offline/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mutations: pending }),
      });

      if (!res.ok) {
        throw new Error(`Sync server responded with ${res.status}`);
      }

      const syncResp: OfflineSyncResponse = await res.json();

      // Reconcile each result
      for (const r of syncResp.results) {
        if (r.status === 'COMPLETED') {
          await PolarisIndexedDB.updateMutationStatus(r.idempotencyKey, 'SYNCED');
          // Optionally remove once confirmed
          await PolarisIndexedDB.removeMutation(r.idempotencyKey);
        } else {
          await PolarisIndexedDB.updateMutationStatus(
            r.idempotencyKey,
            'FAILED',
            r.error || 'Server rejected mutation'
          );
        }
      }

      return syncResp;
    } catch (err) {
      const error = err as Error;
      // Revert to PENDING with recorded error
      for (const m of pending) {
        await PolarisIndexedDB.updateMutationStatus(
          m.idempotencyKey,
          'PENDING',
          error.message || 'Network connection unavailable'
        );
      }
      throw error;
    }
  }
}
