"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Loader2,
  Map as MapIcon,
  MapPin,
  Package,
  RefreshCw,
  Route as RouteIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  applyManualSegmentCost,
  getPricingConfig,
  getTransporterQuoteQueue,
} from "@/lib/api";
import { showToast } from "@/lib/toast";
import { segmentPricingHint } from "@/lib/zonePricing";
import { pffLegPhaseLabel } from "@/lib/trackingActions";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { RouteSegmentCost, SegmentCostStatus, TransporterQuoteRequest } from "@/types";

const QuoteSegmentMap = dynamic(
  () => import("@/components/orders/QuoteSegmentMap").then((m) => m.QuoteSegmentMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[480px] items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading map…
      </div>
    ),
  }
);

const SEGMENT_STATUS: Record<SegmentCostStatus, string> = {
  calculated: "Calculated",
  manual: "Manual Cost",
  missing: "Missing Cost",
  requested: "Cost Requested",
};

const STATUS_BADGE: Record<SegmentCostStatus, string> = {
  calculated: "bg-green-500/10 text-green-700 dark:text-green-300",
  manual: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  missing: "bg-red-500/10 text-red-700 dark:text-red-300",
  requested: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
};

function quoteLegPhaseKey(phase: TransporterQuoteRequest["segment"]["leg_phase"]): string {
  if (phase === "payment" || phase === "goods") return phase;
  return "standard";
}

function quoteQueueKey(item: TransporterQuoteRequest): string {
  return `${item.order_id}:${item.priced_zone_id}:${item.segment.transporter_id}:${quoteLegPhaseKey(item.segment.leg_phase)}`;
}

interface OrderQuoteGroup {
  orderId: number;
  /** Representative row for order-level fields. */
  meta: TransporterQuoteRequest;
  segments: TransporterQuoteRequest[];
  routes: OrderRouteGroup[];
}

interface OrderRouteGroup {
  routeId: number;
  routeLabel: string;
  /** Segments on this route that still need a quote (deduplicated items). */
  segments: TransporterQuoteRequest[];
}

function groupQuoteRequestsByOrder(items: TransporterQuoteRequest[]): OrderQuoteGroup[] {
  const byOrder = new Map<number, TransporterQuoteRequest[]>();
  for (const item of items) {
    const list = byOrder.get(item.order_id) ?? [];
    list.push(item);
    byOrder.set(item.order_id, list);
  }

  const groups: OrderQuoteGroup[] = [];
  for (const [orderId, orderSegments] of Array.from(byOrder.entries())) {
    orderSegments.sort((a: TransporterQuoteRequest, b: TransporterQuoteRequest) => {
      const statusRank = (s: SegmentCostStatus) => (s === "requested" ? 0 : 1);
      const diff = statusRank(a.segment.cost_status) - statusRank(b.segment.cost_status);
      if (diff !== 0) return diff;
      return a.segment.from_label.localeCompare(b.segment.from_label);
    });

    const routeMap = new Map<number, OrderRouteGroup>();
    for (const item of orderSegments) {
      const routes = item.affected_routes?.length
        ? item.affected_routes
        : [{ route_id: item.route_id, route_label: item.route_label }];
      for (const route of routes) {
        let group = routeMap.get(route.route_id);
        if (!group) {
          group = { routeId: route.route_id, routeLabel: route.route_label, segments: [] };
          routeMap.set(route.route_id, group);
        }
        if (!group.segments.some((s) => quoteQueueKey(s) === quoteQueueKey(item))) {
          group.segments.push(item);
        }
      }
    }

    const routes = Array.from(routeMap.values()).sort((a, b) =>
      a.routeLabel.localeCompare(b.routeLabel)
    );

    groups.push({
      orderId,
      meta: orderSegments[0],
      segments: orderSegments,
      routes,
    });
  }

  groups.sort((a, b) => b.orderId - a.orderId);
  return groups;
}

function segmentDetailLine(seg: RouteSegmentCost): string {
  const parts = [seg.transport_method];
  if (seg.distance_km != null) parts.push(`${seg.distance_km} km`);
  if (seg.time_hours != null) parts.push(`${seg.time_hours} hr`);
  return parts.join(" · ");
}

