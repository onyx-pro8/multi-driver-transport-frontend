"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeliveryStatusStepper } from "@/components/orders/DeliveryStatusStepper";
import { RoleBasedMapView } from "@/components/orders/RoleBasedMapView";
import { RouteConfirmationStatusPanel } from "@/components/orders/ConfirmationPanel";
import { OrderProgressBar } from "@/components/orders/SegmentTimeline";
import { RouteStatusBadge } from "@/components/orders/RouteStatusBadge";
import {
  getOrderById,
  getOrderTrackingStatus,
  getReceiverOrderView,
  getRouteConfirmationStatus,
  getRouteSelections,
  getSelectedRoute,
  getSenderOrderView,
} from "@/lib/api";
import { orderTrackingBackLink } from "@/lib/orderTrackingPaths";
import { isPffPaymentMethod } from "@/lib/paymentFlow";
import {
  isPffTrackingRouteConfirmed,
  mergePffTrackingSegments,
  PFF_GOODS_ROUTE_TITLE,
  PFF_PAYMENT_ROUTE_TITLE,
} from "@/lib/pffTracking";
import type {
  Order,
  PffRouteSelections,
  RouteConfirmationStatus,
  TrackingStatus,
} from "@/types";

interface Props {
  orderId: number;
  /** Transporter workspace uses confirmations back link instead of orders. */
  audience?: "default" | "transporter";
}

