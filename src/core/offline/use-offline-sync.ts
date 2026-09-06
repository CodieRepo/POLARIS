'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PolarisIndexedDB } from './indexed-db';
import { MutationQueue } from './mutation-queue';
import { SyncState } from './types';

export function useOfflineSync() {
  const [syncState, setSyncState] = useState<SyncState>('ONLINE');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const isSyncingRef = useRef<boolean>(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const pending = await PolarisIndexedDB.getPendingMutations();
      setPendingCount(pending.length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (isSyncingRef.current || !navigator.onLine) {
      return;
    }

    try {
      isSyncingRef.current = true;
      setSyncState('SYNCING');

      const response = await MutationQueue.flushQueue();

      if (response && response.synced > 0) {
        setSyncState('SYNCED');
        setLastSyncTime(new Date().toLocaleTimeString());
      } else {
        setSyncState(navigator.onLine ? 'ONLINE' : 'OFFLINE');
      }
    } catch (err) {
      console.warn('[OfflineSync] Flush failed:', err);
      setSyncState('SYNC_FAILED');
    } finally {
      isSyncingRef.current = false;
      await refreshPendingCount();
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    // 1. Initial status & startup trigger
    if (typeof window !== 'undefined') {
      const isOnline = navigator.onLine;
      setSyncState(isOnline ? 'ONLINE' : 'OFFLINE');
      refreshPendingCount().then(() => {
        if (isOnline) {
          triggerSync();
        }
      });

      // 2. Network listener triggers
      const handleOnline = () => {
        setSyncState('ONLINE');
        triggerSync();
      };

      const handleOffline = () => {
        setSyncState('OFFLINE');
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // 3. Service Worker messages (e.g. background sync)
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'TRIGGER_OFFLINE_SYNC') {
          triggerSync();
        }
      };

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', handleMessage);
      }

      // 4. Polling interval to check pending queue (every 15s)
      const intervalId = setInterval(() => {
        refreshPendingCount();
      }, 15000);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.removeEventListener('message', handleMessage);
        }
        clearInterval(intervalId);
      };
    }
  }, [refreshPendingCount, triggerSync]);

  return {
    syncState,
    pendingCount,
    lastSyncTime,
    triggerSync,
    refreshPendingCount,
  };
}
