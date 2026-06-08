/**
 * Maritime routing helper.
 *
 * Sea routes are computed on the backend via `searoute-js` (global marine
 * network). The browser only fetches the resolved `[lat, lng]` polyline.
 */

import { apiRequest } from "@/lib/http";

export type LatLng = { lat: number; lng: number };

interface SeaRouteResponse {
  coordinates: [number, number][] | null;
}

// Round to ~100 m so tiny float jitter doesn't bust the cache.
function pairKey(a: LatLng, b: LatLng): string {
  return `${a.lat.toFixed(3)},${a.lng.toFixed(3)}|${b.lat.toFixed(3)},${b.lng.toFixed(3)}`;
}

const routeCache = new Map<string, [number, number][] | null>();

/**
 * Compute a sea route between two points as Leaflet `[lat, lng]` tuples.
 * Returns `null` when no maritime path can be found (caller should fall back
 * to a straight line).
 */
export async function computeSeaRoute(
  departure: LatLng,
  arrival: LatLng
): Promise<[number, number][] | null> {
  if (
    !Number.isFinite(departure.lat) ||
    !Number.isFinite(departure.lng) ||
    !Number.isFinite(arrival.lat) ||
    !Number.isFinite(arrival.lng)
  ) {
    return null;
  }

  const key = pairKey(departure, arrival);
  const cached = routeCache.get(key);
  if (cached !== undefined) return cached;

  try {
    const params = new URLSearchParams({
      from_lat: String(departure.lat),
      from_lng: String(departure.lng),
      to_lat: String(arrival.lat),
      to_lng: String(arrival.lng),
    });
    const data = await apiRequest<SeaRouteResponse>(
      `/api/h3/sea-route?${params.toString()}`,
      {
        cacheOptions: { key: `sea-route:${key}`, ttlMs: 10 * 60_000 },
      }
    );
    const coords = data.coordinates;
    if (!coords || coords.length < 2) {
      routeCache.set(key, null);
      return null;
    }
    routeCache.set(key, coords);
    return coords;
  } catch {
    routeCache.set(key, null);
    return null;
  }
}
