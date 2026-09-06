// ==============================================================================
// POLARIS IndexedDB Offline Storage Client
// Description: Browser-side local storage engine for offline snapshots & mutation queue.
// SSR Safe: Gracefully degrades to no-op in server rendering contexts.
// ==============================================================================

import { OfflineMutation, MutationStatus } from './types';

const DB_NAME = 'polaris_offline_v2';
const DB_VERSION = 1;
const STORE_SNAPSHOTS = 'snapshots';
const STORE_MUTATIONS = 'mutation_queue';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) {
      return reject(new Error('IndexedDB is not available in non-browser context'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains(STORE_MUTATIONS)) {
        const mutationStore = db.createObjectStore(STORE_MUTATIONS, {
          keyPath: 'idempotencyKey',
        });
        mutationStore.createIndex('idx_status', 'status', { unique: false });
        mutationStore.createIndex('idx_createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class PolarisIndexedDB {
  /**
   * Caches a read-only snapshot of remote data (stations, fuel state, assets).
   */
  static async saveSnapshot(key: string, data: unknown): Promise<void> {
    if (!isBrowser()) return;
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      store.put({ key, data, cachedAt: new Date().toISOString() });
    } catch (err) {
      console.warn('[IndexedDB] Failed to save snapshot:', err);
    }
  }

  /**
   * Retrieves a cached snapshot.
   */
  static async getSnapshot<T>(key: string): Promise<T | null> {
    if (!isBrowser()) return null;
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
        const store = tx.objectStore(STORE_SNAPSHOTS);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? (req.result.data as T) : null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  /**
   * Enqueues an offline action into the mutation queue.
   */
  static async enqueueMutation(mutation: OfflineMutation): Promise<void> {
    if (!isBrowser()) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MUTATIONS, 'readwrite');
      const store = tx.objectStore(STORE_MUTATIONS);
      const req = store.put(mutation);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Fetches all pending or syncing mutations awaiting sync to cloud.
   */
  static async getPendingMutations(): Promise<OfflineMutation[]> {
    if (!isBrowser()) return [];
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_MUTATIONS, 'readonly');
        const store = tx.objectStore(STORE_MUTATIONS);
        const req = store.getAll();
        req.onsuccess = () => {
          const items: OfflineMutation[] = req.result || [];
          const pending = items
            .filter((i) => i.status === 'PENDING' || i.status === 'SYNCING')
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          resolve(pending);
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  /**
   * Updates status of an individual mutation.
   */
  static async updateMutationStatus(
    idempotencyKey: string,
    status: MutationStatus,
    error?: string
  ): Promise<void> {
    if (!isBrowser()) return;
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_MUTATIONS, 'readwrite');
      const store = tx.objectStore(STORE_MUTATIONS);
      const req = store.get(idempotencyKey);
      req.onsuccess = () => {
        const item: OfflineMutation = req.result;
        if (item) {
          item.status = status;
          item.syncAttempts = (item.syncAttempts || 0) + 1;
          if (error) item.lastError = error;
          store.put(item);
        }
      };
    } catch (err) {
      console.warn('[IndexedDB] Failed to update mutation status:', err);
    }
  }

  /**
   * Removes a mutation from the queue (e.g. once synced or explicitly cleared).
   */
  static async removeMutation(idempotencyKey: string): Promise<void> {
    if (!isBrowser()) return;
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_MUTATIONS, 'readwrite');
      const store = tx.objectStore(STORE_MUTATIONS);
      store.delete(idempotencyKey);
    } catch (err) {
      console.warn('[IndexedDB] Failed to remove mutation:', err);
    }
  }

  /**
   * Cleans all successfully synced mutations.
   */
  static async clearSyncedMutations(): Promise<void> {
    if (!isBrowser()) return;
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_MUTATIONS, 'readwrite');
      const store = tx.objectStore(STORE_MUTATIONS);
      const req = store.getAll();
      req.onsuccess = () => {
        const items: OfflineMutation[] = req.result || [];
        for (const i of items) {
          if (i.status === 'SYNCED') {
            store.delete(i.idempotencyKey);
          }
        }
      };
    } catch (err) {
      console.warn('[IndexedDB] Failed to clean synced mutations:', err);
    }
  }
}
