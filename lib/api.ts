import { apiRequest } from "./http";
import type {
  ConvertH3Request,
  ConvertH3Response,
  CreateDriverZoneRequest,
  DriverZone,
  UpdateDriverZoneRequest,
} from "@/types";
import type { DashboardStats } from "@/types/auth";

export function convertLocations(payload: ConvertH3Request): Promise<ConvertH3Response> {
  return apiRequest<ConvertH3Response>("/api/h3/convert", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listDriverZones(): Promise<DriverZone[]> {
  return apiRequest<DriverZone[]>("/api/driver-zones");
}

export function getDriverZone(id: number): Promise<DriverZone> {
  return apiRequest<DriverZone>(`/api/driver-zones/${id}`);
}

export function createDriverZone(payload: CreateDriverZoneRequest): Promise<DriverZone> {
  return apiRequest<DriverZone>("/api/driver-zones", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateDriverZone(
  id: number,
  payload: UpdateDriverZoneRequest
): Promise<DriverZone> {
  return apiRequest<DriverZone>(`/api/driver-zones/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteDriverZone(id: number): Promise<void> {
  return apiRequest<void>(`/api/driver-zones/${id}`, { method: "DELETE" });
}

export function getDashboardStats(): Promise<DashboardStats> {
  return apiRequest<DashboardStats>("/api/dashboard/stats");
}
