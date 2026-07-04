import type { PffLegPhase, SegmentConfirmationDetail, SegmentLegStatus, TrackingStatus } from "@/types";
import { isPffPaymentMethod } from "@/lib/paymentFlow";

export type DeliveryNodePhase = "completed" | "current" | "upcoming";

export interface DeliveryNodeState {
  phase: DeliveryNodePhase;
  label: string;
}

function paymentLegCount(
  segments: Pick<SegmentConfirmationDetail, "leg_phase">[]
): number {
  return segments.filter((s) => s.leg_phase === "payment").length;
}

function sortedSegments(
  segments: Pick<SegmentConfirmationDetail, "segment_index" | "leg_status" | "leg_phase">[]
) {
  return [...segments].sort((a, b) => a.segment_index - b.segment_index);
}

function activePffSegmentIndex(
  segments: Pick<SegmentConfirmationDetail, "segment_index" | "leg_status" | "leg_phase">[],
  goodsReady: boolean
): number | "receiver" | "sender" {
  const payCount = paymentLegCount(segments);
  const paymentSegs = sortedSegments(segments).filter((s) => s.leg_phase === "payment");
  const goodsSegs = sortedSegments(segments).filter((s) => s.leg_phase === "goods");

  for (const seg of paymentSegs) {
    if (seg.leg_status === "not_started") return seg.segment_index;
  }

  if (payCount > 0 && paymentSegs.every((s) => s.leg_status === "in_transit")) {
    if (!goodsReady) return "sender";
    for (const seg of goodsSegs) {
      if (seg.leg_status === "not_started") return seg.segment_index;
    }
    if (goodsSegs.length > 0 && goodsSegs.every((s) => s.leg_status === "in_transit")) {
      return "receiver";
    }
  }

  return paymentSegs[0]?.segment_index ?? 0;
}

/** Which chain node is active: sender, segment index, or receiver. */
export function getActiveDeliveryPosition(
  trackingStatus: TrackingStatus,
  pickupReadyAt: string | null | undefined,
  routeConfirmed: boolean,
  segments: Pick<SegmentConfirmationDetail, "segment_index" | "leg_status" | "leg_phase">[],
  options?: { isPff?: boolean; goodsReadyAt?: string | null }
): "sender" | "receiver" | number {
  if (!routeConfirmed) return "sender";
  const effective = deriveEffectiveTrackingStatus(trackingStatus, pickupReadyAt, segments);
  if (effective === "DELIVERED") return "receiver";

  const isPff = options?.isPff && paymentLegCount(segments) > 0;
  if (isPff) {
    if (!pickupReadyAt || effective === "CONFIRMED") return "receiver";
    if (effective === "PAYMENT_DELIVERED" && !options?.goodsReadyAt) return "sender";
    return activePffSegmentIndex(segments, Boolean(options?.goodsReadyAt));
  }

  if (!pickupReadyAt || effective === "CONFIRMED") return "sender";

  const sorted = sortedSegments(segments);

  for (const seg of sorted) {
    if (seg.segment_index === 0) {
      if (seg.leg_status === "not_started") return 0;
      continue;
    }
    if (seg.leg_status === "not_started") return seg.segment_index;
  }

  if (sorted.length > 0 && sorted.every((s) => s.leg_status === "in_transit")) {
    return "receiver";
  }

  if (effective === "IN_TRANSIT") {
    const next = sorted.find((s) => s.leg_status === "not_started");
    if (next) return next.segment_index;
    return "receiver";
  }

  if (effective === "PICKED_UP") {
    const next = sorted.find((s) => s.segment_index > 0 && s.leg_status === "not_started");
    return next ? next.segment_index : 0;
  }

  return 0;
}

export function getSenderNodeState(
  trackingStatus: TrackingStatus,
  pickupReadyAt: string | null | undefined,
  routeConfirmed: boolean,
  segments: Pick<SegmentConfirmationDetail, "segment_index" | "leg_status" | "leg_phase">[] = [],
  options?: { isPff?: boolean; goodsReadyAt?: string | null }
): DeliveryNodePhase {
  if (!routeConfirmed) return "upcoming";
  const effective = deriveEffectiveTrackingStatus(trackingStatus, pickupReadyAt, segments);
  if (effective === "DELIVERED") return "completed";

  const isPff = options?.isPff && paymentLegCount(segments) > 0;
  if (isPff) {
    if (effective === "PAYMENT_DELIVERED" && !options?.goodsReadyAt) return "current";
    if (options?.goodsReadyAt) return "completed";
    return "upcoming";
  }

  if (!pickupReadyAt || effective === "CONFIRMED") return "current";
  return "completed";
}

export function getReceiverNodeState(
  trackingStatus: TrackingStatus,
  routeConfirmed: boolean,
  segments: Pick<SegmentConfirmationDetail, "leg_status" | "leg_phase">[],
  options?: { isPff?: boolean; pickupReadyAt?: string | null }
): DeliveryNodePhase {
  if (!routeConfirmed) return "upcoming";
  if (trackingStatus === "DELIVERED") return "completed";

  const isPff = options?.isPff && paymentLegCount(segments) > 0;
  if (isPff && !options?.pickupReadyAt) return "upcoming";
  if (isPff && trackingStatus === "CONFIRMED") return "current";

  const allInTransit =
    segments.length > 0 && segments.every((s) => s.leg_status === "in_transit");
  if (trackingStatus === "IN_TRANSIT" && allInTransit) return "current";
  if (isPff && trackingStatus === "PICKUP_AVAILABLE") return "current";
  return "upcoming";
}

