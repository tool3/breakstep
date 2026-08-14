import { useCallback, useEffect, useRef, useState } from 'react';

/** Namespaced so a stray key from another app on localhost can't collide. */
// Bumped when the template catalogue is restructured: old ids no longer mean
// what they used to, so stale saved code must not reattach to a new template.
export const STORAGE_PREFIX = 'breakstep:v2:';

export function readStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    // Private browsing, quota errors, or corrupted JSON — the default is fine.
    return fallback;
  }
}

export function writeStored<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or blocked; losing persistence is not worth an error.
  }
}

export function removeStored(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** `useState` that survives a reload. */
export function useLocalStorage<T>(key: string, initial: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readStored(key, initial));
  const keyRef = useRef(key);

  useEffect(() => {
    // A changed key means a different slot — re-read rather than overwrite it.
    if (keyRef.current !== key) {
      keyRef.current = key;
      setValue(readStored(key, initial));
    }
  }, [key, initial]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        writeStored(keyRef.current, resolved);
        return resolved;
      });
    },
    [],
  );

  return [value, update];
}
