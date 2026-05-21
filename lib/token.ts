const ACCESS_KEY = "mdh3_access_token";
const REFRESH_KEY = "mdh3_refresh_token";
const USER_KEY = "mdh3_user";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function getAccessToken(): string | null {
  return storage()?.getItem(ACCESS_KEY) ?? null;
}

export function getRefreshToken(): string | null {
  return storage()?.getItem(REFRESH_KEY) ?? null;
}

export function setTokens(access: string, refresh: string): void {
  storage()?.setItem(ACCESS_KEY, access);
  storage()?.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  storage()?.removeItem(ACCESS_KEY);
  storage()?.removeItem(REFRESH_KEY);
}

export function getStoredUser<T>(): T | null {
  const raw = storage()?.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setStoredUser<T>(user: T): void {
  storage()?.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredUser(): void {
  storage()?.removeItem(USER_KEY);
}

export function clearAuthStorage(): void {
  clearTokens();
  clearStoredUser();
}
