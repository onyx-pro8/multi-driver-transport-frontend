"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
  Map as MapIcon,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { H3MapAdjacentPair } from "@/components/map/H3MapView";
import { MAP_EMPTY_CELLS } from "@/lib/mapConstants";
import { cn } from "@/lib/utils";
import type {
  ConvertH3Response,
  DriverZone,
  OrderConnectionStatus,
  OrderDraftPreview,
  OrderDraftZoneSummary,
  TransportMode,
} from "@/types";

// Leaflet has no SSR support; load the map only in the browser. The orders
// page already does this — we mirror the same pattern + skeleton so the
// preview card doesn't shift when the map mounts.
const H3MapView = dynamic(() => import("@/components/map/H3MapView").then((m) => m.H3MapView), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] rounded-xl bg-muted animate-pulse flex items-center justify-center text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

interface Props {
  preview: OrderDraftPreview | null;
  loading: boolean;
  error: string | null;
}

const STATUS_CONFIG: Record<
  OrderConnectionStatus,
  { label: string; icon: typeof CheckCircle2; tone: string }
> = {
  connected: {
    label: "Connected",
    icon: CheckCircle2,
    tone: "text-emerald-600 dark:text-emerald-400",
  },
  not_connected: {
    label: "Not connected yet",
    icon: AlertTriangle,
    tone: "text-amber-600 dark:text-amber-400",
  },
  no_pickup_zone: {
    label: "No pickup zone",
    icon: XCircle,
    tone: "text-rose-600 dark:text-rose-400",
  },
  no_destination_zone: {
    label: "No destination zone",
    icon: XCircle,
    tone: "text-rose-600 dark:text-rose-400",
  },
};

/**
 * Order zones for map coloring: pickup → destination → intermediates by depth.
 * H3MapView paints zones via `ZONE_PALETTE[index]`, so the order here is what
 * the legend below the map describes.
 */
/** Backend should always send `cells`; tolerate older responses or gaps. */
function zoneCells(z: OrderDraftZoneSummary): string[] {
  return Array.isArray(z.cells) ? z.cells : [];
}

function orderZonesByRole(zones: OrderDraftZoneSummary[]): OrderDraftZoneSummary[] {
  return [...zones].sort((a, b) => {
    const roleA = a.is_pickup ? 0 : a.is_destination ? 1 : 2;
    const roleB = b.is_pickup ? 0 : b.is_destination ? 1 : 2;
    if (roleA !== roleB) return roleA - roleB;
    const dA = a.depth ?? 999;
    const dB = b.depth ?? 999;
    if (dA !== dB) return dA - dB;
    return a.zone_name.localeCompare(b.zone_name);
  });
}

function summaryToDriverZone(z: OrderDraftZoneSummary): DriverZone {
  return {
    id: z.zone_id,
    owner_user_id: z.transport_id,
    driver_name: z.transport_name,
    zone_name: z.zone_name,
    resolution: z.resolution,
    h3_cells: zoneCells(z),
    cell_count: z.cell_count,
    transport_mode: ((z.transport_method ?? "land") as TransportMode),
    boundary: null,
    rate_cost: 0,
    currency: "USD",
    available: true,
    trust_payment_forwarder: false,
    created_at: "",
    updated_at: "",
  };
}

