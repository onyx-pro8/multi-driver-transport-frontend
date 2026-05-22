/**
 * Place search via OpenStreetMap Nominatim.
 *
 * Used to autocomplete addresses to a precise POI (shop / cafe / restaurant
 * / building) and snap to lat/lng. Free service — please respect the
 * Nominatim Usage Policy: keep requests modest (debounce typing, limit=10)
 * and surface ODbL attribution somewhere in the UI.
 *
 * Override the endpoint at build time via NEXT_PUBLIC_NOMINATIM_URL if you
 * self-host or use a paid mirror.
 */

const NOMINATIM_URL =
  process.env.NEXT_PUBLIC_NOMINATIM_URL || "https://nominatim.openstreetmap.org/search";

export interface NominatimAddress {
  shop?: string;
  amenity?: string;
  building?: string;
  road?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
  [key: string]: string | undefined;
}

export interface PlaceResult {
  place_id: number;
  lat: string;
  lon: string;
  /** Top-level OSM class, e.g. `amenity`, `shop`, `tourism`. */
  class: string;
  /** Sub-type, e.g. `cafe`, `restaurant`, `supermarket`. */
  type: string;
  /** Optional human-readable POI name when one exists ("Starbucks"). */
  name?: string;
  display_name: string;
  address?: NominatimAddress;
}

/**
 * Categories whose results we want to surface first — these correspond to
 * the "shop / cafe level" requested by the product spec.
 */
const POI_CLASS_PRIORITY: Record<string, number> = {
  shop: 0,
  amenity: 0,
  tourism: 1,
  leisure: 1,
  office: 1,
  craft: 1,
  building: 2,
  highway: 3,
  place: 4,
  boundary: 5,
};

function categoryRank(result: PlaceResult): number {
  return POI_CLASS_PRIORITY[result.class] ?? 6;
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("namedetails", "0");
  url.searchParams.set("limit", "10");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);

  const data = (await res.json()) as PlaceResult[];
  // Rank POI-like results (shop, cafe, restaurant…) before generic places.
  return [...data].sort((a, b) => categoryRank(a) - categoryRank(b));
}

/**
 * Pick the best short label for a place — POI name when available,
 * else the leading segment of `display_name`.
 */
export function placeShortLabel(result: PlaceResult): string {
  if (result.name) return result.name;
  const addr = result.address;
  if (addr) {
    const candidate = addr.shop || addr.amenity || addr.building;
    if (candidate) return candidate;
  }
  return result.display_name.split(",")[0] || result.display_name;
}

/** Format the OSM class/type pair as a small human-readable tag. */
export function placeCategoryLabel(result: PlaceResult): string {
  if (result.class === result.type) return result.type;
  return `${result.type}`.replace(/_/g, " ");
}