export function getSegmentNodeState(
  segment: Pick<SegmentConfirmationDetail, "segment_index" | "leg_status">,
  activePosition: ReturnType<typeof getActiveDeliveryPosition>
): DeliveryNodePhase {
  if (segment.leg_status === "picked_up" || segment.leg_status === "in_transit") {
    return "completed";
  }
  if (activePosition === segment.segment_index) return "current";
  return "upcoming";
}

export const DELIVERY_NODE_COLORS: Record<DeliveryNodePhase, string> = {
  completed: "bg-green-500 border-green-500 shadow-sm shadow-green-500/30",
  current: "bg-primary border-primary ring-4 ring-primary/25 scale-110",
  upcoming: "bg-muted border-border",
};

export const LEG_STATUS_LABELS: Record<SegmentLegStatus, string> = {
  not_started: "Waiting",
  picked_up: "Picked up",
  in_transit: "In transit",
};

const TRACKING_STATUS_RANK: Record<TrackingStatus, number> = {
  AWAITING_CONNECT: -1,
  REJECTED: -2,
  CONFIRMED: 0,
  PICKUP_AVAILABLE: 1,
  PAYMENT_DELIVERED: 2,
  PICKED_UP: 3,
  IN_TRANSIT: 4,
  DELIVERED: 5,
};

function legsComplete(legs: SegmentLegStatus[]): boolean {
  return legs.length > 0 && legs.every((l) => l === "in_transit");
}

/** Derive order-level status from segment legs when legs are ahead of the stored order row. */
export function deriveTrackingStatusFromLegs(
  segments: Pick<SegmentConfirmationDetail, "segment_index" | "leg_status" | "leg_phase">[],
  pickupReady: boolean,
  options?: { isPff?: boolean; goodsReady?: boolean }
): TrackingStatus {
  if (!pickupReady) return "CONFIRMED";

  const isPff = options?.isPff && paymentLegCount(segments) > 0;
  const sorted = sortedSegments(segments);
  const legs = sorted.map((s) => s.leg_status);

  if (isPff) {
    const paymentLegs = sorted.filter((s) => s.leg_phase === "payment").map((s) => s.leg_status);
    const goodsLegs = sorted.filter((s) => s.leg_phase === "goods").map((s) => s.leg_status);

    if (paymentLegs.length > 0 && legsComplete(paymentLegs)) {
      if (!options?.goodsReady) return "PAYMENT_DELIVERED";
      if (goodsLegs.length === 0) return "PAYMENT_DELIVERED";
      if (legsComplete(goodsLegs)) return "IN_TRANSIT";
      const goodsFirstPicked =
        goodsLegs[0] === "picked_up" || goodsLegs[0] === "in_transit";
      const goodsAnyTransit = goodsLegs.some((l) => l === "in_transit");
      if (goodsAnyTransit || legsComplete(goodsLegs)) return "IN_TRANSIT";
      if (goodsFirstPicked) {
        return goodsLegs.length === 1 ? "IN_TRANSIT" : "PICKED_UP";
      }
      return "PICKUP_AVAILABLE";
    }

    const paymentAnyTransit = paymentLegs.some((l) => l === "in_transit");
    const paymentFirstPicked =
      paymentLegs[0] === "picked_up" || paymentLegs[0] === "in_transit";
    if (paymentAnyTransit || legsComplete(paymentLegs)) return "IN_TRANSIT";
    if (paymentFirstPicked) {
      return paymentLegs.length === 1 ? "IN_TRANSIT" : "PICKED_UP";
    }
    return "PICKUP_AVAILABLE";
  }

  if (legs.length === 0) return "PICKUP_AVAILABLE";

  const allInTransit = legs.every((l) => l === "in_transit");
  const anyInTransit = legs.some((l) => l === "in_transit");
  const firstPickedUp = legs[0] === "picked_up" || legs[0] === "in_transit";

  if (allInTransit || anyInTransit) return "IN_TRANSIT";
  if (firstPickedUp) return legs.length === 1 ? "IN_TRANSIT" : "PICKED_UP";
  return "PICKUP_AVAILABLE";
}

export function deriveEffectiveTrackingStatus(
  trackingStatus: TrackingStatus,
  pickupReadyAt: string | null | undefined,
  segments?: Pick<SegmentConfirmationDetail, "segment_index" | "leg_status" | "leg_phase">[],
  options?: { isPff?: boolean; goodsReady?: boolean }
): TrackingStatus {
  if (trackingStatus === "AWAITING_CONNECT") return "AWAITING_CONNECT";
  if (trackingStatus === "DELIVERED") return "DELIVERED";

  const fromLegs = deriveTrackingStatusFromLegs(segments ?? [], Boolean(pickupReadyAt), options);
  return TRACKING_STATUS_RANK[fromLegs] > TRACKING_STATUS_RANK[trackingStatus]
    ? fromLegs
    : trackingStatus;
}

export function pffPhaseLabel(phase: PffLegPhase | null | undefined): string {
  if (phase === "payment") return "Payment";
  if (phase === "goods") return "Goods";
  return "";
}