export function OrderDraftZonePreview({ preview, loading, error }: Props) {
  // Hooks must be unconditional — compute view-models even when there's no
  // preview to render so the conditional returns below don't violate the
  // rules-of-hooks.

  /**
   * The set of zones we actually want to surface on the map: pickup-side,
   * destination-side, and any zone that appears on a connection chain
   * between them. BFS-reached zones that aren't on any pickup→drop-off
   * chain are intentionally excluded — they'd be visual noise for the
   * sender / receiver who only cares about *their* order's network.
   */
  const relevantZoneIds = useMemo(() => {
    const ids = new Set<number>();
    if (!preview) return ids;
    for (const z of preview.connected_zones ?? []) {
      if (z.is_pickup || z.is_destination) ids.add(z.zone_id);
    }
    for (const chain of preview.possible_connection_chains ?? []) {
      for (const id of chain.zone_ids) ids.add(id);
    }
    return ids;
  }, [preview]);

  const orderedZones = useMemo(() => {
    if (!preview) return [];
    return orderZonesByRole(preview.connected_zones ?? []).filter((z) =>
      relevantZoneIds.has(z.zone_id)
    );
  }, [preview, relevantZoneIds]);
  const savedZonesForMap = useMemo<DriverZone[]>(
    () => orderedZones.filter((z) => zoneCells(z).length > 0).map(summaryToDriverZone),
    [orderedZones]
  );
  const conversionForMap = useMemo<ConvertH3Response | null>(() => {
    if (!preview) return null;
    return {
      pickup_h3: preview.source.h3,
      dropoff_h3: preview.destination.h3,
      resolution: preview.preview_resolution,
      cell_type: "Hexagon",
      pickup_center: { lat: preview.source.lat, lng: preview.source.lng },
      dropoff_center: { lat: preview.destination.lat, lng: preview.destination.lng },
    };
  }, [preview]);

  /**
   * Only show transfer/adjacency markers when both endpoints of the
   * connection are in `relevantZoneIds`. This prevents an "unused" overlap
   * cell from a side branch zone (BFS reached but not on a chain) from
   * leaking onto the map after we hide that zone.
   */
  const transferCellsForMap = useMemo<string[]>(() => {
    if (!preview) return [];
    const out: string[] = [];
    for (const c of preview.connections ?? []) {
      if (!c.used_in_preview) continue;
      if (c.connection_type !== "overlap") continue;
      if (!relevantZoneIds.has(c.from_zone_id)) continue;
      if (!relevantZoneIds.has(c.to_zone_id)) continue;
      for (const cell of c.transfer_cells) out.push(cell);
    }
    return out;
  }, [preview, relevantZoneIds]);

  const adjacentPairsForMap = useMemo<H3MapAdjacentPair[]>(() => {
    if (!preview) return [];
    const out: H3MapAdjacentPair[] = [];
    for (const c of preview.connections ?? []) {
      if (!c.used_in_preview) continue;
      if (c.connection_type !== "adjacent") continue;
      if (!relevantZoneIds.has(c.from_zone_id)) continue;
      if (!relevantZoneIds.has(c.to_zone_id)) continue;
      for (const p of c.adjacent_cell_pairs) {
        out.push(p);
        if (out.length >= 200) return out; // hard cap on map detail
      }
    }
    return out;
  }, [preview, relevantZoneIds]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking transport zone connections…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-rose-300/60">
        <CardContent className="flex items-start gap-2 text-sm text-rose-600 dark:text-rose-400">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <span>{error}</span>
        </CardContent>
      </Card>
    );
  }

  if (!preview) return null;

  const status = STATUS_CONFIG[preview.status];
  const StatusIcon = status.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <StatusIcon className={cn("h-4 w-4", status.tone)} />
              <span className={status.tone}>{status.label}</span>
              <span className="text-muted-foreground font-normal">
                · zone connection preview
              </span>
            </CardTitle>
            <CardDescription className="text-xs mt-1">{preview.message}</CardDescription>
          </div>
          <span className="text-[10px] uppercase tracking-wide rounded-full border border-border px-2 py-0.5 text-muted-foreground">
            Preview · not a final route
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <Metric
            label={`Pickup H3 (res ${preview.preview_resolution})`}
            value={preview.source.h3}
            mono
          />
          <Metric
            label={`Drop-off H3 (res ${preview.preview_resolution})`}
            value={preview.destination.h3}
            mono
          />
          <Metric label="Pickup zones" value={preview.pickup_zones.length} />
          <Metric label="Destination zones" value={preview.destination_zones.length} />
          <Metric
            label="Connected zones in preview"
            value={preview.connected_zones.length}
          />
          <Metric label="Transfer cells" value={preview.transfer_cells.length} />
        </div>

        {(preview.pickup_zones.length > 0 || preview.destination_zones.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ZoneSnippet
              title="Pickup zones"
              zones={preview.pickup_zones}
              empty="No transport zone covers this pickup yet."
            />
            <ZoneSnippet
              title="Destination zones"
              zones={preview.destination_zones}
              empty="No transport zone covers this destination yet."
            />
          </div>
        )}

        {/*
          Map preview — sender, receiver, pickup/destination H3 cells, the
          covering + intermediate zones, and overlap/adjacency handoff
          points. Zones are colored by index (palette below); H3MapView
          handles cell-level rendering. The map mounts only when we
          actually have something useful to show.
        */}
        {(savedZonesForMap.length > 0 || conversionForMap) && (
          <div className="space-y-2">
            <div className="text-xs font-medium flex items-center gap-1">
              <MapIcon className="h-3.5 w-3.5 text-muted-foreground" />
              Map preview
              <span className="text-muted-foreground font-normal">
                (sender, receiver, relevant zones, transfer cells)
              </span>
            </div>
            <div className="h-[320px] rounded-xl overflow-hidden border border-border">
              <H3MapView
                height="100%"
                resolution={preview.preview_resolution}
                selectedCells={MAP_EMPTY_CELLS}
                savedZones={savedZonesForMap}
                conversion={conversionForMap}
                transferCells={transferCellsForMap}
                adjacentPairs={adjacentPairsForMap}
                showZoneTooltips={false}
                interactive
              />
            </div>
            <MapLegend zones={orderedZones} hasTransferCells={transferCellsForMap.length > 0} />
          </div>
        )}

        {preview.possible_connection_chains.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="text-xs font-medium mb-2 flex items-center gap-1">
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
              Possible connection chains
              <span className="text-muted-foreground font-normal">
                (preview, not a final route)
              </span>
            </div>
            <ul className="space-y-1.5 text-xs">
              {preview.possible_connection_chains.slice(0, 3).map((chain, idx) => (
                <li
                  key={idx}
                  className="flex flex-wrap items-center gap-1 text-muted-foreground"
                >
                  <span className="font-medium text-foreground">Pickup</span>
                  {chain.zone_ids.map((zid, i) => {
                    const z = preview.connected_zones.find((zz) => zz.zone_id === zid);
                    return (
                      <span key={`${idx}-${i}`} className="flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" />
                        <span className="text-foreground">
                          {z ? `${z.transport_name} · ${z.zone_name}` : `Zone #${zid}`}
                        </span>
                      </span>
                    );
                  })}
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-medium text-foreground">Drop-off</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                    {chain.hops} hop{chain.hops === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-medium truncate", mono && "font-mono text-xs")}>{value}</div>
    </div>
  );
}

