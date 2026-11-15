import { ComponentType, lazy } from 'react';

const CHUNK_RELOAD_KEY = 'krentprocent_chunk_reload_ts';
const RELOAD_COOLDOWN_MS = 15_000;

export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return (
    /failed to fetch dynamically imported module/i.test(message) ||
    /importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /chunkloaderror/i.test(message) ||
    /loading chunk [\w-]+ failed/i.test(message)
  );
}

/**
 * Triggers at most one hard reload within RELOAD_COOLDOWN_MS when a stale
 * deployment chunk is detected, preventing infinite reload loops if offline.
 */
export function attemptStaleChunkReload(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0');
    const now = Date.now();
    if (now - last > RELOAD_COOLDOWN_MS) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
      window.location.reload();
      return true;
    }
  } catch {
    // sessionStorage unavailable; skip automatic reload
  }
  return false;
}

/**
 * Wraps React.lazy with automatic retry and stale-deployment recovery.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await loader();
    } catch (firstError) {
      // Retry once in case of a brief network hiccup
      try {
        return await loader();
      } catch (retryError) {
        if (isChunkLoadError(retryError)) {
          attemptStaleChunkReload();
        }
        throw retryError || firstError;
      }
    }
  });
}
