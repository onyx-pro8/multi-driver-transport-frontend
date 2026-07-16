"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  DollarSign,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  applyManualSegmentCost,
  fetchExternalSegmentQuote,
  getOrderRouteCostComparison,
  getPricingConfig,
  getRouteConfirmationStatus,
  getRouteSelections,
  getSelectedRoute,
  recalculateOrderCosts,
  requestSegmentQuote,
  selectRoute,
} from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import { formatBookingFeePercent } from "@/lib/pricing";
import { segmentPricingHint } from "@/lib/zonePricing";
import type {
  Order,
  OrderRouteCostComparison,
  PricingConfig,
  RouteConfirmationStatus,
  RouteCostStatus,
  RouteCostSummary,
  RouteSegmentCost,
  RouteSelection,
  PffRouteSelections,
  SegmentCostStatus,
} from "@/types";
import { RouteStatusBadge } from "@/components/orders/RouteStatusBadge";
import { RouteConfirmationStatusPanel } from "@/components/orders/ConfirmationPanel";
import { ScheduleInactiveNotice } from "@/components/orders/ScheduleInactiveNotice";
import { GapBridgeCandidates } from "@/components/orders/GapBridgeCandidates";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import {
  PFF_GOODS_ROUTE_DIRECTION,
  PFF_GOODS_ROUTE_TITLE,
  PFF_PAYMENT_ROUTE_DIRECTION,
  PFF_PAYMENT_ROUTE_TITLE,
} from "@/lib/pffTracking";
import { isPffPaymentMethod } from "@/lib/paymentFlow";

const STATUS_BADGE: Record<RouteCostStatus, string> = {
  complete:
    "bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20",
  partial:
    "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20",
  missing:
    "bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20",
};

const SEGMENT_STATUS: Record<SegmentCostStatus, string> = {
  calculated: "Calculated",
  manual: "Manual Cost",
  missing: "Missing Cost",
  requested: "Cost Requested",
};

type RouteSortKey = "cost_asc" | "cost_desc" | "segments_asc" | "segments_desc";

function sortRoutes(routes: RouteCostSummary[], sortKey: RouteSortKey): RouteCostSummary[] {
  const list = [...routes];
  list.sort((a, b) => {
    if (sortKey === "cost_asc" || sortKey === "cost_desc") {
      const aCost = a.total_final_cost;
      const bCost = b.total_final_cost;
      if (aCost == null && bCost == null) return a.route_label.localeCompare(b.route_label);
      if (aCost == null) return 1;
      if (bCost == null) return -1;
      const diff = aCost - bCost;
      return sortKey === "cost_asc" ? diff : -diff;
    }
    const diff = a.segment_count - b.segment_count;
    if (diff !== 0) return sortKey === "segments_asc" ? diff : -diff;
    return a.route_label.localeCompare(b.route_label);
  });
  return list;
}

function zoneIdsEqual(a: number[] | null | undefined, b: number[] | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((id, i) => id === b[i]);
}

interface Props {
  orderId: number;
  order?: Order | null;
  onOrderUpdated?: (order: Order) => void;
  /** Bump to trigger a silent in-place refresh (e.g. after package edit). */
  refreshSignal?: number;
  onMessage?: (text: string, type?: "success" | "error") => void;
  /** Notify parent so the map can trace this route's zone chain. */
  onHighlightRoute?: (
    zoneIds: number[] | null,
    purpose?: "payment" | "goods" | null,
  ) => void;
  /** Currently highlighted zone chain (from parent / map sync). */
  highlightedZoneIds?: number[] | null;
  /**
   * When set, announcements render above this slot and the route list sits
   * directly under it (map + routes stay close on the Routes page).
   */
  mapSlot?: ReactNode;
  /** PFF: payment map placed directly above the payment routes list. */
  paymentMapSlot?: ReactNode;
  /** PFF: goods map placed directly above the goods routes list. */
  goodsMapSlot?: ReactNode;
  /** Fired after a route is selected so the announce card can refresh quickly. */
  onRouteSelectionChanged?: () => void;
}

