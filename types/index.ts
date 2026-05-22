export interface ConvertH3Request {
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  resolution: number;
}

export interface ConvertH3Response {
  pickup_h3: string;
  dropoff_h3: string;
  resolution: number;
  cell_type: "Hexagon";
  pickup_center: { lat: number; lng: number };
  dropoff_center: { lat: number; lng: number };
}

export type TransportMode = "air" | "land" | "sea";

/**
 * Curated ISO 4217 codes. Keep in sync with `backend/src/models/currency.model.ts`
 * — the backend regenerates its CHECK constraint from that same list on boot.
 * `Intl.NumberFormat` in `formatCurrency` already knows the symbol for every
 * ISO code, so we don't maintain a separate symbol map.
 */
export const CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CNY",
  "AUD", "CAD", "CHF", "HKD", "SGD",
  "NZD", "KRW", "INR", "MXN", "BRL",
  "RUB", "ZAR", "TRY", "SEK", "NOK",
  "DKK", "PLN", "THB", "IDR", "MYR",
  "PHP", "VND", "AED", "SAR", "ILS",
  "EGP", "NGN", "ARS", "CLP", "COP",
  "CZK", "HUF", "RON", "UAH", "TWD",
  "PKR", "BDT", "LKR", "KES", "MAD",
  "QAR", "KWD", "BHD", "OMR",
] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface DriverZone {
  id: number;
  owner_user_id: number;
  driver_name: string;
  zone_name: string;
  resolution: number;
  h3_cells: string[];
  cell_count: number;
  transport_mode: TransportMode;
  boundary: LatLngPoint[] | null;
  rate_cost: number;
  currency: Currency;
  available: boolean;
  trust_payment_forwarder: boolean;
  driver_trustworthiness?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateDriverZoneRequest {
  driver_name: string;
  zone_name: string;
  resolution: number;
  h3_cells?: string[];
  transport_mode: TransportMode;
  boundary?: LatLngPoint[] | null;
  rate_cost: number;
  currency: Currency;
  available: boolean;
  trust_payment_forwarder: boolean;
}

export interface UpdateDriverZoneRequest {
  driver_name?: string;
  zone_name?: string;
  resolution?: number;
  h3_cells?: string[];
  transport_mode?: TransportMode;
  boundary?: LatLngPoint[] | null;
  rate_cost?: number;
  currency?: Currency;
  available?: boolean;
  trust_payment_forwarder?: boolean;
}

export type CellInputMode = "draw" | "manual" | "geofence";

export type DashboardStep = 1 | 2 | 3;

export interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  kind: "pickup" | "dropoff";
}

export type OrderStatus = "submitted" | "delivering" | "received";

export interface Order {
  id: number;
  sender_user_id: number;
  receiver_user_id: number;
  driver_user_id: number | null;
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  sender_address: string;
  sender_lat: number | null;
  sender_lng: number | null;
  destination_address: string;
  destination_lat: number | null;
  destination_lng: number | null;
  notes: string;
  status: OrderStatus;
  submitted_at: string;
  delivering_at: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOrderRequest {
  receiver_user_id: number;
  sender_address?: string;
  sender_lat?: number | null;
  sender_lng?: number | null;
  notes?: string;
  driver_user_id?: number | null;
}

export interface ReceiverSummary {
  id: number;
  full_name: string;
  phone: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

export interface DriverSummary {
  id: number;
  full_name: string;
  company_name: string;
  phone: string;
  trustworthiness: number;
  zone_count: number;
  followed: boolean;
  transport_modes: string[];
}
