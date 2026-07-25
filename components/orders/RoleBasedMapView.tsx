"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { H3MapView } from "@/components/map/H3MapViewDynamic";
import type {
  H3MapCurrentLocation,
  H3MapHandoffMarker,
  H3MapProgressRouteLeg,
  RouteProgressPhase,
} from "@/components/map/H3MapView";
import { MAP_EMPTY_CELLS } from "@/lib/mapConstants";
import { previewOrderZoneConnections } from "@/lib/api";
import { partitionDriverZones, summaryToDriverZone } from "@/lib/orderDraftZoneMap";
import { buildRouteHandoffs, buildRouteSegments, transporterZoneLabel } from "@/lib/orderRouteChain";
import type { RouteMapLeg } from "@/lib/orderRouteChain";
import { getActiveDeliveryPosition, getSegmentNodeState } from "@/lib/deliveryProgress";
import { isPffPaymentMethod } from "@/lib/paymentFlow";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DeliveryProgressTimeline } from "@/components/orders/SegmentTimeline";
import { RoutePathOverview, type RoutePathStop } from "@/components/orders/RoutePathOverview";
import type {
  Order,
  OrderDraftConnection,
  OrderDraftPreview,
  OrderDraftZoneSummary,
  RouteConfirmationStatus,
  SegmentConfirmationDetail,
  TrackingStatus,
} from "@/types";

interface RoleBasedMapViewProps {
  order: Order;
  confirmation: RouteConfirmationStatus | null;
  trackingStatus?: TrackingStatus;
  pickupReadyAt?: string | null;
  goodsReadyAt?: string | null;
  routeConfirmed?: boolean;
  role: "sender" | "receiver" | "driver" | "admin";
  /** Hide the compact progress timeline (e.g. when a larger chain status is shown above). */
  showTimeline?: boolean;
  /** Hide per-segment cost cards under the map. */
  showSegmentCards?: boolean;
  /** Segment IDs belonging to the viewing transporter (emphasized on the path). */
  emphasizeSegmentIds?: number[];
}

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

/** Pick which confirmation segments drive the map path (PFF: one purpose at a time). */
function mapSegmentsForView(
  confirmation: RouteConfirmationStatus | null,
  trackingStatus: TrackingStatus,
  goodsReadyAt: string | null | undefined,
  isPff: boolean
): { segments: SegmentConfirmationDetail[]; purpose: "goods" | "payment" } {
  const all = confirmation?.segments ?? [];
  if (!isPff) return { segments: all, purpose: "goods" };

  const payment = all.filter((s) => s.leg_phase === "payment");
  const goods = all.filter((s) => s.leg_phase === "goods");

  const inGoodsPhase =
    trackingStatus === "PAYMENT_DELIVERED" ||
    trackingStatus === "DELIVERED" ||
    Boolean(goodsReadyAt) ||
    (payment.length > 0 && payment.every((s) => s.leg_status === "in_transit"));

  if (inGoodsPhase && goods.length > 0) return { segments: goods, purpose: "goods" };
  if (payment.length > 0) return { segments: payment, purpose: "payment" };
  if (goods.length > 0) return { segments: goods, purpose: "goods" };
  return { segments: all, purpose: "goods" };
}

function hasSelectedRoute(order: Order): boolean {
  return Boolean(
    order.selected_route_id ||
      order.goods_selected_route_id ||
      order.payment_selected_route_id
  );
}

function matchChainBySegmentCount(
  preview: OrderDraftPreview,
  segmentCount: number
) {
  if (segmentCount <= 0) return null;
  const chains = preview.possible_connection_chains ?? [];
  return (
    chains.find((c) => c.zone_ids.length === segmentCount) ??
    chains.find((c) => c.hops === segmentCount - 1) ??
    chains.find((c) => Math.abs(c.zone_ids.length - segmentCount) <= 1) ??
    null
  );
}

