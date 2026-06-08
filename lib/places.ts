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

/** Derive the matching `/reverse` endpoint from the configured search URL. */
const NOMINATIM_REVERSE_URL = NOMINATIM_URL.replace(/\/search\/?$/, "/reverse");

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

/**
 * OSM class/type combinations that identify transport terminals (airports
 * and ports/harbours). When a hub search is requested we float these to the
 * top so a driver typing "Pearson" or "Halifax" sees the airport / port
 * before unrelated shops or streets of the same name.
 */
function isTerminalResult(result: PlaceResult): boolean {
  const cls = result.class;
  const type = result.type;
  if (cls === "aeroway") return true; // aerodrome, terminal, runway
  if (cls === "amenity" && (type === "ferry_terminal" || type === "harbour")) return true;
  if (cls === "harbour") return true;
  if (cls === "man_made" && (type === "pier" || type === "harbour")) return true;
  if (cls === "landuse" && (type === "port" || type === "harbour")) return true;
  if (type === "aerodrome" || type === "airport" || type === "harbour" || type === "port") {
    return true;
  }
  return false;
}

export interface SearchPlacesOptions {
  /** Float airports/ports to the top — used by the hub terminal pickers. */
  preferTerminals?: boolean;
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
  opts: SearchPlacesOptions = {}
): Promise<PlaceResult[]> {
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

  if (opts.preferTerminals) {
    // Terminals first, then fall back to the generic POI ranking so a
    // search like "Halifax" still lists the city if no port matches.
    return [...data].sort((a, b) => {
      const at = isTerminalResult(a) ? 0 : 1;
      const bt = isTerminalResult(b) ? 0 : 1;
      if (at !== bt) return at - bt;
      return categoryRank(a) - categoryRank(b);
    });
  }

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
  if (isTerminalResult(result)) {
    if (result.class === "aeroway" || result.type === "aerodrome" || result.type === "airport") {
      return "airport";
    }
    return "port";
  }
  if (result.class === result.type) return result.type;
  return `${result.type}`.replace(/_/g, " ");
}

export interface ReverseGeocodeResult {
  /** OSM class, e.g. `place`, `natural`, `highway`. */
  class?: string;
  /** OSM type, e.g. `water`, `bay`, `sea`, `city`. */
  type?: string;
  display_name?: string;
  address?: NominatimAddress;
  error?: string;
}

/**
 * Reverse-geocode a coordinate to its nearest named feature. Used to give a
 * best-effort land-vs-water hint when a driver drops a terminal hub on the
 * map. Returns `null` on network failure so callers treat it as "unknown".
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<ReverseGeocodeResult | null> {
  const url = new URL(NOMINATIM_REVERSE_URL);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "10");

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as ReverseGeocodeResult;
  } catch {
    return null;
  }
}

/** OSM feature types that indicate the point sits on open water. */
const WATER_TYPES = new Set([
  "water",
  "sea",
  "ocean",
  "bay",
  "strait",
  "lagoon",
  "reef",
  "wetland",
]);

/**
 * Best-effort guess at whether a reverse-geocode result is open water.
 *
 * Nominatim returns either an `error` (no nearby feature — typically open
 * ocean) or a `natural`/water-typed feature when a coordinate is offshore.
 * This is a heuristic hint only — coastal ports legitimately sit on the
 * waterline, so callers should surface it as a soft warning, never a block.
 */
export function isLikelyWater(result: ReverseGeocodeResult | null): boolean {
  if (!result) return false;
  if (result.error) return true;
  const type = (result.type ?? "").toLowerCase();
  const cls = (result.class ?? "").toLowerCase();
  if (WATER_TYPES.has(type)) return true;
  if (cls === "natural" && (type === "water" || type === "bay" || type === "strait")) return true;
  // No address details at low zoom usually means there's nothing but water.
  if (!result.address && !result.display_name) return true;
  return false;
}
