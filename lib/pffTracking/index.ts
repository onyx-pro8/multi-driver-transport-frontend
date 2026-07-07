import type {
  PffRouteSelections,
  RouteConfirmationStatus,
  RouteCostSummary,
  SegmentConfirmationDetail,
} from "@/types";

/** Merge payment + goods confirmation segments for unified PFF tracking views. */
export function mergePffTrackingSegments(
  payment: RouteConfirmationStatus | null,
  goods: RouteConfirmationStatus | null,
): SegmentConfirmationDetail[] {
  const paymentSegs = (payment?.segments ?? []).map((s) => ({
    ...s,
    leg_phase: s.leg_phase ?? ("payment" as const),
  }));
  const goodsSegs = (goods?.segments ?? []).map((s) => ({
    ...s,
    leg_phase: s.leg_phase ?? ("goods" as const),
  }));
  return [...paymentSegs, ...goodsSegs];
}

export function isPffTrackingRouteConfirmed(
  isPff: boolean,
  selections: PffRouteSelections | null,
  fallbackConfirmed: boolean,
): boolean {
  if (!isPff) return fallbackConfirmed;
  return selections?.both_confirmed ?? false;
}

export function findRouteCostById(
  routes: RouteCostSummary[] | undefined,
  routeId: number | null | undefined,
): RouteCostSummary | null {
  if (routeId == null || !routes?.length) return null;
  return routes.find((r) => r.route_id === routeId) ?? null;
}

export function zoneIdsFromRouteCost(route: RouteCostSummary | null): number[] {
  if (!route) return [];
  return route.segments
    .map((s) => s.zone_id)
    .filter((id): id is number => id != null);
}

export function routeSummaryUsesAirOrSea(route: RouteCostSummary): boolean {
  return route.segments.some(
    (s) => s.transport_method === "air" || s.transport_method === "sea",
  );
}

export const PFF_AIR_SEA_RULE_NOTE =
  "Land zones work both ways, but air and sea legs are one-directional (departure → arrival). The payment route (receiver → sender) and delivery route (sender → receiver) each use air/sea legs only when a route actually runs in that direction.";

export const PFF_PAYMENT_ROUTE_TITLE = "Payment route (receiver sets)";

export const PFF_GOODS_ROUTE_TITLE = "Delivery route (sender sets)";

export const PFF_PAYMENT_ROUTE_DIRECTION = "Receiver → sender";

export const PFF_GOODS_ROUTE_DIRECTION = "Sender → receiver";

export const PFF_DUAL_ROUTE_INTRO =
  "The receiver sets how payment moves (receiver → sender). The sender sets how goods are delivered (sender → receiver). On the payment route the order receiver sends payment and the order sender receives it.";
