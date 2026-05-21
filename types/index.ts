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

export interface DriverZone {
  id: number;
  driver_name: string;
  zone_name: string;
  resolution: number;
  h3_cells: string[];
  cell_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateDriverZoneRequest {
  driver_name: string;
  zone_name: string;
  resolution: number;
  h3_cells: string[];
}

export interface UpdateDriverZoneRequest {
  driver_name?: string;
  zone_name?: string;
  resolution?: number;
  h3_cells?: string[];
}

export type CellInputMode = "draw" | "manual";

export type DashboardStep = 1 | 2 | 3;

export interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  kind: "pickup" | "dropoff";
}