// Mirrors `ZONE_PALETTE` in H3MapView. Kept local so the legend below the
// map matches the colors Leaflet actually paints.
const ZONE_PALETTE = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function MapLegend({
  zones,
  hasTransferCells,
}: {
  zones: OrderDraftZoneSummary[];
  hasTransferCells: boolean;
}) {
  const renderable = zones.filter((z) => zoneCells(z).length > 0);
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2.5 text-[11px]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <LegendDot color="#22c55e" label="Sender / pickup H3" filled />
        <LegendDot color="#ef4444" label="Receiver / drop-off H3" filled />
        {hasTransferCells && (
          <LegendDot color="#f59e0b" label="Overlap transfer cell" filled />
        )}
        <LegendDot color="#b45309" label="Adjacent handoff (dashed line)" />
      </div>
      {renderable.length > 0 && (
        <div className="mt-1.5 pt-1.5 border-t border-border/60 flex flex-wrap gap-x-3 gap-y-1">
          {renderable.map((z, idx) => {
            const color = ZONE_PALETTE[idx % ZONE_PALETTE.length];
            const role = z.is_pickup
              ? "Pickup zone"
              : z.is_destination
              ? "Destination zone"
              : "Intermediate";
            return (
              <span key={z.zone_id} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-3.5 rounded-sm"
                  style={{ background: color, opacity: 0.55, border: `1px solid ${color}` }}
                />
                <span className="text-foreground font-medium truncate max-w-[160px]">
                  {z.transport_name} · {z.zone_name}
                </span>
                <span className="text-muted-foreground">· {role}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LegendDot({
  color,
  label,
  filled,
}: {
  color: string;
  label: string;
  filled?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-2.5 w-3.5 rounded-sm"
        style={{
          background: filled ? color : "transparent",
          border: `2px ${filled ? "solid" : "dashed"} ${color}`,
        }}
      />
      <span className="text-foreground">{label}</span>
    </span>
  );
}

function ZoneSnippet({
  title,
  zones,
  empty,
}: {
  title: string;
  zones: OrderDraftZoneSummary[];
  empty: string;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs font-medium mb-2">{title}</div>
      {zones.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {zones.slice(0, 4).map((z) => (
            <li key={z.zone_id} className="flex items-center justify-between gap-2">
              <span className="truncate">
                <span className="font-medium">{z.transport_name}</span>
                <span className="text-muted-foreground"> · {z.zone_name}</span>
              </span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                {z.cell_count} cells
                {z.transport_method ? ` · ${z.transport_method}` : ""}
              </span>
            </li>
          ))}
          {zones.length > 4 && (
            <li className="text-[10px] text-muted-foreground">+{zones.length - 4} more</li>
          )}
        </ul>
      )}
    </div>
  );
}
