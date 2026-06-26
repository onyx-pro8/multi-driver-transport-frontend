"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { H3MapView } from "@/components/map/H3MapViewDynamic";
import { MAP_EMPTY_CELLS, ORDER_DRAFT_MAP_HEIGHT } from "@/lib/mapConstants";
import { previewOrderZoneConnections } from "@/lib/api";
import { summaryToDriverZone, zoneCells } from "@/lib/orderDraftZoneMap";
import {
  buildRouteHandoffs,
  buildRouteSegments,
  buildSegmentAccentLegs,
  resolveRouteChain,
} from "@/lib/orderRouteChain";
import { isHubMode, normalizeTransportMode } from "@/lib/transportMode";
import type {
  ConvertH3Response,
  DriverZone,
  OrderDraftConnection,
  OrderDraftPreview,
  OrderDraftZoneSummary,
  TransporterQuoteRequest,
} from "@/types";

const ZONE_PALETTE = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function buildZonesById(preview: OrderDraftPreview): Map<number, OrderDraftZoneSummary> {
  const m = new Map<number, OrderDraftZoneSummary>();
  for (const z of preview.connected_zones ?? []) m.set(z.zone_id, z);
  for (const z of preview.pickup_zones ?? []) m.set(z.zone_id, z);
  for (const z of preview.destination_zones ?? []) m.set(z.zone_id, z);
  return m;
}

function buildConnectionsById(preview: OrderDraftPreview): Map<number, OrderDraftConnection> {
  const m = new Map<number, OrderDraftConnection>();
  for (const c of preview.connections ?? []) m.set(c.id, c);
  return m;
}

interface Props {
  item: TransporterQuoteRequest;
}

