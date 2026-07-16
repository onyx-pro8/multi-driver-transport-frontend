"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getPricingConfig,
  getRouteConfirmationStatus,
  getRouteSelections,
  updateOrderTrackingStatus,
} from "@/lib/api";
import { isPffPaymentMethod } from "@/lib/paymentFlow";
import { formatBookingFeePercent } from "@/lib/pricing";
import {
  PFF_AIR_SEA_RULE_NOTE,
  PFF_DUAL_ROUTE_INTRO,
  PFF_GOODS_ROUTE_DIRECTION,
  PFF_GOODS_ROUTE_TITLE,
  PFF_PAYMENT_ROUTE_DIRECTION,
  PFF_PAYMENT_ROUTE_TITLE,
  PFF_PENDING_BOTH_ROUTES_NOTE,
} from "@/lib/pffTracking";
import { cn } from "@/lib/utils";
import type {
  Order,
  PricingConfig,
  PffRouteSelections,
  RouteConfirmationStatus,
} from "@/types";

interface Props {
  order: Order;
  refreshSignal?: number;
  onOrderUpdated?: (order: Order) => void;
  onMessage?: (text: string, type?: "success" | "error") => void;
}

function routeStatusLabel(
  selection: PffRouteSelections["payment"],
  confirmation: RouteConfirmationStatus | null,
): string {
  if (!selection) return "Not set";
  if (selection.status === "confirmed") return "Confirmed";
  if (confirmation) {
    return `${confirmation.progress_percent}% confirmed (${confirmation.confirmed_count}/${confirmation.total_segments})`;
  }
  return selection.status.replace("_", " ");
}

/**
 * Fast-loading route guidance card. Uses only light APIs (selections + pricing)
 * so it appears before the heavy cost-comparison payload.
 */
export function RoutesAnnounceCard({
  order,
  refreshSignal = 0,
  onOrderUpdated,
  onMessage,
}: Props) {
  const { user } = useAuth();
  const isPff = isPffPaymentMethod(order.payment_method);
  const isReceiver = user?.role === "receiver" || user?.role === "admin";

  const [selections, setSelections] = useState<PffRouteSelections | null>(null);
  const [paymentConfirmation, setPaymentConfirmation] =
    useState<RouteConfirmationStatus | null>(null);
  const [goodsConfirmation, setGoodsConfirmation] =
    useState<RouteConfirmationStatus | null>(null);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(null);
  const [pickupUpdating, setPickupUpdating] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const loadLight = useCallback(async () => {
    try {
      const pricing = await getPricingConfig().catch(() => null);
      setPricingConfig(pricing);

      if (!isPff) {
        setSelections(null);
        setPaymentConfirmation(null);
        setGoodsConfirmation(null);
        return;
      }

      const next = await getRouteSelections(order.id);
      setSelections(next);

      const [payConf, goodsConf] = await Promise.all([
        next.payment
          ? getRouteConfirmationStatus(next.payment.selected_route_id).catch(
              () => null,
            )
          : Promise.resolve(null),
        next.goods
          ? getRouteConfirmationStatus(next.goods.selected_route_id).catch(
              () => null,
            )
          : Promise.resolve(null),
      ]);
      setPaymentConfirmation(payConf);
      setGoodsConfirmation(goodsConf);
    } catch {
      // Keep static copy visible even if light APIs fail.
    }
  }, [isPff, order.id]);

  useEffect(() => {
    void loadLight();
  }, [loadLight]);

  useEffect(() => {
    if (refreshSignal === 0) return;
    void loadLight();
  }, [refreshSignal, loadLight]);

  async function handlePffPickupAvailable() {
    setPickupUpdating(true);
    try {
      const updated = await updateOrderTrackingStatus(order.id, "PICKUP_AVAILABLE");
      onOrderUpdated?.({
        ...order,
        tracking_status: updated.tracking_status,
        pickup_ready_at: updated.pickup_ready_at,
      });
      onMessageRef.current?.("Pickup available sent to transporters.");
      await loadLight();
    } catch (err) {
      onMessageRef.current?.(
        err instanceof Error ? err.message : "Failed to mark pickup available",
        "error",
      );
    } finally {
      setPickupUpdating(false);
    }
  }

  const payment = selections?.payment ?? null;
  const goods = selections?.goods ?? null;
  const bothConfirmed = selections?.both_confirmed ?? false;
  const needsBothRoutes = isPff && (!payment || !goods);
  const bookingFeeRate = pricingConfig?.booking_fee_rate ?? 0.02;
  const canPickup =
    bothConfirmed &&
    !order.pickup_ready_at &&
    isReceiver &&
    (order.tracking_status === "ROUTES_READY" ||
      order.tracking_status === "CONFIRMED" ||
      !order.tracking_status);

  return (
    <Card className="border-violet-500/25 bg-violet-500/[0.03]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {isPff ? "Advanced Payment (PFF) — dual routes" : "Route selection"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {isPff
            ? PFF_DUAL_ROUTE_INTRO
            : "Compare estimated costs, pick a route, then transporters are notified."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {isPff && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div
              className={cn(
                "rounded-lg border px-3 py-2.5 space-y-1",
                payment?.status === "confirmed"
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-border bg-background",
              )}
            >
              <p className="text-sm font-medium">{PFF_PAYMENT_ROUTE_TITLE}</p>
              <p className="text-xs text-muted-foreground">
                {PFF_PAYMENT_ROUTE_DIRECTION}
              </p>
              <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
                {routeStatusLabel(payment, paymentConfirmation)}
              </p>
            </div>
            <div
              className={cn(
                "rounded-lg border px-3 py-2.5 space-y-1",
                goods?.status === "confirmed"
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-border bg-background",
              )}
            >
              <p className="text-sm font-medium">{PFF_GOODS_ROUTE_TITLE}</p>
              <p className="text-xs text-muted-foreground">
                {PFF_GOODS_ROUTE_DIRECTION}
              </p>
              <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
                {routeStatusLabel(goods, goodsConfirmation)}
              </p>
            </div>
          </div>
        )}

        {needsBothRoutes && (
          <p className="text-xs text-violet-800 dark:text-violet-200 rounded-lg border border-violet-500/20 bg-background/80 px-3 py-2">
            {PFF_PENDING_BOTH_ROUTES_NOTE}
          </p>
        )}

        {bothConfirmed && !order.pickup_ready_at && isReceiver && (
          <div className="rounded-lg border border-violet-500/40 bg-background px-3 py-2.5 space-y-2">
            <p className="text-sm font-medium">Both routes confirmed</p>
            <p className="text-xs text-muted-foreground">
              Notify transporters when the payment package is ready for pickup.
            </p>
            {canPickup && (
              <Button
                type="button"
                size="sm"
                disabled={pickupUpdating}
                onClick={() => void handlePffPickupAvailable()}
              >
                {pickupUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Send pickup available"
                )}
              </Button>
            )}
          </div>
        )}

        {order.pickup_ready_at && (
          <p className="text-xs text-green-700 dark:text-green-300 flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" />
            Pickup available sent. Payment leg runs first; goods follow after.
          </p>
        )}

        <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 space-y-1.5 text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Booking fee:</span>{" "}
            {formatBookingFeePercent(bookingFeeRate)} on each segment sub-total
          </p>
          {isPff && <p>{PFF_AIR_SEA_RULE_NOTE}</p>}
        </div>

        <Link
          href={`/orders/${order.id}/tracking`}
          className="inline-flex text-xs text-primary hover:underline"
        >
          View full tracking map →
        </Link>
      </CardContent>
    </Card>
  );
}
