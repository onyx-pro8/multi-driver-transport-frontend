/**
 * Land routing helper — mirrors {@link ./seaRoute.ts}.
 *
 * Land paths that would cut across water are resolved on the backend
 * (Google Directions or land-grid A*). The browser only fetches the polyline.
 */

import { apiRequest } from "@/lib/http";

export type LatLng = { lat: number; lng: number };

interface LandRouteResponse {
  coordinates: [number, number][] | null;
  distance_km?: number | null;
  source?: string;
}

function pairKey(a: LatLng, b: LatLng): string {
  return `${a.lat.toFixed(3)},${a.lng.toFixed(3)}|${b.lat.toFixed(3)},${b.lng.toFixed(3)}`;
}

const routeCache = new Map<string, [number, number][] | null>();

/**
 * Compute a land route between two points as Leaflet `[lat, lng]` tuples.
 * Returns `null` when no water-avoiding path is available (caller may fall
 * back to a straight line only for dry-land chords).
 */
export async function computeLandRoute(
  from: LatLng,
  to: LatLng
): Promise<[number, number][] | null> {
  if (
    !Number.isFinite(from.lat) ||
    !Number.isFinite(from.lng) ||
    !Number.isFinite(to.lat) ||
    !Number.isFinite(to.lng)
  ) {
    return null;
  }

  const key = pairKey(from, to);
  const cached = routeCache.get(key);
  if (cached !== undefined) return cached;

  try {
    const params = new URLSearchParams({
      from_lat: String(from.lat),
      from_lng: String(from.lng),
      to_lat: String(to.lat),
      to_lng: String(to.lng),
    });
    const data = await apiRequest<LandRouteResponse>(
      `/api/h3/land-route?${params.toString()}`,
      {
        cacheOptions: { key: `land-route:${key}`, ttlMs: 10 * 60_000 },
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
