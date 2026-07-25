"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, MapPin, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleBasedMapView } from "@/components/orders/RoleBasedMapView";
import {
  getOrderTrackingStatus,
  getReceiverOrderView,
  getRouteConfirmationStatus,
  getRouteSelections,
  getSelectedRoute,
  getSenderOrderView,
} from "@/lib/api";
import { isPffPaymentMethod } from "@/lib/paymentFlow";
import {
  isPffTrackingRouteConfirmed,
  mergePffTrackingSegments,
} from "@/lib/pffTracking";
import { latestDeliveringOrder } from "@/lib/orderWorkflow";
import type {
  Order,
  PffRouteSelections,
  RouteConfirmationStatus,
  TrackingStatus,
} from "@/types";

interface Props {
  orders: Order[];
  role: "sender" | "receiver" | "driver";
  loading?: boolean;
}

export function LiveShipmentMapCard({ orders, role, loading }: Props) {
  const ordersHref =
    role === "driver" ? "/transporter/confirmations" : "/orders";
  const orderDetailHref = (orderId: number) =>
    role === "driver"
      ? `/transporter/confirmations`
      : `/orders?orderId=${orderId}`;

  const liveOrder = useMemo(() => latestDeliveringOrder(orders), [orders]);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>("CONFIRMED");
  const [pickupReadyAt, setPickupReadyAt] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<RouteConfirmationStatus | null>(null);
  const [paymentConfirmation, setPaymentConfirmation] =
    useState<RouteConfirmationStatus | null>(null);
  const [goodsConfirmation, setGoodsConfirmation] =
    useState<RouteConfirmationStatus | null>(null);
  const [routeSelections, setRouteSelections] = useState<PffRouteSelections | null>(null);
  const [mapLoading, setMapLoading] = useState(false);

  const load = useCallback(async (order: Order) => {
    setMapLoading(true);
    try {
      const tracking = await getOrderTrackingStatus(order.id).catch(() => null);
      if (tracking) {
        setTrackingStatus(tracking.tracking_status);
        setPickupReadyAt(tracking.pickup_ready_at);
      } else {
        setTrackingStatus(order.tracking_status);
        setPickupReadyAt(order.pickup_ready_at ?? null);
      }

      if (isPffPaymentMethod(order.payment_method)) {
        const selections = await getRouteSelections(order.id).catch(() => null);
        setRouteSelections(selections);
        const [pay, goods] = await Promise.all([
          selections?.payment?.selected_route_id
            ? getRouteConfirmationStatus(selections.payment.selected_route_id).catch(() => null)
            : Promise.resolve(null),
          selections?.goods?.selected_route_id
            ? getRouteConfirmationStatus(selections.goods.selected_route_id).catch(() => null)
            : Promise.resolve(null),
        ]);
        setPaymentConfirmation(pay);
        setGoodsConfirmation(goods);
        setConfirmation(goods ?? pay);
        return;
      }

      setRouteSelections(null);
      setPaymentConfirmation(null);
      setGoodsConfirmation(null);

      if (role === "sender") {
        const view = await getSenderOrderView(order.id).catch(() => null);
        if (view?.confirmation) {
          setConfirmation(view.confirmation);
          return;
        }
      } else if (role === "receiver") {
        const view = await getReceiverOrderView(order.id).catch(() => null);
        if (view?.confirmation) {
          setConfirmation(view.confirmation);
          return;
        }
      }
      // driver (and fallbacks): resolve via selected route confirmation below

      if (order.selected_route_id) {
        setConfirmation(
          await getRouteConfirmationStatus(order.selected_route_id).catch(() => null)
        );
      } else {
        try {
          const selection = await getSelectedRoute(order.id);
          setConfirmation(await getRouteConfirmationStatus(selection.selected_route_id));
        } catch {
          setConfirmation(null);
        }
      }
    } finally {
      setMapLoading(false);
    }
  }, [role]);

  useEffect(() => {
    if (!liveOrder) {
      setConfirmation(null);
      return;
    }
    void load(liveOrder);
  }, [liveOrder, load]);

  const isPff = isPffPaymentMethod(liveOrder?.payment_method);
  const mergedSegments = useMemo(
    () => mergePffTrackingSegments(paymentConfirmation, goodsConfirmation),
    [paymentConfirmation, goodsConfirmation]
  );
  const trackingConfirmation = useMemo((): RouteConfirmationStatus | null => {
    if (!isPff) return confirmation;
    if (!paymentConfirmation && !goodsConfirmation) return null;
    const base = goodsConfirmation ?? paymentConfirmation!;
    return { ...base, segments: mergedSegments };
  }, [isPff, confirmation, paymentConfirmation, goodsConfirmation, mergedSegments]);

  const routeConfirmed =
    liveOrder?.route_selection_status === "confirmed" ||
    confirmation?.selection_status === "confirmed";
  const bothConfirmed = isPffTrackingRouteConfirmed(isPff, routeSelections, routeConfirmed);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4" />
          Live shipment map
        </CardTitle>
        {liveOrder && (
          <Link
            href={orderDetailHref(liveOrder.id)}
            className="text-xs text-primary font-medium hover:underline"
          >
            Open order {liveOrder.id}
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {loading || mapLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading map…
          </div>
        ) : !liveOrder ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center text-sm text-muted-foreground">
            <Package className="h-8 w-8 opacity-40" />
            <p>No packages currently delivering.</p>
            <Link href={ordersHref} className="text-primary hover:underline text-xs font-medium">
              {role === "driver" ? "View my shipments" : "View all orders"}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Latest delivering package · {liveOrder.sender_address || "Pickup"} →{" "}
              {liveOrder.destination_address || "Destination"}
            </p>
            <RoleBasedMapView
              order={liveOrder}
              confirmation={trackingConfirmation}
              trackingStatus={trackingStatus}
              pickupReadyAt={pickupReadyAt ?? liveOrder.pickup_ready_at}
              goodsReadyAt={liveOrder.goods_ready_at}
              routeConfirmed={bothConfirmed || Boolean(routeConfirmed)}
              role={role}
              showSegmentCards={false}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