export function OrderTrackingPage({ orderId, audience = "default" }: Props) {
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>("CONFIRMED");
  const [pickupReadyAt, setPickupReadyAt] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<RouteConfirmationStatus | null>(null);
  const [paymentConfirmation, setPaymentConfirmation] =
    useState<RouteConfirmationStatus | null>(null);
  const [goodsConfirmation, setGoodsConfirmation] =
    useState<RouteConfirmationStatus | null>(null);
  const [routeSelections, setRouteSelections] = useState<PffRouteSelections | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderLoaded, setOrderLoaded] = useState(false);
  const hasLoadedRef = useRef(false);
  const routeIdRef = useRef<number | null>(null);
  const pffRouteIdsRef = useRef<{ payment?: number; goods?: number }>({});

  const loadPffConfirmations = useCallback(async () => {
    const selections = await getRouteSelections(orderId);
    setRouteSelections(selections);
    pffRouteIdsRef.current = {
      payment: selections.payment?.selected_route_id,
      goods: selections.goods?.selected_route_id,
    };

    let payConf: RouteConfirmationStatus | null = null;
    let goodsConf: RouteConfirmationStatus | null = null;

    if (selections.payment?.selected_route_id) {
      try {
        payConf = await getRouteConfirmationStatus(selections.payment.selected_route_id);
      } catch {
        payConf = null;
      }
    }
    if (selections.goods?.selected_route_id) {
      try {
        goodsConf = await getRouteConfirmationStatus(selections.goods.selected_route_id);
      } catch {
        goodsConf = null;
      }
    }

    setPaymentConfirmation(payConf);
    setGoodsConfirmation(goodsConf);
    setConfirmation(goodsConf ?? payConf);
    routeIdRef.current = goodsConf?.route_id ?? payConf?.route_id ?? null;
  }, [orderId]);

  const loadConfirmationContext = useCallback(async () => {
    const role = user?.role;
    const currentOrder = order;

    if (currentOrder && isPffPaymentMethod(currentOrder.payment_method)) {
      await loadPffConfirmations();
      return;
    }

    if (role === "sender" || role === "admin") {
      const view = await getSenderOrderView(orderId);
      setConfirmation(view.confirmation);
      routeIdRef.current = view.confirmation?.route_id ?? null;
    } else if (role === "receiver") {
      const view = await getReceiverOrderView(orderId);
      setConfirmation(view.confirmation);
      routeIdRef.current = view.confirmation?.route_id ?? null;
    } else {
      setConfirmation(null);
      routeIdRef.current = null;
    }

    setPaymentConfirmation(null);
    setGoodsConfirmation(null);
    setRouteSelections(null);
    pffRouteIdsRef.current = {};

    if (!routeIdRef.current) {
      try {
        const selection = await getSelectedRoute(orderId);
        routeIdRef.current = selection.selected_route_id;
        const status = await getRouteConfirmationStatus(selection.selected_route_id);
        setConfirmation(status);
      } catch {
        routeIdRef.current = null;
      }
    }
  }, [orderId, user?.role, order, loadPffConfirmations]);

  const refreshPffConfirmations = useCallback(async () => {
    const { payment, goods } = pffRouteIdsRef.current;
    if (payment) {
      try {
        const status = await getRouteConfirmationStatus(payment);
        setPaymentConfirmation(status);
      } catch {
        // Keep last good data.
      }
    }
    if (goods) {
      try {
        const status = await getRouteConfirmationStatus(goods);
        setGoodsConfirmation(status);
        setConfirmation(status);
      } catch {
        // Keep last good data.
      }
    }
  }, []);

  const pollLiveData = useCallback(async () => {
    if (!hasLoadedRef.current) return;
    setRefreshing(true);
    try {
      const tracking = await getOrderTrackingStatus(orderId);
      setTrackingStatus(tracking.tracking_status);
      setPickupReadyAt(tracking.pickup_ready_at);
      if (pffRouteIdsRef.current.payment || pffRouteIdsRef.current.goods) {
        await refreshPffConfirmations();
      } else if (routeIdRef.current) {
        const status = await getRouteConfirmationStatus(routeIdRef.current);
        setConfirmation(status);
      }
    } catch {
      // Keep last good data during background refresh.
    } finally {
      setRefreshing(false);
    }
  }, [orderId, refreshPffConfirmations]);

  useEffect(() => {
    hasLoadedRef.current = false;
    routeIdRef.current = null;
    pffRouteIdsRef.current = {};
    setOrderLoaded(false);
    setInitialLoading(true);
    setError(null);
    setPaymentConfirmation(null);
    setGoodsConfirmation(null);
    setRouteSelections(null);

    void (async () => {
      try {
        const o = await getOrderById(orderId);
        setOrder(o);
        hasLoadedRef.current = true;
        setOrderLoaded(true);
        const tracking = await getOrderTrackingStatus(orderId);
        setTrackingStatus(tracking.tracking_status);
        setPickupReadyAt(tracking.pickup_ready_at);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tracking data");
      } finally {
        setInitialLoading(false);
      }
    })();
  }, [orderId]);

  useEffect(() => {
    if (!orderLoaded || !user?.role) return;
    void loadConfirmationContext();
  }, [orderLoaded, user?.role, loadConfirmationContext]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    const id = setInterval(() => {
      void pollLiveData();
    }, 15000);
    return () => clearInterval(id);
  }, [orderId, pollLiveData]);

  const isPff = isPffPaymentMethod(order?.payment_method);
  const mergedSegments = useMemo(
    () => mergePffTrackingSegments(paymentConfirmation, goodsConfirmation),
    [paymentConfirmation, goodsConfirmation]
  );
  const trackingConfirmation = useMemo((): RouteConfirmationStatus | null => {
    if (!isPff) return confirmation;
    if (!paymentConfirmation && !goodsConfirmation) return null;
    const base = goodsConfirmation ?? paymentConfirmation!;
    return {
      ...base,
      segments: mergedSegments,
    };
  }, [isPff, confirmation, paymentConfirmation, goodsConfirmation, mergedSegments]);

  if (initialLoading) {
    return (
      <div className="px-6 pb-8 flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading order tracking…
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="px-6 pb-8 text-center py-12 text-sm text-red-600 dark:text-red-400">
        {error ?? "Order not found"}
      </div>
    );
  }

  const role = user?.role ?? "sender";
  const routeConfirmed =
    order.route_selection_status === "confirmed" ||
    confirmation?.selection_status === "confirmed";
  const bothRoutesConfirmed = isPffTrackingRouteConfirmed(isPff, routeSelections, routeConfirmed);
  const backLink =
    audience === "transporter"
      ? orderTrackingBackLink("driver")
      : orderTrackingBackLink(role);

  return (
    <div className="px-6 pb-8 space-y-6">
      {audience === "transporter" ? (
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/transporter/confirmations" className="hover:text-foreground">
            My shipments
          </Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">Order #{order.id}</span>
          <span aria-hidden>/</span>
          <span className="text-foreground font-medium">Tracking</span>
        </nav>
      ) : (
        <Link
          href={backLink.href}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLink.label}
        </Link>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Order #{order.id} tracking
            </CardTitle>
            <div className="flex items-center gap-2">
              {refreshing && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
              {isPff ? (
                <>
                  {paymentConfirmation && (
                    <RouteStatusBadge status={paymentConfirmation.selection_status} />
                  )}
                  {goodsConfirmation && (
                    <RouteStatusBadge status={goodsConfirmation.selection_status} />
                  )}
                </>
              ) : (
                confirmation && <RouteStatusBadge status={confirmation.selection_status} />
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {order.sender_address} → {order.destination_address}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <DeliveryStatusStepper
            trackingStatus={trackingStatus}
            pickupReadyAt={pickupReadyAt ?? order.pickup_ready_at}
            goodsReadyAt={order.goods_ready_at}
            routeConfirmed={routeConfirmed}
            bothRoutesConfirmed={bothRoutesConfirmed}
            isPff={isPff}
            segments={isPff ? mergedSegments : confirmation?.segments}
          />
          {!isPff && confirmation && confirmation.selection_status !== "confirmed" && (
            <OrderProgressBar
              percent={confirmation.progress_percent}
              label="Route confirmation progress"
            />
          )}
          {isPff && (
            <div className="grid gap-3 sm:grid-cols-2">
              {paymentConfirmation &&
                paymentConfirmation.selection_status !== "confirmed" && (
                  <OrderProgressBar
                    percent={paymentConfirmation.progress_percent}
                    label={`${PFF_PAYMENT_ROUTE_TITLE} confirmation`}
                  />
                )}
              {goodsConfirmation && goodsConfirmation.selection_status !== "confirmed" && (
                <OrderProgressBar
                  percent={goodsConfirmation.progress_percent}
                  label={`${PFF_GOODS_ROUTE_TITLE} confirmation`}
                />
              )}
            </div>
          )}
          <RoleBasedMapView
            order={order}
            confirmation={trackingConfirmation}
            trackingStatus={trackingStatus}
            pickupReadyAt={pickupReadyAt ?? order.pickup_ready_at}
            goodsReadyAt={order.goods_ready_at}
            routeConfirmed={bothRoutesConfirmed || routeConfirmed}
            role={role === "driver" ? "driver" : role === "receiver" ? "receiver" : "sender"}
          />
        </CardContent>
      </Card>

      {isPff && (paymentConfirmation || goodsConfirmation) ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {paymentConfirmation && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{PFF_PAYMENT_ROUTE_TITLE}</CardTitle>
              </CardHeader>
              <CardContent>
                <RouteConfirmationStatusPanel confirmation={paymentConfirmation} />
              </CardContent>
            </Card>
          )}
          {goodsConfirmation && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{PFF_GOODS_ROUTE_TITLE}</CardTitle>
              </CardHeader>
              <CardContent>
                <RouteConfirmationStatusPanel confirmation={goodsConfirmation} />
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        confirmation && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Segment confirmation details</CardTitle>
            </CardHeader>
            <CardContent>
              <RouteConfirmationStatusPanel confirmation={confirmation} />
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
