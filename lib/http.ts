import {
  clearAuthStorage,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./token";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });

  if (!res.ok) {
    clearAuthStorage();
    return null;
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
  };
  setTokens(data.access_token, data.refresh_token);
  return data.access_token;
}

async function getValidAccessToken(): Promise<string | null> {
  const existing = getAccessToken();
  if (existing) return existing;
  return refreshAccessToken();
}

export interface RequestOptions extends RequestInit {
  /** Skip Authorization header (login, register, etc.) */
  public?: boolean;
  /** Skip automatic token refresh retry */
  skipRefresh?: boolean;
  /**
   * Enable in-flight de-duplication + short-lived response caching for this
   * GET request. Subsequent calls with the same key within `ttlMs` return the
   * cached value instantly; concurrent callers share a single network request.
   *
   * Named `cacheOptions` to avoid shadowing the native `RequestInit.cache`
   * field used by the Fetch API.
   */
  cacheOptions?: {
    key?: string;
    ttlMs?: number;
  };
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

/** Drop everything that was cached. Call this after a mutation. */
export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    responseCache.clear();
    return;
  }
  // Snapshot keys first so we can delete while iterating safely across
  // tsconfig targets that don't support direct Map iteration.
  const keys = Array.from(responseCache.keys());
  for (const key of keys) {
    if (key.startsWith(prefix)) responseCache.delete(key);
  }
}

function isGet(method: string | undefined): boolean {
  return !method || method.toUpperCase() === "GET";
}

async function performRequest<T>(path: string, init: RequestOptions | undefined): Promise<T> {
  const { public: isPublic, skipRefresh, cacheOptions: _cacheOptions, ...fetchInit } = init ?? {};
  void _cacheOptions;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchInit.headers as Record<string, string> | undefined),
  };

  if (!isPublic) {
    const token = await getValidAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res = await fetch(`${API_BASE}${path}`, { ...fetchInit, headers });

  if (res.status === 401 && !isPublic && !skipRefresh) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const newToken = await refreshPromise;
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${path}`, { ...fetchInit, headers });
    }
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiRequest<T>(path: string, init?: RequestOptions): Promise<T> {
  const method = init?.method;
  const cacheable = isGet(method);

  // Mutations bust the entire cache. Cheap and correct for a small app.
  if (!cacheable) {
    const result = await performRequest<T>(path, init);
    invalidateCache();
    return result;
  }

  const ttl = init?.cacheOptions?.ttlMs ?? 0;
  const key = init?.cacheOptions?.key ?? path;

  if (ttl > 0) {
    const hit = responseCache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value as T;
    }
  }

  // Dedup concurrent calls to the same GET endpoint.
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = performRequest<T>(path, init)
    .then((value) => {
      if (ttl > 0) {
        responseCache.set(key, { value, expiresAt: Date.now() + ttl });
      }
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}
