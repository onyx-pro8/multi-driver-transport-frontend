import L from "leaflet";

/**
 * Transport-mode rendering helpers.
 *
 * Land transport genuinely covers an area and can hand a package off
 * anywhere two zones meet, so it is drawn as H3-hex coverage with
 * cell-level handoffs. Air and sea transport, by contrast, only have a
 * defined pickup/drop-off point (a hub airport / a port) — what happens
 * between two hubs is undefined. Painting their coverage as hexagons and
 * marking mid-route "transfer cells" is misleading (it implies a handoff
 * mid-flight or over open water), so those modes are collapsed to a single
 * hub/port marker and connected with a distinct flight/lane line.
 *
 * This module centralises the mode → visual mapping so every map view
 * (driver zones, zone-connections, driver-zone graph, order graph) behaves
 * identically.
 */

export type NormalizedTransportMode = "land" | "air" | "sea";

/** Normalise a free-form / nullable transport value to a known mode. */
export function normalizeTransportMode(
  value: string | null | undefined
): NormalizedTransportMode {
  const v = (value ?? "").toLowerCase();
  if (v === "air") return "air";
  if (v === "sea") return "sea";
  return "land";
}

/**
 * Hub modes (air, sea) are point-based: render a single hub/port marker
 * instead of area coverage, and never show cell-level handoffs.
 */
export function isHubMode(mode: NormalizedTransportMode): boolean {
  return mode === "air" || mode === "sea";
}

export interface TransportModeMeta {
  label: string;
  /** Marker / accent colour. */
  color: string;
  /** Noun used in tooltips for the hub point ("airport", "port"). */
  hubNoun: string;
  /** Connection-line label ("Flight path", "Shipping lane", "Road"). */
  lineLabel: string;
  /** Dash pattern for the connection line. `undefined` = solid. */
  dashArray?: string;
}

export const TRANSPORT_MODE_META: Record<NormalizedTransportMode, TransportModeMeta> = {
  land: { label: "Land", color: "#3b82f6", hubNoun: "area", lineLabel: "Road", dashArray: undefined },
  air: { label: "Air", color: "#0ea5e9", hubNoun: "airport", lineLabel: "Flight path", dashArray: "2 9" },
  sea: { label: "Sea", color: "#0d9488", hubNoun: "port", lineLabel: "Shipping lane", dashArray: "1 7" },
};

/**
 * Pick the mode that should style a connection line between two endpoints.
 * Any air leg dominates (drawn as a flight path), then sea, then land — so
 * an intermodal handoff (e.g. truck → plane) reads as the non-land leg
 * rather than a misleading solid road line.
 */
export function connectionMode(
  a: NormalizedTransportMode,
  b: NormalizedTransportMode
): NormalizedTransportMode {
  if (a === "air" || b === "air") return "air";
  if (a === "sea" || b === "sea") return "sea";
  return "land";
}

// SVG glyphs (lucide-style, 24×24 stroke paths) rendered white inside the
// coloured hub badge.
const GLYPHS: Record<NormalizedTransportMode, string> = {
  air: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  sea: '<path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 10v4"/><path d="M12 2v3"/>',
  land: '<path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
};

const iconCache = new Map<string, L.DivIcon>();

/**
 * Build (and cache) a circular hub/port marker icon for a transport mode.
 * Used for air/sea zones — and optionally land — so the "single point"
 * semantics are obvious on the map.
 */
export type HubRole = "departure" | "arrival";

const HUB_ROLE_COLORS: Record<HubRole, string> = {
  departure: "#22c55e",
  arrival: "#f97316",
};

const HUB_ROLE_LABELS: Record<HubRole, string> = {
  departure: "DEP",
  arrival: "ARR",
};

/**
 * Distinct marker for a departure or arrival terminal on air/sea routes.
 * Departure hubs are green; arrival hubs are orange — both carry a small
 * role badge so the two endpoints are never confused on the map.
 */
export function makeTerminalIcon(
  mode: NormalizedTransportMode,
  role: HubRole,
  opts: { selected?: boolean; muted?: boolean } = {}
): L.DivIcon {
  const selected = opts.selected ?? false;
  const muted = opts.muted ?? false;
  const key = `term:${mode}:${role}:${selected ? "s" : ""}:${muted ? "m" : ""}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const meta = TRANSPORT_MODE_META[mode];
  const roleColor = HUB_ROLE_COLORS[role];
  const size = selected ? 36 : 30;
  const glyph = size * 0.5;
  const opacity = muted ? 0.4 : 1;
  const html = `<div style="position:relative;width:${size}px;height:${size + 10}px;opacity:${opacity};">
  <div style="width:${size}px;height:${size}px;border-radius:50%;background:${meta.color};border:3px solid ${roleColor};box-shadow:0 1px 5px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;">
    <svg width="${glyph}" height="${glyph}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[mode]}</svg>
  </div>
  <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);background:${roleColor};color:#fff;font-size:8px;font-weight:700;padding:1px 4px;border-radius:3px;line-height:1;white-space:nowrap;">${HUB_ROLE_LABELS[role]}</div>
</div>`;

  const icon = L.divIcon({
    className: "transport-terminal-icon",
    html,
    iconSize: [size, size + 10],
    iconAnchor: [size / 2, (size + 10) / 2],
    tooltipAnchor: [0, -(size / 2)],
  });
  iconCache.set(key, icon);
  return icon;
}

export function makeHubIcon(
  mode: NormalizedTransportMode,
  opts: { selected?: boolean; muted?: boolean } = {}
): L.DivIcon {
  const selected = opts.selected ?? false;
  const muted = opts.muted ?? false;
  const key = `${mode}:${selected ? "s" : ""}:${muted ? "m" : ""}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const meta = TRANSPORT_MODE_META[mode];
  const size = selected ? 32 : 26;
  const glyph = size * 0.58;
  const opacity = muted ? 0.4 : 1;
  const html = `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${meta.color};border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;opacity:${opacity};">
  <svg width="${glyph}" height="${glyph}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[mode]}</svg>
</div>`;

  const icon = L.divIcon({
    className: "transport-hub-icon",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -size / 2],
  });
  iconCache.set(key, icon);
  return icon;
}