export function QuoteRequestsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<TransporterQuoteRequest[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasDataRef = useRef(false);
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({});
  const [savingSegment, setSavingSegment] = useState<string | null>(null);
  const [bookingFeeRate, setBookingFeeRate] = useState(0.02);

  const orderGroups = useMemo(() => groupQuoteRequestsByOrder(items), [items]);

  const showMessage = useCallback((text: string, type: "success" | "error" = "success") => {
    showToast(text, type);
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent && !hasDataRef.current) {
      setInitialLoading(true);
    } else if (silent && hasDataRef.current) {
      setRefreshing(true);
    }
    try {
      const data = await getTransporterQuoteQueue();
      setItems(data);
      hasDataRef.current = true;
    } catch (err) {
      if (!hasDataRef.current) {
        showToast(
          err instanceof Error ? err.message : "Failed to load quote requests",
          "error"
        );
        setItems([]);
      }
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
    getPricingConfig()
      .then((c) => setBookingFeeRate(c.booking_fee_rate))
      .catch(() => undefined);
  }, [load]);

  async function handleManualSave(item: TransporterQuoteRequest) {
    const key = quoteQueueKey(item);
    const segmentId = item.segment.segment_id;
    const raw = manualInputs[key] ?? "";
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      showMessage("Enter a valid cost >= 0", "error");
      return;
    }
    setSavingSegment(key);
    try {
      await applyManualSegmentCost(segmentId, value);
      await load(true);
      const routeCount = item.affected_routes?.length ?? 1;
      const legLabel =
        item.segment.leg_phase === "payment" || item.segment.leg_phase === "goods"
          ? ` ${pffLegPhaseLabel(item.segment.leg_phase).toLowerCase()}`
          : "";
      showMessage(
        routeCount > 1
          ? `Quote saved for ${routeCount}${legLabel} routes on order #${item.order_id}.`
          : "Quote saved."
      );
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Failed to save quote", "error");
    } finally {
      setSavingSegment(null);
    }
  }

  const requestedCount = items.filter((i) => i.segment.cost_status === "requested").length;

  return (
    <>
      <div className="px-6 pb-8 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Quote requests
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Grouped by order, route, and segment. Enter one quote per leg — it applies to every
                route on that order that uses the same segment and leg type (payment vs goods on PFF
                orders are priced separately).
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void load(true)}
              disabled={refreshing || initialLoading}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {initialLoading ? (
              <div className="py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading quote requests…
              </div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <p className="text-sm text-muted-foreground">No pending quote requests.</p>
                <p className="text-xs text-muted-foreground">
                  When a sender clicks &ldquo;Request quote&rdquo; on your segment, it will appear
                  here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {requestedCount > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-purple-500/30 bg-purple-500/5 px-3 py-2 text-xs text-purple-800 dark:text-purple-200">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    {requestedCount} segment{requestedCount === 1 ? "" : "s"} explicitly requested
                    by senders — enter your price below.
                  </div>
                )}
                {orderGroups.map((group) => (
                  <OrderQuoteGroupCard
                    key={group.orderId}
                    group={group}
                    isAdmin={user?.role === "admin"}
                    bookingFeeRate={bookingFeeRate}
                    manualInputs={manualInputs}
                    onManualInputChange={(key, val) =>
                      setManualInputs((prev) => ({ ...prev, [key]: val }))
                    }
                    onManualSave={handleManualSave}
                    savingSegment={savingSegment}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function OrderQuoteGroupCard({
  group,
  isAdmin,
  bookingFeeRate,
  manualInputs,
  onManualInputChange,
  onManualSave,
  savingSegment,
}: {
  group: OrderQuoteGroup;
  isAdmin: boolean;
  bookingFeeRate: number;
  manualInputs: Record<string, string>;
  onManualInputChange: (key: string, val: string) => void;
  onManualSave: (item: TransporterQuoteRequest) => void;
  savingSegment: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const item = group.meta;
  const latestUpdate = group.segments.reduce((latest, s) => {
    const t = new Date(s.updated_at).getTime();
    return t > latest ? t : latest;
  }, 0);

  const requestedOnOrder = group.segments.filter(
    (s) => s.segment.cost_status === "requested"
  ).length;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div
        className={cn(
          "bg-muted/30 px-4 py-3 space-y-2",
          expanded && "border-b border-border"
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
            <h3 className="font-semibold text-base">Order #{group.orderId}</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize">
              {item.order_status}
            </span>
            {requestedOnOrder > 0 && (
              <span className="rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 px-2 py-0.5 text-[10px] font-medium">
                {requestedOnOrder} requested
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {group.routes.length} route{group.routes.length === 1 ? "" : "s"} ·{" "}
              {group.segments.length} segment{group.segments.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {latestUpdate > 0 && (
              <p className="text-[10px] text-muted-foreground hidden sm:block">
                Updated {formatDate(new Date(latestUpdate).toISOString())}
              </p>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setExpanded((open) => !open)}
              aria-expanded={expanded}
            >
              {expanded ? (
                <>
                  Show less <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Show more <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>

        {!expanded ? (
          <p className="text-xs text-muted-foreground line-clamp-2">
            <MapPin className="inline h-3 w-3 mr-1 shrink-0" />
            {item.sender_address || "—"}
            <span className="mx-1.5 text-muted-foreground/60">→</span>
            {item.destination_address || "—"}
          </p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
              <p className="flex items-start gap-1.5">
                <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                <span>{item.sender_address || "—"}</span>
              </p>
              <p className="flex items-start gap-1.5">
                <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-primary" />
                <span>{item.destination_address || "—"}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {(item.packages?.length
                ? item.packages
                : item.package_type
                  ? [{ package_type: item.package_type }]
                  : []
              ).map((pkg, index) => (
                <span
                  key={`${pkg.package_type}-${index}`}
                  className="inline-flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 capitalize"
                >
                  <Package className="h-3 w-3" />
                  {pkg.package_type.replace(/_/g, " ")}
                </span>
              ))}
              {item.package_weight_lbs != null && (
                <span className="rounded-md bg-background/80 px-2 py-1">
                  {item.package_weight_lbs} lb
                </span>
              )}
              {item.package_dimensions_in && (
                <span className="rounded-md bg-background/80 px-2 py-1">
                  {item.package_dimensions_in}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {expanded && (
        <>
          <div className="divide-y divide-border">
            {group.routes.map((route) => (
              <div key={route.routeId} className="px-4 py-3">
                <p className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                  <RouteIcon className="h-3.5 w-3.5 text-primary" />
                  {route.routeLabel}
                </p>
                <ul className="space-y-1.5 pl-5 border-l-2 border-border/80 ml-1">
                  {route.segments.map((segItem) => {
                    const seg = segItem.segment;
                    return (
                      <li
                        key={`${route.routeId}-${quoteQueueKey(segItem)}`}
                        className="text-sm pl-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span>
                            <span className="text-muted-foreground">Segment:</span>{" "}
                            {seg.from_label} → {seg.to_label}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                              STATUS_BADGE[seg.cost_status]
                            )}
                          >
                            {SEGMENT_STATUS[seg.cost_status]}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground capitalize mt-0.5">
                          {segmentDetailLine(seg)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-border bg-muted/10 px-4 py-4 space-y-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Your quotes
            </p>
            {group.segments.map((segItem) => (
              <SegmentQuoteBlock
                key={quoteQueueKey(segItem)}
                item={segItem}
                isAdmin={isAdmin}
                bookingFeeRate={bookingFeeRate}
                manualInput={manualInputs[quoteQueueKey(segItem)] ?? ""}
                onManualInputChange={(val) =>
                  onManualInputChange(quoteQueueKey(segItem), val)
                }
                onManualSave={() => onManualSave(segItem)}
                savingManual={savingSegment === quoteQueueKey(segItem)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SegmentQuoteBlock({
  item,
  isAdmin,
  bookingFeeRate,
  manualInput,
  onManualInputChange,
  onManualSave,
  savingManual,
}: {
  item: TransporterQuoteRequest;
  isAdmin: boolean;
  bookingFeeRate: number;
  manualInput: string;
  onManualInputChange: (val: string) => void;
  onManualSave: () => void;
  savingManual: boolean;
}) {
  const [showMap, setShowMap] = useState(false);
  const seg = item.segment;
  const legPhaseLabel =
    seg.leg_phase === "payment" || seg.leg_phase === "goods"
      ? pffLegPhaseLabel(seg.leg_phase)
      : null;
  const affectedRoutes =
    item.affected_routes?.length > 0
      ? item.affected_routes
      : [{ route_id: item.route_id, route_label: item.route_label }];

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div>
        {legPhaseLabel ? (
          <p className="text-[11px] font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300 mb-1">
            {legPhaseLabel}
          </p>
        ) : null}
        <p className="text-sm font-medium">
          {seg.from_label} → {seg.to_label}
        </p>
        <p className="text-xs text-muted-foreground capitalize mt-0.5">
          {segmentDetailLine(seg)}
          {isAdmin ? ` · ${seg.transporter_name}` : ""}
        </p>
      </div>

      <div className="rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 space-y-2">
        <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
          One quote applies to {affectedRoutes.length}{" "}
          {legPhaseLabel ? `${legPhaseLabel.toLowerCase()} ` : ""}
          route{affectedRoutes.length === 1 ? "" : "s"} on order #{item.order_id}
        </p>
        <ul className="space-y-1.5 text-xs text-amber-950/90 dark:text-amber-50/90">
          {affectedRoutes.map((route) => (
            <li key={route.route_id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-medium shrink-0">{route.route_label}</span>
              <span className="text-muted-foreground">—</span>
              <span>
                {seg.from_label} → {seg.to_label}
              </span>
              <span className="text-muted-foreground capitalize">
                ({segmentDetailLine(seg)})
              </span>
            </li>
          ))}
        </ul>
      </div>

      {segmentPricingHint(seg, bookingFeeRate) && (
        <p className="text-xs text-muted-foreground">
          Rates: {segmentPricingHint(seg, bookingFeeRate)}
        </p>
      )}
      {seg.calculated_cost != null && (
        <p className="text-xs text-muted-foreground">
          Previous estimate: {formatCurrency(seg.calculated_cost, seg.currency)}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2 pt-1">
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Your quote ({seg.currency})
          </label>
          <div className="flex items-center gap-2">
            <Input
              className="h-9 w-28"
              inputMode="decimal"
              placeholder="0.00"
              value={manualInput}
              onChange={(e) => onManualInputChange(e.target.value)}
            />
            <Button type="button" size="sm" disabled={savingManual} onClick={onManualSave}>
              {savingManual ? "Saving…" : "Save quote"}
            </Button>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => setShowMap((open) => !open)}
        >
          <MapIcon className="h-3.5 w-3.5" />
          {showMap ? "Hide map" : "Show map"}
          {showMap ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {showMap && <QuoteSegmentMap item={item} />}
    </div>
  );
}
