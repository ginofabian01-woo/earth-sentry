// Tiny cached fetch wrapper. In-memory + localStorage with TTL, to stay under
// the NASA DEMO_KEY budget (30/hr, 50/day). JPL endpoints are unlimited but we
// cache them too so timeline scrubbing doesn't refetch.

const memory = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
const LS_PREFIX = "nee:cache:";

export const NASA_KEY = import.meta.env.VITE_NASA_API_KEY || "DEMO_KEY";

// JPL ssd-api has no CORS headers; in dev we hit it via the Vite proxy (/jpl).
// In production, set VITE_JPL_BASE to a host/rewrite that adds CORS (or a proxy).
export const JPL_BASE = import.meta.env.DEV
  ? "/jpl"
  : (import.meta.env.VITE_JPL_BASE as string | undefined) || "https://ssd-api.jpl.nasa.gov";

function lsGet(key: string): { at: number; data: unknown } | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function lsSet(key: string, entry: { at: number; data: unknown }) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* quota / private mode — ignore */
  }
}

export interface FetchOpts {
  /** Cache time-to-live in ms. Default 30 min. */
  ttl?: number;
  /** Cache key override (defaults to the URL). */
  key?: string;
}

/** Fetch JSON with layered caching. Throws on non-2xx or network failure. */
export async function fetchJson<T>(url: string, opts: FetchOpts = {}): Promise<T> {
  const ttl = opts.ttl ?? 30 * 60 * 1000;
  const key = opts.key ?? url;
  const now = Date.now();

  const mem = memory.get(key);
  if (mem && now - mem.at < ttl) return mem.data as T;

  const ls = lsGet(key);
  if (ls && now - ls.at < ttl) {
    memory.set(key, ls);
    return ls.data as T;
  }

  // Dedupe concurrent identical requests (e.g. StrictMode double-effects) so we
  // don't burn duplicate network calls / DEMO_KEY budget on the same URL.
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const request = (async () => {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      // On failure, fall back to any stale cache rather than blanking the UI.
      if (mem) return mem.data as T;
      if (ls) return ls.data as T;
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    }
    const data = (await res.json()) as T;
    const entry = { at: Date.now(), data };
    memory.set(key, entry);
    lsSet(key, entry);
    return data;
  })();

  inflight.set(key, request);
  try {
    return await request;
  } finally {
    inflight.delete(key);
  }
}

/** True if this exact request is already cached and fresh (for status UI). */
export function isCached(url: string, ttl = 30 * 60 * 1000): boolean {
  const now = Date.now();
  const mem = memory.get(url);
  if (mem && now - mem.at < ttl) return true;
  const ls = lsGet(url);
  return !!(ls && now - ls.at < ttl);
}
