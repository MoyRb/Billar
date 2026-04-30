'use client';

import { useEffect } from 'react';

export function PWAServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch (error) {
        console.error('Error registrando Service Worker:', error);
      }
    };

    void registerServiceWorker();
  }, []);

  return null;
}
