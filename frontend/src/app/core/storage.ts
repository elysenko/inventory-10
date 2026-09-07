/**
 * Namespaced browser-storage helper.
 *
 * Mockups are served many-per-origin under `/<mockup_id>/` and browser storage is
 * origin-scoped, not path-scoped — unprefixed keys collide with every other mockup the
 * reviewer has open. Every read/write in the app goes through here.
 *
 * The namespace is the first path segment, read from the resolved <base href> rather
 * than from `location.pathname` directly: the base element is computed once at page
 * load (see index.html) and therefore stays stable across SPA navigation, whereas
 * `location.pathname` changes on every route change and would silently re-namespace
 * the session mid-flow.
 */

function detectNamespace(): string {
  try {
    const base = document.querySelector('base')?.getAttribute('href') ?? '/';
    const segment = base.split('/').filter(Boolean)[0];
    return segment || 'app';
  } catch {
    return 'app';
  }
}

const NS = detectNamespace();

/** e.g. `49c3b66f-…-a4:user`. The colon separator is part of the contract. */
export const nsKey = (key: string): string => `${NS}:${key}`;

export const STORAGE_KEYS = {
  token: 'token',
  user: 'user',
} as const;

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(nsKey(key));
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(nsKey(key), value);
  } catch {
    /* Storage can be unavailable (private mode, blocked cookies) — never break the UI. */
  }
}

export function removeStorage(...keys: string[]): void {
  for (const key of keys) {
    try {
      localStorage.removeItem(nsKey(key));
    } catch {
      /* ignore */
    }
  }
}
