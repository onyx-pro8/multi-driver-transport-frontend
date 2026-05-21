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
}

export async function apiRequest<T>(path: string, init?: RequestOptions): Promise<T> {
  const { public: isPublic, skipRefresh, ...fetchInit } = init ?? {};

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
