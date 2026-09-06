'use client';

import React from 'react';
import { useOfflineSync } from '@/core/offline/use-offline-sync';

export function OfflineStatusBadge() {
  const { syncState, pendingCount, lastSyncTime, triggerSync } = useOfflineSync();

  const getStatusConfig = () => {
    switch (syncState) {
      case 'OFFLINE':
        return {
          label: 'OFFLINE',
          dotClass: 'bg-rose-500',
          badgeClass: 'bg-rose-950/70 border-rose-800 text-rose-300',
        };
      case 'SYNCING':
        return {
          label: 'SYNCING',
          dotClass: 'bg-cyan-400 animate-ping',
          badgeClass: 'bg-cyan-950/70 border-cyan-800 text-cyan-300',
        };
      case 'SYNCED':
        return {
          label: 'SYNCED',
          dotClass: 'bg-emerald-400',
          badgeClass: 'bg-emerald-950/70 border-emerald-800 text-emerald-300',
        };
      case 'SYNC_FAILED':
        return {
          label: 'SYNC FAILED',
          dotClass: 'bg-amber-500',
          badgeClass: 'bg-amber-950/70 border-amber-800 text-amber-300',
        };
      case 'ONLINE':
      default:
        return {
          label: 'ONLINE',
          dotClass: 'bg-emerald-500',
          badgeClass: 'bg-slate-900 border-slate-800 text-slate-300',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-center gap-2">
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border shadow-sm transition-all ${config.badgeClass}`}
        title={lastSyncTime ? `Last synced at ${lastSyncTime}` : 'IndexedDB offline buffer active'}
      >
        <span className={`h-2 w-2 rounded-full ${config.dotClass}`} />
        <span>{config.label}</span>
        {pendingCount > 0 && (
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px]">
            {pendingCount}
          </span>
        )}
      </div>

      {pendingCount > 0 && syncState !== 'SYNCING' && (
        <button
          onClick={() => triggerSync()}
          className="px-2 py-1 text-[11px] font-mono rounded bg-cyan-600/90 hover:bg-cyan-500 text-white font-medium transition shadow-sm"
          title="Flush offline queue to Supabase"
        >
          Sync Now
        </button>
      )}
    </div>
  );
}
