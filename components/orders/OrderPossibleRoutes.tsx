"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { previewOrderZoneConnections } from "@/lib/api";
import { isPffPaymentMethod } from "@/lib/paymentFlow";
import { isOrderRouteSelectionBlocked } from "@/lib/trackingActions";
import { useAuth } from "@/hooks/useAuth";
import {
  PFF_GOODS_ROUTE_DIRECTION,
  PFF_GOODS_ROUTE_TITLE,
  PFF_PAYMENT_ROUTE_DIRECTION,
  PFF_PAYMENT_ROUTE_TITLE,
} from "@/lib/pffTracking";
import type { Order, OrderDraftPreview } from "@/types";
import { OrderDraftZonePreview } from "@/components/orders/OrderDraftZonePreview";

interface Props {
  order: Order;
  /** Bump to silently reload route preview (e.g. after package edit). */
  refreshSignal?: number;
  onMessage?: (text: string, type?: "success" | "error") => void;
}

/**
 * Possible routes for an existing order. Recomputed live against the current
 * zone graph. For PFF orders the receiver sees the payment route
 * (receiver → sender) and the sender sees the goods/delivery route
 * (sender → receiver); admins and drivers see both. Air/sea legs are
 * one-directional so the two routes differ wherever a hub is involved.
 */
export function OrderPossibleRoutes({ order, refreshSignal = 0, onMessage }: Props) {
  const { user } = useAuth();
  const [goodsPreview, setGoodsPreview] = useState<OrderDraftPreview | null>(null);
  const [paymentPreview, setPaymentPreview] = useState<OrderDraftPreview | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasPreviewRef = useRef(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const isPff = isPffPaymentMethod(order.payment_method);
  const role = user?.role;
  // Receiver owns the payment route; sender owns the goods route. Admins and
  // drivers may need both.
  const showPaymentPreview =
    isPff && (role === "receiver" || role === "admin" || role === "driver");
  const showGoodsPreview =
    !isPff || role === "sender" || role === "admin" || role === "driver";

  const hasCoords =
    order.sender_lat != null &&
    order.sender_lng != null &&
    order.destination_lat != null &&
    order.destination_lng != null;
  const routeSelectionBlocked = isOrderRouteSelectionBlocked(order);

  const load = useCallback(
    async (silent = false) => {
      if (routeSelectionBlocked) {
        setGoodsPreview(null);
        setPaymentPreview(null);
        setError(null);
        hasPreviewRef.current = false;
        setInitialLoading(false);
        setRefreshing(false);
        return;
      }

      if (!hasCoords) {
        setGoodsPreview(null);
        setPaymentPreview(null);
        setError("This order has no pickup/destination coordinates to compute routes.");
        hasPreviewRef.current = false;
        setInitialLoading(false);
        return;
      }

      if (!silent && !hasPreviewRef.current) {
        setInitialLoading(true);
      } else if (silent && hasPreviewRef.current) {
        setRefreshing(true);
      }
      setError(null);

      try {
        if (isPff) {
          const [goods, payment] = await Promise.all([
            showGoodsPreview
              ? previewOrderZoneConnections(order.id, "goods")
              : Promise.resolve(null),
            showPaymentPreview
              ? previewOrderZoneConnections(order.id, "payment")
              : Promise.resolve(null),
          ]);
          setGoodsPreview(goods);
          setPaymentPreview(payment);
        } else {
          const result = await previewOrderZoneConnections(order.id, "goods");
          setGoodsPreview(result);
          setPaymentPreview(null);
        }
        hasPreviewRef.current = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load possible routes";
        if (!hasPreviewRef.current) {
          setError(msg);
          onMessageRef.current?.(msg, "error");
          setGoodsPreview(null);
          setPaymentPreview(null);
        }
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [hasCoords, isPff, order.id, routeSelectionBlocked, showGoodsPreview, showPaymentPreview],
  );

  useEffect(() => {
    hasPreviewRef.current = false;
    void load(false);
  }, [order.id, load]);

  useEffect(() => {
    if (refreshSignal === 0 || !hasPreviewRef.current) return;
    void load(true);
  }, [refreshSignal, order.id, load]);

  if (routeSelectionBlocked) {
    return null;
  }

  if (error && !goodsPreview && !paymentPreview) {
    return (
      <OrderDraftZonePreview
        preview={null}
        loading={initialLoading}
        refreshing={refreshing}
        error={error}
      />
    );
  }

  return (
    <div className="space-y-4">
      {isPff && showPaymentPreview && (
        <OrderDraftZonePreview
          preview={paymentPreview}
          loading={initialLoading}
          refreshing={refreshing}
          error={null}
          heading={`${PFF_PAYMENT_ROUTE_TITLE} · ${PFF_PAYMENT_ROUTE_DIRECTION}`}
        />
      )}
      {showGoodsPreview && (
        <OrderDraftZonePreview
          preview={goodsPreview}
          loading={initialLoading}
          refreshing={refreshing}
          error={isPff ? null : error}
          heading={
            isPff ? `${PFF_GOODS_ROUTE_TITLE} · ${PFF_GOODS_ROUTE_DIRECTION}` : undefined
          }
        />
      )}
    </div>
  );
}
