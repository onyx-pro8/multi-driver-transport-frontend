import type { PffLegPhase, SegmentLegStatus, TransporterConfirmationItem } from "@/types";
import { isPffPaymentMethod } from "@/lib/paymentFlow";

export function isRouteConfirmed(
  routeSelectionStatus: string | null | undefined
): boolean {
  return routeSelectionStatus === "confirmed";
}

export function canMarkPickReady(order: {
  route_selection_status?: string | null;
  pickup_ready_at?: string | null;
  tracking_status?: string;
  payment_method?: string;
}): boolean {
  if (isPffPaymentMethod(order.payment_method)) return false;
  return (
    order.tracking_status !== "AWAITING_CONNECT" &&
    isRouteConfirmed(order.route_selection_status) &&
    !order.pickup_ready_at &&
    (order.tracking_status === "CONFIRMED" || !order.tracking_status)
  );
}

/** PFF orders: receiver marks payment pickup available after route confirmation. */
export function canReceiverMarkPickReadyForPff(order: {
  route_selection_status?: string | null;
  pickup_ready_at?: string | null;
  tracking_status?: string;
  payment_method?: string;
}): boolean {
  if (!isPffPaymentMethod(order.payment_method)) return false;
  return (
    order.tracking_status !== "AWAITING_CONNECT" &&
    isRouteConfirmed(order.route_selection_status) &&
    !order.pickup_ready_at &&
    (order.tracking_status === "CONFIRMED" || !order.tracking_status)
  );
}

/** PFF orders: sender marks goods ready after payment is delivered to producer. */
export function canSenderMarkGoodsReadyForPff(order: {
  route_selection_status?: string | null;
  goods_ready_at?: string | null;
  tracking_status?: string;
  payment_method?: string;
}): boolean {
  if (!isPffPaymentMethod(order.payment_method)) return false;
  return (
    isRouteConfirmed(order.route_selection_status) &&
    !order.goods_ready_at &&
    order.tracking_status === "PAYMENT_DELIVERED"
  );
}

export function canMarkDelivered(order: {
  route_selection_status?: string | null;
  tracking_status: string;
  pickup_ready_at?: string | null;
  goods_ready_at?: string | null;
  payment_method?: string;
}): boolean {
  const isPff = isPffPaymentMethod(order.payment_method);
  return (
    isRouteConfirmed(order.route_selection_status) &&
    Boolean(order.pickup_ready_at) &&
    (!isPff || Boolean(order.goods_ready_at)) &&
    order.tracking_status === "IN_TRANSIT"
  );
}

export const SEGMENT_LEG_LABELS: Record<SegmentLegStatus, string> = {
  not_started: "Not started",
  picked_up: "Picked up",
  in_transit: "In transit",
};

function paymentLegCount(item: TransporterConfirmationItem): number {
  if (!isPffPaymentMethod(item.payment_method)) return 0;
  return Math.floor(item.route_segment_count / 2);
}

function isPhaseFirstSegment(item: TransporterConfirmationItem): boolean {
  const phase = item.leg_phase;
  if (phase === "payment") return item.segment_index === 0;
  if (phase === "goods") {
    const payCount = paymentLegCount(item);
    return payCount > 0 && item.segment_index === payCount;
  }
  return item.segment_index === 0;
}

function pickupGateOpen(item: TransporterConfirmationItem): boolean {
  if (!item.pickup_ready_at) return false;
  if (item.leg_phase === "payment") return true;
  if (item.leg_phase === "goods") return Boolean(item.goods_ready_at);
  return true;
}

/** First segment of each leg — payment leg picks up at receiver, goods leg at sender. */
export function canSegmentMarkPickedUp(item: TransporterConfirmationItem): boolean {
  if (!isRouteConfirmed(item.route_selection_status)) return false;
  if (!pickupGateOpen(item)) return false;
  if (item.status !== "accepted") return false;
  if (!isPhaseFirstSegment(item)) return false;
  return item.leg_status === "not_started";
}

export function canSegmentMarkInTransit(item: TransporterConfirmationItem): boolean {
  if (!isRouteConfirmed(item.route_selection_status)) return false;
  if (!pickupGateOpen(item)) return false;
  if (item.status !== "accepted") return false;
  if (isPhaseFirstSegment(item)) return false;
  if (item.leg_status !== "not_started") return false;

  const prev = item.previous_leg_status;
  const phase = item.leg_phase;
  const payCount = paymentLegCount(item);
  const isSecondInPhase =
    phase === "payment"
      ? item.segment_index === 1
      : phase === "goods"
        ? item.segment_index === payCount + 1
        : item.segment_index === 1;

  if (isSecondInPhase) {
    return prev === "picked_up";
  }
  return prev === "in_transit";
}

/** Why a transporter segment has no pickup / transit action yet. */
export function segmentActionBlockedReason(item: TransporterConfirmationItem): string | null {
  if (item.status !== "accepted" || item.route_selection_status !== "confirmed") return null;
  if (canSegmentMarkPickedUp(item) || canSegmentMarkInTransit(item)) return null;

  if (item.leg_phase === "goods" && isPhaseFirstSegment(item) && item.leg_status === "not_started") {
    if (!item.goods_ready_at) {
      return "Payment delivered — waiting for the producer to mark goods ready.";
    }
    if (!item.pickup_ready_at) {
      return "Waiting for the receiver to mark payment pickup available.";
    }
  }

  if (item.leg_phase === "payment" && item.leg_status === "not_started" && !item.pickup_ready_at) {
    return "Waiting for the receiver to mark payment pickup available.";
  }

  if (item.leg_status !== "not_started") return null;

  if (!isPhaseFirstSegment(item)) {
    const prev = item.previous_leg_status;
    if (prev === "not_started") {
      return "Complete the previous segment on this leg first.";
    }
    if (prev === "picked_up") {
      return "The previous segment must be marked in transit first.";
    }
  }

  return null;
}

export function pffLegPhaseLabel(phase: PffLegPhase | null | undefined): string {
  if (phase === "payment") return "Payment leg";
  if (phase === "goods") return "Goods leg";
  return "Delivery";
}

export function pffHandoffRoleLabel(
  role: import("@/types").PffHandoffRole | null | undefined,
): string | null {
  if (role === "payment_delivery") {
    return "Producer handoff — deliver payment, then collect goods on the return leg";
  }
  if (role === "goods_pickup") {
    return "Producer handoff — same transporter collects goods after payment delivery";
  }
  return null;
}

/** PFF: receiver notifies producer after transporter collects payment at receiver. */
export function canReceiverNotifyPaymentPickedUp(order: {
  payment_method?: string;
  pickup_ready_at?: string | null;
  payment_pickup_notified_at?: string | null;
  tracking_status?: string;
}): boolean {
  if (!isPffPaymentMethod(order.payment_method)) return false;
  if (!order.pickup_ready_at) return false;
  if (order.payment_pickup_notified_at) return false;
  const status = order.tracking_status ?? "";
  return status === "PICKED_UP" || status === "IN_TRANSIT" || status === "PAYMENT_DELIVERED";
}

export const TRACKING_ACTION_LABELS = {
  REJECTED: "Rejected",
  AWAITING_CONNECT: "Awaiting connect",
  CONFIRMED: "Confirmed",
  PICKUP_AVAILABLE: "Pick ready",
  PICKED_UP: "Picked up",
  IN_TRANSIT: "In transit",
  PAYMENT_DELIVERED: "Payment delivered",
  DELIVERED: "Delivered",
} as const;
