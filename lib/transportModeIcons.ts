import L from "leaflet";
import {
  HUB_ROLE_COLORS,
  HUB_ROLE_LABELS,
  TRANSPORT_MODE_GLYPHS,
  TRANSPORT_MODE_META,
  type HubRole,
  type NormalizedTransportMode,
} from "@/lib/transportMode";

/**
 * Leaflet-only hub/terminal icon factories.
 * Import this from client map components only — never from shared libs
 * used during SSR (e.g. orderRouteChain).
 */

const iconCache = new Map<string, L.DivIcon>();

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
    <svg width="${glyph}" height="${glyph}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TRANSPORT_MODE_GLYPHS[mode]}</svg>
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

/**
 * Build (and cache) a circular hub/port marker icon for a transport mode.
 * Used for air/sea zones — and optionally land — so the "single point"
 * semantics are obvious on the map.
 */
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
  <svg width="${glyph}" height="${glyph}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TRANSPORT_MODE_GLYPHS[mode]}</svg>
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
