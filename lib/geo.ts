import { cellToLatLng, isValidCell } from "h3-js";
import type { DriverZone, LatLngPoint } from "@/types";

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two lat/lng points in kilometers. */
export function haversineKm(a: LatLngPoint, b: LatLngPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Approximate center of a driver zone:
 * - prefers the average of its geofence boundary points
 * - otherwise the average of its H3 cell centers
 *
 * A handful of cells is sampled (instead of all of them) to keep the cost
 * bounded for very large zones.
 */
export function zoneCentroid(zone: DriverZone): LatLngPoint | null {
  if (zone.boundary && zone.boundary.length > 0) {
    return averagePoints(zone.boundary);
  }
  if (Array.isArray(zone.h3_cells) && zone.h3_cells.length > 0) {
    const sample = zone.h3_cells.length > 64 ? sampleEvenly(zone.h3_cells, 64) : zone.h3_cells;
    const points: LatLngPoint[] = [];
    for (const cell of sample) {
      if (!isValidCell(cell)) continue;
      const [lat, lng] = cellToLatLng(cell);
      points.push({ lat, lng });
    }
    if (points.length > 0) return averagePoints(points);
  }
  return null;
}

/** Group zones by their owner so we can compute per-driver distance fast. */
export function groupZonesByOwner(zones: DriverZone[]): Map<number, DriverZone[]> {
  const map = new Map<number, DriverZone[]>();
  for (const z of zones) {
    const list = map.get(z.owner_user_id);
    if (list) list.push(z);
    else map.set(z.owner_user_id, [z]);
  }
  return map;
}

/**
 * Minimum distance (km) from `from` to any of the driver's zones, using each
 * zone's centroid as its representative point. Returns `null` if the driver
 * has no zones with usable geometry.
 */
export function nearestZoneDistanceKm(
  from: LatLngPoint,
  zones: DriverZone[] | undefined
): number | null {
  if (!zones || zones.length === 0) return null;
  let best: number | null = null;
  for (const z of zones) {
    const c = zoneCentroid(z);
    if (!c) continue;
    const d = haversineKm(from, c);
    if (best === null || d < best) best = d;
  }
  return best;
}

/** Human-readable distance: meters under 1 km, otherwise km with one decimal. */
export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km)) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function averagePoints(points: LatLngPoint[]): LatLngPoint {
  let lat = 0;
  let lng = 0;
  for (const p of points) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / points.length, lng: lng / points.length };
}

function sampleEvenly<T>(arr: T[], count: number): T[] {
  if (arr.length <= count) return arr;
  const step = arr.length / count;
  const out: T[] = [];
  for (let i = 0; i < count; i++) {
    out.push(arr[Math.floor(i * step)]);
  }
  return out;
}