export function RouteCostComparison({
  orderId,
  order = null,
  onOrderUpdated,
  refreshSignal = 0,
  onMessage,
  onHighlightRoute,
  highlightedZoneIds = null,
  mapSlot,
  paymentMapSlot,
  goodsMapSlot,
  onRouteSelectionChanged,
}: Props) {
  const { user } = useAuth();
  const isPff = isPffPaymentMethod(order?.payment_method);
  const canEnterManual = user?.role === "admin" || user?.role === "driver";
  const isDriver = user?.role === "driver";
  const isReceiver = user?.role === "receiver" || user?.role === "admin";
  const canRequestQuote =
    user?.role === "admin" ||
    user?.role === "sender" ||
    user?.role === "receiver";
  const canRecalculate =
    user?.role === "admin" ||
    user?.role === "sender" ||
    user?.role === "receiver";
  const isSender = user?.role === "sender" || user?.role === "admin";
  const canSelectPaymentRoute = user?.role === "admin" || (isPff && isReceiver);
  const canSelectGoodsRoute = user?.role === "admin" || (isPff && isSender);
  // Role-based visibility: the receiver owns the payment route, the sender owns
  // the goods route. Admins and drivers (who may have segments on either) see
  // both.
  const showPaymentRoute = isReceiver || isDriver;
  const showGoodsRoute = isSender || isDriver;
  const canSelectRoute =
    user?.role === "admin" ||
    (!isPff && user?.role === "receiver");
  const [scheduleInput, setScheduleInput] = useState("");
  const [data, setData] = useState<OrderRouteCostComparison | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteSelection | null>(null);
  const [routeSelections, setRouteSelections] = useState<PffRouteSelections | null>(null);
  const [confirmation, setConfirmation] =
    useState<RouteConfirmationStatus | null>(null);
  const [paymentConfirmation, setPaymentConfirmation] =
    useState<RouteConfirmationStatus | null>(null);
  const [goodsConfirmation, setGoodsConfirmation] =
    useState<RouteConfirmationStatus | null>(null);
  const [selectingRouteId, setSelectingRouteId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasDataRef = useRef(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const [recalculating, setRecalculating] = useState(false);
  const [breakdownRouteId, setBreakdownRouteId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<RouteSortKey>("cost_asc");
  const [manualInputs, setManualInputs] = useState<Record<number, string>>({});
  const [savingSegment, setSavingSegment] = useState<number | null>(null);
  // const [savingExternal, setSavingExternal] = useState<number | null>(null);
  const [requestingQuote, setRequestingQuote] = useState<number | null>(null);
  const [fetchingExternal, setFetchingExternal] = useState<number | null>(null);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(
    null,
  );

  const highlightRoute = useCallback(
    (route: RouteCostSummary, purpose?: "payment" | "goods" | null) => {
      const ids = route.zone_ids ?? null;
      const purposeHint = purpose ?? route.route_purpose ?? null;
      if (!ids || ids.length === 0) {
        onHighlightRoute?.(null, null);
        return;
      }
      if (zoneIdsEqual(ids, highlightedZoneIds)) {
        onHighlightRoute?.(null, null);
      } else {
        onHighlightRoute?.(ids, purposeHint);
      }
    },
    [highlightedZoneIds, onHighlightRoute],
  );

  const load = useCallback(
    async (silent = false) => {
      const isFirst = !hasDataRef.current;
      if (!silent && isFirst) {
        setLoading(true);
      } else if (silent && hasDataRef.current) {
        setRefreshing(true);
      }

      try {
        const comparison = await getOrderRouteCostComparison(orderId);
        setData(comparison);
        hasDataRef.current = true;
        if (comparison.is_route_complete !== false) {
          try {
            if (comparison.is_pff_order) {
              const selections = await getRouteSelections(orderId);
              setRouteSelections(selections);
              setSelectedRoute(selections.payment ?? selections.goods);
              if (selections.payment) {
                try {
                  const payConf = await getRouteConfirmationStatus(
                    selections.payment.selected_route_id,
                  );
                  setPaymentConfirmation(payConf);
                } catch {
                  setPaymentConfirmation(null);
                }
              } else {
                setPaymentConfirmation(null);
              }
              if (selections.goods) {
                try {
                  const goodsConf = await getRouteConfirmationStatus(
                    selections.goods.selected_route_id,
                  );
                  setGoodsConfirmation(goodsConf);
                } catch {
                  setGoodsConfirmation(null);
                }
              } else {
                setGoodsConfirmation(null);
              }
              setConfirmation(null);
            } else {
              const selection = await getSelectedRoute(orderId);
              setSelectedRoute(selection);
              setRouteSelections(null);
              const status = await getRouteConfirmationStatus(
                selection.selected_route_id,
              );
              setConfirmation(status);
              setPaymentConfirmation(null);
              setGoodsConfirmation(null);
            }
          } catch {
            setSelectedRoute(null);
            setRouteSelections(null);
            setConfirmation(null);
            setPaymentConfirmation(null);
            setGoodsConfirmation(null);
          }
        } else {
          setSelectedRoute(null);
          setRouteSelections(null);
          setConfirmation(null);
          setPaymentConfirmation(null);
          setGoodsConfirmation(null);
        }
      } catch (err) {
        if (!hasDataRef.current) {
          onMessageRef.current?.(
            err instanceof Error ? err.message : "Failed to load route costs",
            "error",
          );
          setData(null);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId],
  );

  async function handleSelectRoute(routeId: number) {
    setSelectingRouteId(routeId);
    try {
      await selectRoute(orderId, routeId);
      await load(true);
      onRouteSelectionChanged?.();
      if (isPff) {
        const selections = await getRouteSelections(orderId);
        if (selections.payment && selections.goods) {
          onMessage?.("Both routes selected. Confirmation requests sent to transporters.");
        } else {
          onMessage?.("Route saved. Select the other route before transporters are notified.");
        }
      } else {
        onMessage?.("Route selected. Confirmation requests sent to transporters.");
      }
    } catch (err) {
      onMessage?.(
        err instanceof Error ? err.message : "Failed to select route",
        "error",
      );
    } finally {
      setSelectingRouteId(null);
    }
  }

  useEffect(() => {
    hasDataRef.current = false;
    void load(false);
  }, [orderId, load]);

  useEffect(() => {
    if (refreshSignal === 0 || !hasDataRef.current) return;
    void load(true);
  }, [refreshSignal, orderId, load]);

  useEffect(() => {
    getPricingConfig()
      .then(setPricingConfig)
      .catch(() => setPricingConfig(null));
  }, []);

  useEffect(() => {
    if (!order?.route_schedule_at) {
      setScheduleInput("");
      return;
    }
    const d = new Date(order.route_schedule_at);
    if (Number.isNaN(d.getTime())) {
      setScheduleInput("");
      return;
    }
    const pad = (n: number) => String(n).padStart(2, "0");
    setScheduleInput(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  }, [order?.id, order?.route_schedule_at]);

  async function handleRecalculate() {
    setRecalculating(true);
    try {
      const scheduleAt = scheduleInput.trim()
        ? new Date(scheduleInput).toISOString()
        : null;
      const comparison = await recalculateOrderCosts(orderId, scheduleAt);
      setData(comparison);
      if (order && onOrderUpdated) {
        onOrderUpdated({
          ...order,
          route_schedule_at: comparison.route_schedule_at ?? scheduleAt,
        });
      }
      onMessage?.(
        comparison.is_route_complete === false
          ? "No complete route at this time — costs were not calculated."
          : "Route costs recalculated.",
      );
    } catch (err) {
      onMessage?.(
        err instanceof Error ? err.message : "Recalculation failed",
        "error",
      );
    } finally {
      setRecalculating(false);
    }
  }

  async function handleManualSave(segment: RouteSegmentCost) {
    const raw = manualInputs[segment.segment_id] ?? "";
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      onMessage?.("Enter a valid cost >= 0", "error");
      return;
    }
    setSavingSegment(segment.segment_id);
    try {
      await applyManualSegmentCost(segment.segment_id, value);
      await load(true);
      onMessage?.("Manual cost saved.");
    } catch (err) {
      onMessage?.(
        err instanceof Error ? err.message : "Failed to save manual cost",
        "error",
      );
    } finally {
      setSavingSegment(null);
    }
  }

  async function handleRequestQuote(segment: RouteSegmentCost) {
    setRequestingQuote(segment.segment_id);
    try {
      await requestSegmentQuote(segment.segment_id);
      await load(true);
      onMessage?.("Quote requested for this segment.");
    } catch (err) {
      onMessage?.(
        err instanceof Error ? err.message : "Failed to request quote",
        "error",
      );
    } finally {
      setRequestingQuote(null);
    }
  }

  async function handleFetchExternal(segment: RouteSegmentCost) {
    setFetchingExternal(segment.segment_id);
    try {
      await fetchExternalSegmentQuote(segment.segment_id);
      await load(true);
      onMessage?.("External quote fetched and applied.");
    } catch (err) {
      onMessage?.(
        err instanceof Error ? err.message : "Failed to fetch external quote",
        "error",
      );
    } finally {
      setFetchingExternal(null);
    }
  }

  const routeIncomplete = data?.is_route_complete === false && !data?.route_locked;

  const pffBothRoutesChosen =
    Boolean(routeSelections?.payment?.selected_route_id) &&
    Boolean(routeSelections?.goods?.selected_route_id);
  const pffTransporterReviewActive =
    isPff &&
    pffBothRoutesChosen &&
    Boolean(data?.route_locked) &&
    data?.route_lock_reason === "confirmation_pending";
  const pffCanChangeSelection = !pffTransporterReviewActive && !data?.route_locked;

  function renderRouteSection({
    title,
    routes,
    selection,
    emptyMessage,
    canSelect,
    selectLabel,
    showReviewBadge = true,
    purpose = null,
  }: {
    title: string;
    routes: RouteCostSummary[];
    selection: RouteSelection | null;
    emptyMessage: string;
    canSelect: boolean;
    selectLabel: string;
    showReviewBadge?: boolean;
    purpose?: "payment" | "goods" | null;
  }) {
    const sorted = sortRoutes(routes, sortKey);
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">{title}</p>
          {routes.length > 1 && (
            <div className="flex items-center gap-2">
              <Label htmlFor={`route-sort-${title}`} className="text-xs text-muted-foreground whitespace-nowrap">
                Sort by
              </Label>
              <Select
                id={`route-sort-${title}`}
                className="h-8 w-[11.5rem] text-xs"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as RouteSortKey)}
              >
                <option value="cost_asc">Cost (low → high)</option>
                <option value="cost_desc">Cost (high → low)</option>
                <option value="segments_asc">Segments (few → many)</option>
                <option value="segments_desc">Segments (many → few)</option>
              </Select>
            </div>
          )}
        </div>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">{emptyMessage}</p>
        ) : (
          sorted.map((route) => (
            <RouteCard
              key={route.route_id}
              route={route}
              isSelected={selection?.selected_route_id === route.route_id}
              isHighlighted={zoneIdsEqual(route.zone_ids, highlightedZoneIds)}
              selectionStatus={
                selection?.selected_route_id === route.route_id && showReviewBadge
                  ? selection.status
                  : null
              }
              canSelectRoute={
                canSelect && !route.pff_selection_blocked
              }
              selectionBlockedReason={route.pff_selection_blocked_reason}
              selecting={selectingRouteId === route.route_id}
              onSelectRoute={() => handleSelectRoute(route.route_id)}
              selectRouteLabel={selectLabel}
              onHighlight={() => highlightRoute(route, purpose)}
              onShowBreakdown={() => {
                onHighlightRoute?.(route.zone_ids ?? null, purpose);
                setBreakdownRouteId(route.route_id);
              }}
              userId={user?.id}
              userRole={user?.role}
            />
          ))
        )}
      </div>
    );
  }

  const useSplitPffMaps =
    isPff && (paymentMapSlot != null || goodsMapSlot != null);

  if (loading) {
    return (
      <div className="space-y-2">
        {useSplitPffMaps ? (
          <>
            {paymentMapSlot}
            {goodsMapSlot}
          </>
        ) : (
          mapSlot
        )}
        <Card>
          <CardContent className="py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading route cost comparison…
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusNotices = (
    <>
      {(data?.schedule_inactive_zones?.length ?? 0) > 0 && (
        <ScheduleInactiveNotice zones={data?.schedule_inactive_zones ?? []} />
      )}
      {data?.route_locked && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          {data.route_lock_reason === "confirmation_pending"
            ? isPff
              ? "Transporters are reviewing both routes. Routes and costs stay fixed until they respond or delivery begins."
              : "Transporters are reviewing this route. Routes and costs stay fixed until they respond or delivery begins."
            : "Showing the confirmed route snapshot for this order. Routes are not recomputed while delivery is in progress or complete, even if zones or schedules have changed."}
        </div>
      )}
      {data?.is_route_complete === false && !data.route_locked && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 space-y-3 text-sm text-amber-950 dark:text-amber-100">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">Route incomplete — costs not calculated</p>
              <p className="text-xs opacity-90">
                There is no full pickup-to-drop-off path at the selected time. Fix the gap
                below or choose a different route time, then recalculate.
              </p>
            </div>
          </div>
          {data.gap ? <GapBridgeCandidates gap={data.gap} /> : null}
        </div>
      )}
    </>
  );

  const routeTimeControl =
    data && !data.route_locked && canRecalculate ? (
      <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
        <Label className="text-xs">Route time (operating hours)</Label>
        <Input
          type="datetime-local"
          className="max-w-xs text-sm"
          value={scheduleInput}
          onChange={(e) => setScheduleInput(e.target.value)}
        />
        <p className="text-[11px] text-muted-foreground">
          Routes use transporters active at this time. Leave empty for now, then
          recalculate.
        </p>
      </div>
    ) : null;

  const paymentSection = showPaymentRoute && data ? (
    <>
      {renderRouteSection({
        title: `${PFF_PAYMENT_ROUTE_TITLE} · ${PFF_PAYMENT_ROUTE_DIRECTION}`,
        routes: data.payment_routes ?? [],
        selection: routeSelections?.payment ?? null,
        emptyMessage:
          data.is_payment_route_complete === false
            ? "No complete payment path at the selected time."
            : "No payment routes found. Recalculate after zones are connected.",
        canSelect: canSelectPaymentRoute && pffCanChangeSelection,
        selectLabel: "Select payment route",
        showReviewBadge: Boolean(paymentConfirmation?.transporters_notified),
        purpose: "payment",
      })}
      {paymentConfirmation?.transporters_notified &&
        routeSelections?.payment &&
        !isDriver && (
          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-sm font-medium">Payment route confirmation</p>
            <RouteConfirmationStatusPanel confirmation={paymentConfirmation} />
          </div>
        )}
    </>
  ) : null;

  const goodsSection = showGoodsRoute && data ? (
    <>
      {renderRouteSection({
        title: `${PFF_GOODS_ROUTE_TITLE} · ${PFF_GOODS_ROUTE_DIRECTION}`,
        routes: data.goods_routes ?? [],
        selection: routeSelections?.goods ?? null,
        emptyMessage:
          data.is_goods_route_complete === false
            ? "No complete goods path at the selected time."
            : "No goods routes found. Recalculate after zones are connected.",
        canSelect: canSelectGoodsRoute && pffCanChangeSelection,
        selectLabel: "Select goods route",
        showReviewBadge: Boolean(goodsConfirmation?.transporters_notified),
        purpose: "goods",
      })}
      {goodsConfirmation?.transporters_notified &&
        routeSelections?.goods &&
        !isDriver && (
          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-sm font-medium">Goods route confirmation</p>
            <RouteConfirmationStatusPanel confirmation={goodsConfirmation} />
          </div>
        )}
    </>
  ) : null;

  const standardRouteList = (
    <>
      {!data || data.routes.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {data?.route_locked
            ? "No saved route data found for this order."
            : data?.is_route_complete === false
              ? "No costs to show until a complete route exists."
              : "No complete routes found for this order. Ensure pickup and destination are covered by connected transport zones that are within their operating hours, then recalculate."}
        </p>
      ) : (
        <>
          {data.routes.length > 1 && (
            <div className="flex items-center justify-end gap-2">
              <Label htmlFor="route-sort-standard" className="text-xs text-muted-foreground whitespace-nowrap">
                Sort by
              </Label>
              <Select
                id="route-sort-standard"
                className="h-8 w-[11.5rem] text-xs"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as RouteSortKey)}
              >
                <option value="cost_asc">Cost (low → high)</option>
                <option value="cost_desc">Cost (high → low)</option>
                <option value="segments_asc">Segments (few → many)</option>
                <option value="segments_desc">Segments (many → few)</option>
              </Select>
            </div>
          )}
          {sortRoutes(data.routes, sortKey).map((route) => (
            <RouteCard
              key={route.route_id}
              route={route}
              isSelected={selectedRoute?.selected_route_id === route.route_id}
              isHighlighted={zoneIdsEqual(route.zone_ids, highlightedZoneIds)}
              selectionStatus={
                selectedRoute?.selected_route_id === route.route_id
                  ? selectedRoute.status
                  : null
              }
              canSelectRoute={canSelectRoute && !data.route_locked}
              selecting={selectingRouteId === route.route_id}
              onSelectRoute={() => handleSelectRoute(route.route_id)}
              selectRouteLabel="Select route"
              onHighlight={() => highlightRoute(route, null)}
              onShowBreakdown={() => {
                onHighlightRoute?.(route.zone_ids ?? null, null);
                setBreakdownRouteId(route.route_id);
              }}
              userId={user?.id}
              userRole={user?.role}
            />
          ))}
        </>
      )}
      {confirmation && selectedRoute && !isPff && !isDriver && (
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Route confirmation status</p>
            <Link
              href={`/orders/${orderId}/tracking`}
              className="text-xs text-primary hover:underline"
            >
              View tracking map →
            </Link>
          </div>
          <RouteConfirmationStatusPanel confirmation={confirmation} />
        </div>
      )}
    </>
  );

  const sharedHeader = (
    <CardHeader className="flex flex-row items-start justify-between gap-3">
      <div>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          {routeIncomplete
            ? "Route status"
            : isDriver
              ? "Your Zone Costs"
              : "Route Cost Comparison"}
          {refreshing && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {routeIncomplete
            ? "This order has no complete pickup-to-drop-off path right now, so route costs are not calculated."
            : isDriver
            ? "Costs for your zone segments only. Other transporters on the same route are not shown."
            : `Pricing engine: (base × package factor) + traveling + waiting + booking fee${
                data
                  ? ` (${formatBookingFeePercent(data.booking_fee_rate)})`
                  : ""
              }. Each route segment uses its zone's pricing mode (system or own price). Land distance uses ${
                pricingConfig?.land_distance_provider === "google"
                  ? "Google road routing"
                  : "H3 estimate"
              }. Air segments always require a requested/manual cost.`}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleRecalculate}
        disabled={recalculating || !canRecalculate || data?.route_locked}
        className={
          canRecalculate && !data?.route_locked ? undefined : "hidden"
        }
      >
        {recalculating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {routeIncomplete ? "Check route time" : "Recalculate Costs"}
      </Button>
    </CardHeader>
  );

  const breakdownModal = (
    <CostBreakdownModal
      open={breakdownRouteId != null}
      route={
        breakdownRouteId == null
          ? null
          : [
              ...(data?.routes ?? []),
              ...(data?.payment_routes ?? []),
              ...(data?.goods_routes ?? []),
            ].find((r) => r.route_id === breakdownRouteId) ?? null
      }
      onClose={() => setBreakdownRouteId(null)}
      canEnterManual={canEnterManual}
      canRequestQuote={canRequestQuote}
      manualInputs={manualInputs}
      onManualInputChange={(id, val) =>
        setManualInputs((prev) => ({ ...prev, [id]: val }))
      }
      onManualSave={handleManualSave}
      onRequestQuote={handleRequestQuote}
      onFetchExternal={handleFetchExternal}
      externalQuoteConfigured={
        pricingConfig?.external_quote_configured ?? false
      }
      bookingFeeRate={
        pricingConfig?.booking_fee_rate ?? data?.booking_fee_rate ?? 0.02
      }
      savingSegment={savingSegment}
      requestingQuote={requestingQuote}
      fetchingExternal={fetchingExternal}
      userId={user?.id}
      userRole={user?.role}
    />
  );

  // PFF with split maps: payment map → payment list, goods map → goods list.
  if (useSplitPffMaps) {
    return (
      <div className="space-y-2">
        <Card>
          {sharedHeader}
          <CardContent className="space-y-4">
            {routeTimeControl}
            {statusNotices}
          </CardContent>
        </Card>

        {showPaymentRoute && (
          <div className="space-y-2">
            {paymentMapSlot}
            <Card className="flex max-h-[min(28rem,50vh)] flex-col overflow-hidden">
              <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pt-5">
                {data ? (
                  paymentSection
                ) : (
                  <p className="text-sm text-muted-foreground py-2">
                    No payment routes found.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {showGoodsRoute && (
          <div className="space-y-2">
            {goodsMapSlot}
            <Card className="flex max-h-[min(28rem,50vh)] flex-col overflow-hidden">
              <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pt-5">
                {data ? (
                  goodsSection
                ) : (
                  <p className="text-sm text-muted-foreground py-2">
                    No goods routes found.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {breakdownModal}
      </div>
    );
  }

  const routeList = (
    <>
      {routeTimeControl}
      {statusNotices}
      {isPff && data ? (
        <>
          {paymentSection}
          {goodsSection}
        </>
      ) : (
        standardRouteList
      )}
    </>
  );

  const costCard = (
    <Card className="flex max-h-[min(36rem,60vh)] flex-col overflow-hidden">
      {sharedHeader}
      <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        {routeList}
      </CardContent>
    </Card>
  );

  if (mapSlot) {
    return (
      <div className="space-y-2">
        {mapSlot}
        {costCard}
        {breakdownModal}
      </div>
    );
  }

  return (
    <>
      {costCard}
      {breakdownModal}
    </>
  );
}

type BreakdownProps = {
  canEnterManual: boolean;
  canRequestQuote: boolean;
  externalQuoteConfigured: boolean;
  bookingFeeRate: number;
  manualInputs: Record<number, string>;
  onManualInputChange: (id: number, val: string) => void;
  onManualSave: (seg: RouteSegmentCost) => void;
  onRequestQuote: (seg: RouteSegmentCost) => void;
  onFetchExternal: (seg: RouteSegmentCost) => void;
  savingSegment: number | null;
  requestingQuote: number | null;
  fetchingExternal: number | null;
  userId?: number;
  userRole?: string;
};

function RouteCard({
  route,
  isSelected,
  isHighlighted,
  selectionStatus,
  canSelectRoute,
  selecting,
  onSelectRoute,
  selectRouteLabel = "Select route",
  selectionBlockedReason,
  onHighlight,
  onShowBreakdown,
  userId,
  userRole,
}: {
  route: RouteCostSummary;
  isSelected: boolean;
  isHighlighted: boolean;
  selectionStatus: import("@/types").RouteSelectionStatus | null;
  canSelectRoute: boolean;
  selecting: boolean;
  onSelectRoute: () => void;
  selectRouteLabel?: string;
  selectionBlockedReason?: string | null;
  onHighlight: () => void;
  onShowBreakdown: () => void;
  userId?: number;
  userRole?: string;
}) {
  const isDriver = userRole === "driver";
  const visibleSegments = isDriver
    ? route.segments.filter((s) => s.transporter_id === userId)
    : route.segments;
  const pendingCount =
    route.missing_segment_count + (route.requested_segment_count ?? 0);
  const hasPending = pendingCount > 0;
  const costLabel =
    route.total_final_cost != null
      ? `${isDriver ? "Your cost: " : ""}${formatCurrency(route.total_final_cost, route.currency)}`
      : isDriver
        ? "Your cost unavailable"
        : "Cost unavailable";
  const segmentSummary = isDriver
    ? visibleSegments.map((s) => `${s.from_label} → ${s.to_label}`).join(" · ")
    : `${route.transporters.join(" → ")} · ${route.segment_count} segment${
        route.segment_count === 1 ? "" : "s"
      }`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onHighlight}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onHighlight();
        }
      }}
      className={cn(
        "rounded-xl border p-4 space-y-3 text-left transition-colors cursor-pointer",
        isHighlighted
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border hover:bg-muted/30",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{route.route_label}</p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                STATUS_BADGE[route.status],
              )}
            >
              {route.status === "complete"
                ? "Complete"
                : route.status === "partial"
                  ? `Partial · ${pendingCount} pending`
                  : "Missing Cost"}
            </span>
            {isSelected && selectionStatus && (
              <RouteStatusBadge status={selectionStatus} />
            )}
            {isSelected && (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                Selected
              </span>
            )}
            {isHighlighted && (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                On map
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{segmentSummary}</p>
          <div className="flex flex-wrap gap-1.5">
            {visibleSegments.map((s) => (
              <span
                key={s.segment_id}
                className="rounded-md bg-muted px-2 py-0.5 text-xs capitalize"
              >
                {s.transport_method}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right space-y-2" onClick={(e) => e.stopPropagation()}>
          <p className="text-lg font-semibold">{costLabel}</p>
          {canSelectRoute && !isSelected && (
            <Button
              type="button"
              size="sm"
              onClick={onSelectRoute}
              disabled={selecting}
            >
              {selecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                selectRouteLabel
              )}
            </Button>
          )}
          {!canSelectRoute && !isSelected && selectionBlockedReason && (
            <p className="text-xs text-amber-700 dark:text-amber-300 max-w-[14rem] ml-auto">
              {selectionBlockedReason}
            </p>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onShowBreakdown}
            className="mt-1 block ml-auto"
          >
            View Cost Breakdown
          </Button>
        </div>
      </div>

      {hasPending && userRole !== "driver" && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          Some segments need a cost (air always requires a quote; sea/land may
          be missing rates).
        </div>
      )}
    </div>
  );
}

function CostBreakdownModal({
  open,
  route,
  onClose,
  ...breakdownProps
}: {
  open: boolean;
  route: RouteCostSummary | null;
  onClose: () => void;
} & BreakdownProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !route || !mounted) return null;

  const isDriver = breakdownProps.userRole === "driver";
  const costLabel =
    route.total_final_cost != null
      ? formatCurrency(route.total_final_cost, route.currency)
      : "Cost unavailable";

  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cost-breakdown-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(92vh,900px)] w-full max-w-[min(96vw,90rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 space-y-1">
            <h2 id="cost-breakdown-title" className="text-base font-semibold">
              Cost breakdown · {route.route_label}
            </h2>
            <p className="text-xs text-muted-foreground">
              {route.segment_count} segment{route.segment_count === 1 ? "" : "s"}
              {" · "}
              {isDriver ? "Your cost: " : "Total: "}
              {costLabel}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto px-5 py-4">
          <CostBreakdownTable route={route} {...breakdownProps} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CostBreakdownTable({
  route,
  canEnterManual,
  canRequestQuote,
  manualInputs,
  onManualInputChange,
  onManualSave,
  onRequestQuote,
  onFetchExternal,
  externalQuoteConfigured,
  bookingFeeRate,
  savingSegment,
  requestingQuote,
  fetchingExternal,
  userId,
  userRole,
}: { route: RouteCostSummary } & BreakdownProps) {
  const isDriver = userRole === "driver";
  const visibleSegments = isDriver
    ? route.segments.filter((s) => s.transporter_id === userId)
    : route.segments;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] text-xs">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">From</th>
            <th className="py-2 pr-2">To</th>
            <th className="py-2 pr-2">Transporter</th>
            <th className="py-2 pr-2">Method</th>
            <th className="py-2 pr-2">Pricing</th>
            <th className="py-2 pr-2">Distance</th>
            <th className="py-2 pr-2">Time</th>
            <th className="py-2 pr-2">Pkg factor</th>
            <th className="py-2 pr-2">Base</th>
            <th className="py-2 pr-2">Travel</th>
            <th className="py-2 pr-2">Waiting</th>
            <th className="py-2 pr-2">Booking</th>
            <th className="py-2 pr-2">Manual</th>
            <th className="py-2 pr-2">Final</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {visibleSegments.map((seg) => {
            const needsEntry =
              seg.cost_status === "missing" ||
              seg.cost_status === "requested";
            const ownsSegment =
              userRole === "admin" || seg.transporter_id === userId;
            const canOverride =
              canEnterManual &&
              ownsSegment &&
              (needsEntry || seg.cost_status === "calculated");
            const showFetchExternal =
              externalQuoteConfigured &&
              canRequestQuote &&
              needsEntry &&
              seg.cost_status !== "manual";
            const showRequestQuote =
              canRequestQuote &&
              (seg.cost_status === "calculated" ||
                seg.cost_status === "missing") &&
              seg.transport_method !== "air";
            return (
              <tr
                key={seg.segment_id}
                className="border-b border-border/50 last:border-0"
              >
                <td className="py-2 pr-2">{seg.segment_index + 1}</td>
                <td className="py-2 pr-2">{seg.from_label}</td>
                <td className="py-2 pr-2">{seg.to_label}</td>
                <td className="py-2 pr-2">{seg.transporter_name}</td>
                <td className="py-2 pr-2 capitalize">{seg.transport_method}</td>
                <td className="py-2 pr-2 text-[10px] text-muted-foreground max-w-[140px]">
                  {segmentPricingHint(seg, bookingFeeRate) ?? "—"}
                </td>
                <td className="py-2 pr-2 whitespace-nowrap">
                  {seg.distance_km != null ? `${seg.distance_km} km` : "—"}
                </td>
                <td className="py-2 pr-2 whitespace-nowrap">
                  {seg.time_hours != null ? `${seg.time_hours} hr` : "—"}
                </td>
                <td className="py-2 pr-2">
                  {seg.package_factor != null ? seg.package_factor : "—"}
                </td>
                <td className="py-2 pr-2">
                  {seg.breakdown?.adjusted_base_cost != null
                    ? formatCurrency(seg.breakdown.adjusted_base_cost, seg.currency)
                    : seg.base_fee != null
                      ? formatCurrency(seg.base_fee, seg.currency)
                      : "—"}
                </td>
                <td className="py-2 pr-2">
                  {seg.distance_cost != null
                    ? formatCurrency(seg.distance_cost, seg.currency)
                    : "—"}
                </td>
                <td className="py-2 pr-2">
                  {seg.waiting_cost != null
                    ? formatCurrency(seg.waiting_cost, seg.currency)
                    : "—"}
                </td>
                <td className="py-2 pr-2">
                  {seg.booking_fee != null
                    ? formatCurrency(seg.booking_fee, seg.currency)
                    : "—"}
                </td>
                <td className="py-2 pr-2">
                  {canOverride ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <Input
                          className="h-7 w-20 text-xs"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={manualInputs[seg.segment_id] ?? ""}
                          onChange={(e) =>
                            onManualInputChange(seg.segment_id, e.target.value)
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={savingSegment === seg.segment_id}
                          onClick={() => onManualSave(seg)}
                        >
                          {seg.cost_status === "calculated" ? "Override" : "Save"}
                        </Button>
                      </div>
                      {showFetchExternal && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-7 px-2 text-[10px]"
                          disabled={fetchingExternal === seg.segment_id}
                          onClick={() => onFetchExternal(seg)}
                        >
                          {fetchingExternal === seg.segment_id
                            ? "Fetching…"
                            : "Fetch from quote API"}
                        </Button>
                      )}
                    </div>
                  ) : seg.manual_cost != null ? (
                    <span>
                      {formatCurrency(seg.manual_cost, seg.currency)}
                      {seg.cost_source === "external" ? (
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          (ext)
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 pr-2 font-medium">
                  {seg.final_cost != null
                    ? formatCurrency(seg.final_cost, seg.currency)
                    : seg.cost_status === "requested"
                      ? "Cost requested"
                      : "Missing Cost"}
                </td>
                <td className="py-2">
                  <div className="flex flex-col gap-1">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium w-fit",
                        seg.cost_status === "calculated" &&
                          "bg-green-500/10 text-green-700",
                        seg.cost_status === "manual" &&
                          "bg-blue-500/10 text-blue-700",
                        seg.cost_status === "missing" &&
                          "bg-red-500/10 text-red-700",
                        seg.cost_status === "requested" &&
                          "bg-purple-500/10 text-purple-700",
                      )}
                    >
                      {SEGMENT_STATUS[seg.cost_status]}
                    </span>
                    {showRequestQuote && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[10px]"
                        disabled={requestingQuote === seg.segment_id}
                        onClick={() => onRequestQuote(seg)}
                      >
                        {requestingQuote === seg.segment_id
                          ? "Requesting…"
                          : "Request quote"}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
