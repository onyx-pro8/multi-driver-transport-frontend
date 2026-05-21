import type {
  AuthResponse,
  AuthTokens,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  User,
} from "@/types/auth";
import { apiRequest } from "./http";
import {
  clearAuthStorage,
  getRefreshToken,
  setStoredUser,
  setTokens,
} from "./token";

export function persistAuthSession(response: AuthResponse): void {
  setTokens(response.access_token, response.refresh_token);
  setStoredUser(response.user);
}

export function login(payload: LoginRequest): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
    public: true,
  });
}

export function register(payload: RegisterRequest): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
    public: true,
  });
}

export function fetchMe(): Promise<{ user: User }> {
  return apiRequest<{ user: User }>("/api/auth/me");
}

export function forgotPassword(
  payload: ForgotPasswordRequest
): Promise<{ message: string; reset_token?: string }> {
  return apiRequest("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload),
    public: true,
  });
}

export function resetPassword(payload: ResetPasswordRequest): Promise<{ message: string }> {
  return apiRequest("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
    public: true,
  });
}

export async function logout(): Promise<void> {
  const refresh = getRefreshToken();
  try {
    await apiRequest<void>("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refresh }),
      skipRefresh: true,
    });
  } catch {
    /* proceed with local cleanup even if server call fails */
  } finally {
    clearAuthStorage();
  }
}

export async function refreshTokens(): Promise<AuthTokens | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const tokens = await apiRequest<AuthTokens>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refresh }),
      public: true,
      skipRefresh: true,
    });
    setTokens(tokens.access_token, tokens.refresh_token);
    return tokens;
  } catch {
    clearAuthStorage();
    return null;
  }
}
