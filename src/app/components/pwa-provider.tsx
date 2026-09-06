'use client';

import { useEffect } from 'react';

export function PwaProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[POLARIS PWA] Service Worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[POLARIS PWA] Service Worker registration failed:', err);
        });
    }
  }, []);

  return <>{children}</>;
}
