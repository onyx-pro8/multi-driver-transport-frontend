"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { H3MapView } from "@/components/map/H3MapViewDynamic";
import { MAP_EMPTY_CELLS, ORDER_DRAFT_MAP_HEIGHT } from "@/lib/mapConstants";
import { previewOrderZoneConnections } from "@/lib/api";
import { summaryToDriverZone, zoneCells } from "@/lib/orderDraftZoneMap";
import { buildSegmentAccentLegs } from "@/lib/orderRouteChain";
import { isHubMode, normalizeTransportMode } from "@/lib/transportMode";
import type {
  ConvertH3Response,
  DriverZone,
  OrderDraftConnection,
  OrderDraftPreview,
  OrderDraftZoneSummary,
  TransporterConfirmationItem,
} from "@/types";

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
  item: TransporterConfirmationItem;
}

export function ConfirmationSegmentMap({ item }: Props) {
  const [preview, setPreview] = useState<OrderDraftPreview | null>(null);
  const [coords, setCoords] = useState<{
    source: { lat: number; lng: number };
    destination: { lat: number; lng: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const routePurpose =
    item.route_purpose === "payment" ? "payment" : "goods";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await previewOrderZoneConnections(item.order_id, routePurpose);
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
          setError(err instanceof Error ? err.message : "Failed to load segment map");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [item.order_id, routePurpose]);

  const routeChain = useMemo(() => {
    const zoneIds = item.zone_ids ?? [];
    if (zoneIds.length === 0) return null;
    return {
      zone_ids: zoneIds,
      connection_ids: item.connection_ids ?? [],
      hops: zoneIds.length,
    };
  }, [item.zone_ids, item.connection_ids]);

  const zonesById = useMemo(
    () => (preview ? buildZonesById(preview) : new Map()),
    [preview],
  );
  const connectionsById = useMemo(
    () => (preview ? buildConnectionsById(preview) : new Map()),
    [preview],
  );

  const segmentZoneIds = useMemo(() => {
    if (!routeChain) return [];
    const idx = item.segment_index;
    const ids: number[] = [];
    if (idx > 0) ids.push(routeChain.zone_ids[idx - 1]!);
    if (routeChain.zone_ids[idx] != null) ids.push(routeChain.zone_ids[idx]!);
    return Array.from(new Set(ids));
  }, [routeChain, item.segment_index]);

  const savedZones = useMemo<DriverZone[]>(() => {
    return segmentZoneIds
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
  }, [segmentZoneIds, zonesById]);

  const accentRouteLegs = useMemo(() => {
    if (!routeChain || !coords) return null;
    const legs = buildSegmentAccentLegs(
      {
        segment_index: item.segment_index,
        zone_id: item.zone_id ?? null,
        transport_method: item.transport_method ?? "land",
      },
      routeChain,
      connectionsById,
      zonesById,
      coords.source,
      coords.destination,
    );
    return legs.length > 0 ? legs : null;
  }, [
    routeChain,
    coords,
    item.segment_index,
    item.zone_id,
    item.transport_method,
    connectionsById,
    zonesById,
  ]);

  const focusZone = useMemo(() => {
    const focusId = item.zone_id ?? segmentZoneIds[segmentZoneIds.length - 1];
    const summary = focusId != null ? zonesById.get(focusId) : undefined;
    return summary ? summaryToDriverZone(summary) : null;
  }, [item.zone_id, segmentZoneIds, zonesById]);

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

  const endpointLabels = useMemo(() => {
    if (routePurpose === "payment") {
      return {
        senderName: "Receiver",
        senderAddress: item.destination_address,
        receiverName: "Producer",
        receiverAddress: item.sender_address,
      };
    }
    return {
      senderName: "Sender",
      senderAddress: item.sender_address,
      receiverName: "Receiver",
      receiverAddress: item.destination_address,
    };
  }, [routePurpose, item.sender_address, item.destination_address]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 text-sm text-muted-foreground"
        style={{ height: ORDER_DRAFT_MAP_HEIGHT }}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading segment map…
      </div>
    );
  }

  if (error || !preview || !routeChain || !coords || !accentRouteLegs) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>{error ?? "Segment geometry is not available for this order."}</span>
      </div>
    );
  }

  const segmentLabel = `${item.from_label} → ${item.to_label}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium">{item.route_label}</span>
        <span className="text-muted-foreground">·</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-800 dark:text-amber-200 font-medium">
          <span className="inline-block h-0.5 w-4 rounded-full bg-amber-500" aria-hidden />
          Segment: {segmentLabel}
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
          accentRouteLegs={accentRouteLegs}
          accentRouteLabel="This segment"
          focusZone={focusZone}
          showZoneTooltips
          interactive
        />
      </div>
    </div>
  );
}