function midpoint(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): { lat: number; lng: number } {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

export function RoleBasedMapView({
  order,
  confirmation,
  trackingStatus = "CONFIRMED",
  pickupReadyAt = null,
  goodsReadyAt = null,
  routeConfirmed = false,
  role,
  showTimeline = true,
  showSegmentCards = true,
  emphasizeSegmentIds = [],
}: RoleBasedMapViewProps) {
  const [preview, setPreview] = useState<OrderDraftPreview | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasPreviewRef = useRef(false);

  const isPff = isPffPaymentMethod(order.payment_method);
  const { segments: mapSegments, purpose: mapPurpose } = useMemo(
    () => mapSegmentsForView(confirmation, trackingStatus, goodsReadyAt, isPff),
    [confirmation, trackingStatus, goodsReadyAt, isPff]
  );

  const loadPreview = useCallback(
    async (silent = false) => {
      if (
        order.sender_lat == null ||
        order.sender_lng == null ||
        order.destination_lat == null ||
        order.destination_lng == null
      ) {
        setPreview(null);
        hasPreviewRef.current = false;
        setInitialLoading(false);
        return;
      }

      if (!silent && !hasPreviewRef.current) {
        setInitialLoading(true);
      } else if (silent && hasPreviewRef.current) {
        setRefreshing(true);
      }

      try {
        const data = await previewOrderZoneConnections(order.id, mapPurpose);
        setPreview(data);
        hasPreviewRef.current = true;
      } catch {
        if (!hasPreviewRef.current) setPreview(null);
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [
      order.id,
      order.sender_lat,
      order.sender_lng,
      order.destination_lat,
      order.destination_lng,
      mapPurpose,
    ]
  );

  useEffect(() => {
    hasPreviewRef.current = false;
    void loadPreview(false);
  }, [loadPreview]);

  const zonesById = useMemo(
    () => (preview ? buildZonesById(preview) : new Map()),
    [preview]
  );
  const connectionsById = useMemo(
    () => (preview ? buildConnectionsById(preview) : new Map()),
    [preview]
  );

  const selectedChain = useMemo(() => {
    if (!preview?.possible_connection_chains?.length) return null;
    if (!hasSelectedRoute(order) && !confirmation?.segments?.length) return null;
    return matchChainBySegmentCount(preview, mapSegments.length);
  }, [preview, confirmation, order, mapSegments.length]);

  const savedZones = useMemo(() => {
    if (!selectedChain) return [];
    return selectedChain.zone_ids
      .map((id) => zonesById.get(id))
      .filter(Boolean)
      .map((z) => summaryToDriverZone(z!));
  }, [selectedChain, zonesById]);

  const handoffMarkers: H3MapHandoffMarker[] = useMemo(() => {
    if (!selectedChain) return [];
    const steps = buildRouteHandoffs(selectedChain, connectionsById, zonesById, new Map());
    return steps.map((s) => s.marker);
  }, [selectedChain, connectionsById, zonesById]);

  const { landZones, pathHubZones } = useMemo(
    () => partitionDriverZones(savedZones),
    [savedZones]
  );

  const endpointCoords = useMemo(() => {
    if (preview?.source && preview?.destination) {
      return {
        pickup: { lat: preview.source.lat, lng: preview.source.lng },
        dropoff: { lat: preview.destination.lat, lng: preview.destination.lng },
      };
    }
    if (
      order.sender_lat == null ||
      order.sender_lng == null ||
      order.destination_lat == null ||
      order.destination_lng == null
    ) {
      return null;
    }
    return {
      pickup: { lat: order.sender_lat, lng: order.sender_lng },
      dropoff: { lat: order.destination_lat, lng: order.destination_lng },
    };
  }, [
    preview,
    order.sender_lat,
    order.sender_lng,
    order.destination_lat,
    order.destination_lng,
  ]);

  const routeSegments = useMemo(() => {
    if (!selectedChain || !endpointCoords) return null;
    const segs = buildRouteSegments(
      selectedChain,
      connectionsById,
      zonesById,
      endpointCoords.pickup,
      endpointCoords.dropoff
    );
    return segs.length > 0 ? segs : null;
  }, [selectedChain, connectionsById, zonesById, endpointCoords]);

  const activePosition = useMemo(
    () =>
      getActiveDeliveryPosition(
        trackingStatus,
        pickupReadyAt,
        routeConfirmed,
        confirmation?.segments ?? [],
        { isPff, goodsReadyAt }
      ),
    [trackingStatus, pickupReadyAt, routeConfirmed, confirmation, isPff, goodsReadyAt]
  );

  /** Color map path like the status chain: green completed, blue current, slate upcoming. */
  const progressRouteLegs = useMemo((): H3MapProgressRouteLeg[] | null => {
    if (!endpointCoords || mapSegments.length === 0) return null;

    const waypoints: { lat: number; lng: number }[] = [endpointCoords.pickup];
    for (const h of handoffMarkers) {
      if (Number.isFinite(h.lat) && Number.isFinite(h.lng)) {
        waypoints.push({ lat: h.lat, lng: h.lng });
      }
    }
    waypoints.push(endpointCoords.dropoff);

    if (waypoints.length < 2) return null;

    const legs: H3MapProgressRouteLeg[] = [];
    const legCount = waypoints.length - 1;

    for (let i = 0; i < legCount; i++) {
      const seg =
        mapSegments[Math.min(i, mapSegments.length - 1)] ??
        mapSegments[mapSegments.length - 1];
      let phase: RouteProgressPhase = "upcoming";
      if (seg) {
        phase = getSegmentNodeState(seg, activePosition);
      } else if (activePosition === "receiver") {
        phase = "completed";
      } else if (activePosition === "sender") {
        phase = i === 0 ? "current" : "upcoming";
      }
      legs.push({
        points: [waypoints[i], waypoints[i + 1]],
        phase,
      });
    }
    return legs;
  }, [endpointCoords, handoffMarkers, mapSegments, activePosition]);

  const accentRouteLegs = useMemo((): RouteMapLeg[] | null => {
    if (emphasizeSegmentIds.length === 0 || !progressRouteLegs?.length) return null;
    const mine = new Set(emphasizeSegmentIds);
    const out: RouteMapLeg[] = [];
    for (let i = 0; i < progressRouteLegs.length; i++) {
      const seg = mapSegments[Math.min(i, mapSegments.length - 1)];
      if (
        seg &&
        mine.has(seg.segment_id) &&
        progressRouteLegs[i].points.length >= 2
      ) {
        out.push({ points: progressRouteLegs[i].points, transportMode: "land" });
      }
    }
    return out.length > 0 ? out : null;
  }, [emphasizeSegmentIds, progressRouteLegs, mapSegments]);

  const routeStops = useMemo((): RoutePathStop[] => {
    if (!selectedChain) return [];
    const stops: RoutePathStop[] = [];
    let idx = 1;
    const firstZone = zonesById.get(selectedChain.zone_ids[0]);
    stops.push({
      index: idx++,
      label: "Pickup",
      detail: order.sender_address || transporterZoneLabel(firstZone, selectedChain.zone_ids[0]),
    });
    for (const h of handoffMarkers) {
      stops.push({
        index: idx++,
        label: `Transfer ${h.index}: ${h.fromTransport} → ${h.toTransport}`,
        detail: h.transferCell ? `Cell ${h.transferCell}` : null,
      });
    }
    const lastZoneId = selectedChain.zone_ids[selectedChain.zone_ids.length - 1];
    const lastZone = zonesById.get(lastZoneId);
    stops.push({
      index: idx,
      label: "Destination",
      detail:
        order.destination_address || transporterZoneLabel(lastZone, lastZoneId),
    });
    return stops;
  }, [selectedChain, zonesById, handoffMarkers, order.sender_address, order.destination_address]);

  const currentLocation = useMemo((): H3MapCurrentLocation | null => {
    if (!endpointCoords) return null;

    if (activePosition === "sender") {
      return {
        lat: endpointCoords.pickup.lat,
        lng: endpointCoords.pickup.lng,
        label: "At sender / awaiting pickup",
      };
    }
    if (activePosition === "receiver") {
      return {
        lat: endpointCoords.dropoff.lat,
        lng: endpointCoords.dropoff.lng,
        label: "At receiver / delivered",
      };
    }

    const segIdx = typeof activePosition === "number" ? activePosition : 0;
    const activeSeg = (confirmation?.segments ?? []).find((s) => s.segment_index === segIdx);
    const label = activeSeg
      ? `With ${activeSeg.transporter_name} — ${activeSeg.from_label} → ${activeSeg.to_label}`
      : "Package in transit";

    // Prefer handoff just after this segment (package moving toward next zone)
    const handoff = handoffMarkers[Math.min(segIdx, Math.max(0, handoffMarkers.length - 1))];
    if (handoff && Number.isFinite(handoff.lat) && Number.isFinite(handoff.lng)) {
      return { lat: handoff.lat, lng: handoff.lng, label };
    }

    if (routeSegments && routeSegments.length > 0) {
      const path = routeSegments[Math.min(segIdx, routeSegments.length - 1)];
      if (path && path.length >= 2) {
        const mid = path[Math.floor(path.length / 2)];
        return { lat: mid.lat, lng: mid.lng, label };
      }
      if (path && path.length === 1) {
        return { lat: path[0].lat, lng: path[0].lng, label };
      }
    }

    return {
      ...midpoint(endpointCoords.pickup, endpointCoords.dropoff),
      label,
    };
  }, [
    endpointCoords,
    activePosition,
    confirmation,
    handoffMarkers,
    routeSegments,
  ]);

  const isProducerView = role === "sender";

  const roleLabel =
    role === "sender"
      ? "Producer view — route path and current delivery location"
      : role === "receiver"
        ? "Receiver view — route path and current delivery location"
        : "Transporter view — assigned route segments";

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading map…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{roleLabel}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void loadPreview(true)}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
          )}
          Refresh map
        </Button>
      </div>

      {showTimeline && confirmation && (
        <DeliveryProgressTimeline
          segments={confirmation.segments}
          trackingStatus={trackingStatus}
          pickupReadyAt={pickupReadyAt}
          goodsReadyAt={goodsReadyAt}
          paymentMethod={order.payment_method}
          routeConfirmed={routeConfirmed}
        />
      )}

      {!selectedChain && !hasSelectedRoute(order) && (
        <p className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/20 px-3 py-2">
          Pickup and delivery are shown on the map. Select a route for this shipment to see
          the full multi-transporter path.
        </p>
      )}
      {!selectedChain && hasSelectedRoute(order) && (
        <p className="text-xs text-amber-700 dark:text-amber-300 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          Route is selected, but the geographic path could not be matched yet. Showing endpoints
          meanwhile.
        </p>
      )}

      {isProducerView ? (
        <RoutePathOverview
          stops={routeStops}
          routeSegments={routeSegments}
          progressRouteLegs={progressRouteLegs}
          handoffMarkers={handoffMarkers}
          savedZones={savedZones}
          endpointCoords={endpointCoords}
          endpointLabels={{
            senderAddress: order.sender_address || "Sender",
            receiverAddress: order.destination_address || "Receiver",
          }}
          currentLocation={currentLocation}
          defaultShowZones={false}
          height={360}
        />
      ) : (
        <H3MapView
          resolution={15}
          selectedCells={MAP_EMPTY_CELLS}
          interactive
          savedZones={landZones}
          pathHubZones={pathHubZones}
          routeSegments={routeSegments}
          progressRouteLegs={progressRouteLegs}
          accentRouteLegs={accentRouteLegs}
          accentRouteLabel="Your segment"
          handoffMarkers={handoffMarkers}
          endpointCoords={endpointCoords}
          endpointLabels={{
            senderAddress: order.sender_address || "Sender",
            receiverAddress: order.destination_address || "Receiver",
          }}
          currentLocation={currentLocation}
          fitFocus="endpoints"
          height={360}
        />
      )}

      {showSegmentCards && confirmation && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {confirmation.segments.map((seg) => {
            const mine = emphasizeSegmentIds.includes(seg.segment_id);
            return (
            <div
              key={seg.segment_id}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs",
                mine
                  ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
                  : "border-border"
              )}
              title={`${seg.transporter_name} · ${seg.status}`}
            >
              {mine && (
                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                  Your segment
                </p>
              )}
              <p className="font-medium capitalize">
                {seg.leg_status !== "not_started" ? seg.leg_status.replace("_", " ") : seg.status}
              </p>
              <p className="text-muted-foreground">
                {seg.from_label} → {seg.to_label}
              </p>
              <p>{seg.transporter_name}</p>
              {seg.final_cost != null && (
                <p className="text-muted-foreground mt-1">
                  Cost: {seg.final_cost.toFixed(2)} {seg.currency}
                </p>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
