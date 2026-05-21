import type { DriverZone } from "./index";

export interface User {
  id: number;
  full_name: string;
  company_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface RegisterRequest {
  full_name: string;
  company_name: string;
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface DashboardStats {
  total_driver_zones: number;
  total_h3_cells: number;
  total_drivers: number;
  total_routes: number;
  recent_zones: DriverZone[];
  milestone: number;
  milestone_total: number;
}