export function QuoteSegmentMap({ item }: Props) {
  const [preview, setPreview] = useState<OrderDraftPreview | null>(null);
  const [coords, setCoords] = useState<{
    source: { lat: number; lng: number };
    destination: { lat: number; lng: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await previewOrderZoneConnections(item.order_id);
        if (!cancelled) {
          setPreview(data);
          setCoords({
            source: { lat: data.source.lat, lng: data.source.lng },
            destination: { lat: data.destination.lat, lng: data.destination.lng },
          });
        }
      } catch (err) {
        if (!cancelled) {
          setPreview(null);
          setCoords(null);
          setError(err instanceof Error ? err.message : "Failed to load route map");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [item.order_id]);

  const zonesById = useMemo(
    () => (preview ? buildZonesById(preview) : new Map()),
    [preview]
  );
  const connectionsById = useMemo(
    () => (preview ? buildConnectionsById(preview) : new Map()),
    [preview]
  );

  const routeChain = useMemo(() => {
    if (!preview) return null;
    const zoneIds = item.zone_ids ?? [];
    const connectionIds = item.connection_ids ?? [];
    if (zoneIds.length > 0) {
      return resolveRouteChain(preview.possible_connection_chains ?? [], zoneIds, connectionIds);
    }
    const match = item.route_label.match(/route\s+(\d+)/i);
    const idx = match ? Math.max(0, Number(match[1]) - 1) : 0;
    return preview.possible_connection_chains?.[idx] ?? preview.possible_connection_chains?.[0] ?? null;
  }, [preview, item.zone_ids, item.connection_ids, item.route_label]);

  const zoneColorById = useMemo(() => {
    const m = new Map<number, string>();
    routeChain?.zone_ids.forEach((id, idx) => {
      m.set(id, ZONE_PALETTE[idx % ZONE_PALETTE.length]);
    });
    return m;
  }, [routeChain]);

  const savedZones = useMemo<DriverZone[]>(() => {
    if (!routeChain) return [];
    return routeChain.zone_ids
      .map((id) => zonesById.get(id))
      .filter(Boolean)
      .filter((z) => {
        const mode = normalizeTransportMode(z!.transport_method);
        if (isHubMode(mode)) {
          const dep = z!.departure_hub;
          const arr = z!.arrival_hub;
          return (
            dep != null &&
            arr != null &&
            Number.isFinite(dep.lat) &&
            Number.isFinite(dep.lng) &&
            Number.isFinite(arr.lat) &&
            Number.isFinite(arr.lng)
          );
        }
        return zoneCells(z!).length > 0;
      })
      .map((z) => summaryToDriverZone(z!));
  }, [routeChain, zonesById]);

  const routeSegmentsForMap = useMemo(() => {
    if (!preview || !routeChain || !coords) return null;
    return buildRouteSegments(
      routeChain,
      connectionsById,
      zonesById,
      coords.source,
      coords.destination
    );
  }, [preview, routeChain, connectionsById, zonesById, coords]);

  const accentRouteLegs = useMemo(() => {
    if (!routeChain || !coords) return null;
    const legs = buildSegmentAccentLegs(
      item.segment,
      routeChain,
      connectionsById,
      zonesById,
      coords.source,
      coords.destination
    );
    return legs.length > 0 ? legs : null;
  }, [item.segment, routeChain, connectionsById, zonesById, coords]);

  const handoffMarkers = useMemo(() => {
    if (!routeChain) return [];
    return buildRouteHandoffs(routeChain, connectionsById, zonesById, zoneColorById).map(
      (h) => h.marker
    );
  }, [routeChain, connectionsById, zonesById, zoneColorById]);

  const focusZone = useMemo(() => {
    const summary = zonesById.get(item.priced_zone_id);
    return summary ? summaryToDriverZone(summary) : null;
  }, [item.priced_zone_id, zonesById]);

  const conversionForMap = useMemo<ConvertH3Response | null>(() => {
    if (!preview) return null;
    return {
      pickup_h3: preview.source.h3,
      dropoff_h3: preview.destination.h3,
      resolution: preview.preview_resolution,
      cell_type: "Hexagon" as const,
      pickup_center: { lat: preview.source.lat, lng: preview.source.lng },
      dropoff_center: { lat: preview.destination.lat, lng: preview.destination.lng },
    };
  }, [preview]);

  const endpointLabels = useMemo(
    () => ({
      senderName: "Sender",
      senderAddress: item.sender_address,
      receiverName: "Receiver",
      receiverAddress: item.destination_address,
    }),
    [item.sender_address, item.destination_address]
  );

  if (loading) {
    return (
      <div
        className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 text-sm text-muted-foreground"
        style={{ height: ORDER_DRAFT_MAP_HEIGHT }}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading route map…
      </div>
    );
  }

  if (error || !preview || !routeChain || !coords) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>{error ?? "Route geometry is not available for this order."}</span>
      </div>
    );
  }

  const segmentLabel = `${item.segment.from_label} → ${item.segment.to_label}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium">{item.route_label}</span>
        <span className="text-muted-foreground">·</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-800 dark:text-amber-200 font-medium">
          <span className="inline-block h-0.5 w-4 rounded-full bg-amber-500" aria-hidden />
          Your segment: {segmentLabel}
        </span>
      </div>
      <div
        className="relative w-full overflow-hidden rounded-xl border border-border"
        style={{ height: ORDER_DRAFT_MAP_HEIGHT }}
      >
        <H3MapView
          height="100%"
          resolution={preview.preview_resolution}
          selectedCells={MAP_EMPTY_CELLS}
          savedZones={savedZones}
          conversion={conversionForMap}
          endpointLabels={endpointLabels}
          routeSegments={routeSegmentsForMap}
          accentRouteLegs={accentRouteLegs}
          accentRouteLabel="Your segment"
          handoffMarkers={handoffMarkers}
          focusZone={focusZone}
          showZoneTooltips
          interactive
        />
        <div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex flex-col gap-1.5 rounded-xl border border-border bg-card/95 backdrop-blur px-3 py-2 text-[11px] shadow-card">
          <span className="inline-flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300">
            <span
              className="inline-block h-1 w-8 rounded-full bg-amber-500"
              aria-hidden
            />
            Your segment
          </span>
          <span className="text-muted-foreground pl-10 leading-snug">{segmentLabel}</span>
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <span
              className="inline-block h-0.5 w-8 rounded-full bg-blue-600"
              aria-hidden
            />
            Full route
          </span>
        </div>
      </div>
    </div>
  );
}
