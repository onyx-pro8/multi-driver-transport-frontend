"use client";

import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PFF_DUAL_ROUTE_INTRO,
  PFF_GOODS_ROUTE_DIRECTION,
  PFF_GOODS_ROUTE_TITLE,
  PFF_PAYMENT_ROUTE_DIRECTION,
  PFF_PAYMENT_ROUTE_TITLE,
} from "@/lib/pffTracking";
import { isPffPaymentMethod } from "@/lib/paymentFlow";
import type { Order, PffRouteSelections, RouteConfirmationStatus } from "@/types";

interface Props {
  order: Order;
  selections: PffRouteSelections | null;
  paymentConfirmation: RouteConfirmationStatus | null;
  goodsConfirmation: RouteConfirmationStatus | null;
  onMarkPickupAvailable?: () => void;
  pickupUpdating?: boolean;
  className?: string;
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

export function PffOrderStepper({
  order,
  selections,
  paymentConfirmation,
  goodsConfirmation,
  onMarkPickupAvailable,
  pickupUpdating = false,
  className,
}: Props) {
  if (!isPffPaymentMethod(order.payment_method)) return null;

  const payment = selections?.payment ?? null;
  const goods = selections?.goods ?? null;
  const bothConfirmed = selections?.both_confirmed ?? false;
  const canPickup =
    bothConfirmed &&
    !order.pickup_ready_at &&
    (order.tracking_status === "ROUTES_READY" ||
      order.tracking_status === "CONFIRMED" ||
      !order.tracking_status);

  return (
    <div
      className={cn(
        "rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-4",
        className
      )}
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">
          Advanced Payment (PFF) — dual routes
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {PFF_DUAL_ROUTE_INTRO} Either party can pick their route first. Delivery
          starts after both are confirmed.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div
          className={cn(
            "rounded-lg border px-3 py-2.5 space-y-1",
            payment?.status === "confirmed"
              ? "border-green-500/30 bg-green-500/5"
              : "border-violet-500/30 bg-background"
          )}
        >
          <p className="text-sm font-medium">{PFF_PAYMENT_ROUTE_TITLE}</p>
          <p className="text-xs text-muted-foreground">{PFF_PAYMENT_ROUTE_DIRECTION}</p>
          <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
            {routeStatusLabel(payment, paymentConfirmation)}
          </p>
        </div>
        <div
          className={cn(
            "rounded-lg border px-3 py-2.5 space-y-1",
            goods?.status === "confirmed"
              ? "border-green-500/30 bg-green-500/5"
              : "border-violet-500/30 bg-background"
          )}
        >
          <p className="text-sm font-medium">{PFF_GOODS_ROUTE_TITLE}</p>
          <p className="text-xs text-muted-foreground">{PFF_GOODS_ROUTE_DIRECTION}</p>
          <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
            {routeStatusLabel(goods, goodsConfirmation)}
          </p>
        </div>
      </div>

      {bothConfirmed && !order.pickup_ready_at && onMarkPickupAvailable && (
        <div className="rounded-lg border border-violet-500/50 bg-background px-3 py-2.5 space-y-2">
          <p className="text-sm font-medium">Both routes confirmed</p>
          <p className="text-xs text-muted-foreground">
            Receiver: notify transporters when the payment package is ready for pickup.
          </p>
          {canPickup && (
            <Button
              type="button"
              size="sm"
              disabled={pickupUpdating}
              onClick={onMarkPickupAvailable}
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
          Pickup available sent. Payment leg runs on the payment route; goods follow after
          payment is delivered.
        </p>
      )}

      <Link href={`/orders/${order.id}/tracking`} className="text-xs text-primary hover:underline">
        View full tracking map →
      </Link>
    </div>
  );
}
