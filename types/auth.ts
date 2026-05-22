import type { DriverZone } from "./index";

export type UserRole = "admin" | "driver" | "sender" | "receiver";

export interface User {
  id: number;
  full_name: string;
  company_name: string;
  email: string;
  role: UserRole;
  phone: string;
  address: string;
  lat: number | null;
  lng: number | null;
  trustworthiness: number;
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
  role: "driver" | "sender" | "receiver";
  company_name?: string;
  phone: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
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

export interface DriverDashboardStats {
  role: "driver";
  total_driver_zones: number;
  available_zones: number;
  total_h3_cells: number;
  trustworthiness: number;
  followers: number;
  recent_zones: DriverZone[];
}

export interface SenderDashboardStats {
  role: "sender";
  order_counts: { submitted: number; delivering: number; received: number };
  total_orders: number;
  available_drivers: number;
  available_receivers: number;
}

export interface ReceiverDashboardStats {
  role: "receiver";
  order_counts: { submitted: number; delivering: number; received: number };
  total_orders: number;
}

export type DashboardStats =
  | DriverDashboardStats
  | SenderDashboardStats
  | ReceiverDashboardStats;
