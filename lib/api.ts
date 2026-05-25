import { apiRequest, invalidateCache } from "./http";
import type {
  RecalculateConnectionsResponse,
  ZoneConnection,
  ZoneConnectionFilters,
} from "@/types";

/**
 * Short TTLs are intentional: long enough to make page navigation instant when
 * the same endpoint is re-requested, short enough that stale data doesn't
 * linger. Mutations clear the cache via `invalidateCache` automatically.
 */
const TTL_LIST = 15_000;
const TTL_DASHBOARD = 10_000;
const TTL_STATIC_LISTS = 30_000;
import type {
  ConvertH3Request,
  ConvertH3Response,
  CreateDriverZoneRequest,
  CreateOrderRequest,
  DriverSummary,
  DriverZone,
  Order,
  OrderStatus,
  ReceiverSummary,
  UpdateDriverZoneRequest,
} from "@/types";
import type { DashboardStats } from "@/types/auth";

export function convertLocations(payload: ConvertH3Request): Promise<ConvertH3Response> {
  return apiRequest<ConvertH3Response>("/api/h3/convert", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listDriverZones(ownerUserId?: number): Promise<DriverZone[]> {
  const qs = ownerUserId ? `?owner_user_id=${ownerUserId}` : "";
  return apiRequest<DriverZone[]>(`/api/driver-zones${qs}`, {
    cacheOptions: { ttlMs: TTL_LIST },
  });
}

export function getDriverZone(id: number): Promise<DriverZone> {
  return apiRequest<DriverZone>(`/api/driver-zones/${id}`, {
    cacheOptions: { ttlMs: TTL_LIST },
  });
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

export function polygonToCells(payload: {
  boundary: { lat: number; lng: number }[];
  resolution: number;
}): Promise<{ h3_cells: string[]; cell_count: number; resolution: number }> {
  return apiRequest("/api/h3/polygon-to-cells", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getDashboardStats(): Promise<DashboardStats> {
  return apiRequest<DashboardStats>("/api/dashboard/stats", {
    cacheOptions: { ttlMs: TTL_DASHBOARD },
  });
}

export function listOrders(): Promise<Order[]> {
  return apiRequest<Order[]>("/api/orders", {
    cacheOptions: { ttlMs: TTL_LIST },
  });
}

export function createOrder(payload: CreateOrderRequest): Promise<Order> {
  return apiRequest<Order>("/api/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateOrderStatus(id: number, status: Exclude<OrderStatus, "submitted">): Promise<Order> {
  return apiRequest<Order>(`/api/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function listReceivers(): Promise<ReceiverSummary[]> {
  return apiRequest<ReceiverSummary[]>("/api/users/receivers", {
    cacheOptions: { ttlMs: TTL_STATIC_LISTS },
  });
}

export function listDrivers(): Promise<DriverSummary[]> {
  return apiRequest<DriverSummary[]>("/api/users/drivers", {
    cacheOptions: { ttlMs: TTL_STATIC_LISTS },
  });
}

export function followDriver(driverId: number): Promise<{ followed: boolean; trustworthiness: number }> {
  return apiRequest(`/api/users/drivers/${driverId}/follow`, { method: "POST" });
}

export function unfollowDriver(driverId: number): Promise<{ followed: boolean; trustworthiness: number }> {
  return apiRequest(`/api/users/drivers/${driverId}/follow`, { method: "DELETE" });
}

/** Re-exported so pages can manually bust the cache after a side effect. */
export { invalidateCache };

// --------------------------------------------------------------------------
// Milestone 2 — Zone connections
// --------------------------------------------------------------------------

function buildZoneConnectionQuery(filters?: ZoneConnectionFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.connection_type) params.set("connection_type", filters.connection_type);
  if (filters.transport_id) params.set("transport_id", String(filters.transport_id));
  if (filters.zone_id) params.set("zone_id", String(filters.zone_id));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function listZoneConnections(
  filters?: ZoneConnectionFilters
): Promise<ZoneConnection[]> {
  const qs = buildZoneConnectionQuery(filters);
  return apiRequest<ZoneConnection[]>(`/api/zone-connections${qs}`, {
    cacheOptions: { ttlMs: TTL_LIST },
  });
}

export function getZoneConnection(id: number): Promise<ZoneConnection> {
  return apiRequest<ZoneConnection>(`/api/zone-connections/${id}`, {
    cacheOptions: { ttlMs: TTL_LIST },
  });
}

export function listConnectionsForZone(zoneId: number): Promise<ZoneConnection[]> {
  return apiRequest<ZoneConnection[]>(`/api/zones/${zoneId}/connections`, {
    cacheOptions: { ttlMs: TTL_LIST },
  });
}

export function recalculateZoneConnections(): Promise<RecalculateConnectionsResponse> {
  return apiRequest<RecalculateConnectionsResponse>("/api/zone-connections/recalculate", {
    method: "POST",
  });
}

export function detectConnectionsForZone(
  zoneId: number
): Promise<RecalculateConnectionsResponse & { zone_id: number }> {
  return apiRequest(`/api/zones/${zoneId}/detect-connections`, { method: "POST" });
}

export function deactivateZoneConnection(id: number): Promise<void> {
  return apiRequest<void>(`/api/zone-connections/${id}`, { method: "DELETE" });
}
