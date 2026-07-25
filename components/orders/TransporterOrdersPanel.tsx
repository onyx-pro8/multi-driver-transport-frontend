"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrderById, getTransporterOrders } from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import type { Order, TransporterOrderViewItem } from "@/types";
import { TrackingStatusBadge } from "@/components/orders/RouteStatusBadge";
import { ScheduleInactiveNotice } from "@/components/orders/ScheduleInactiveNotice";
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";
import { PACKAGE_TYPE_LABELS } from "@/lib/pricing";
import { showToast } from "@/lib/toast";

const SEGMENT_STATUS_STYLES: Record<string, string> = {
  pending: "text-amber-700 dark:text-amber-300",
  accepted: "text-green-700 dark:text-green-300",
  rejected: "text-red-700 dark:text-red-300",
};

function formatOrderPackageSummary(item: TransporterOrderViewItem): string | null {
  const parts: string[] = [];
  if (item.package_type) {
    const label =
      PACKAGE_TYPE_LABELS[item.package_type as keyof typeof PACKAGE_TYPE_LABELS] ??
      item.package_type.replace(/_/g, " ");
    parts.push(label);
  }
  if (item.package_weight_lbs != null) {
    parts.push(`${item.package_weight_lbs} lb`);
  }
  if (item.package_dimensions_in) {
    parts.push(item.package_dimensions_in);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function TransporterOrdersPanel() {
  const [items, setItems] = useState<TransporterOrderViewItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSegmentIds, setDetailSegmentIds] = useState<number[]>([]);
  const [detailLoadingId, setDetailLoadingId] = useState<number | null>(null);
  const hasDataRef = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!silent && !hasDataRef.current) {
      setInitialLoading(true);
    }
    try {
      const data = await getTransporterOrders();
      setItems(data);
      hasDataRef.current = true;
    } catch {
      if (!hasDataRef.current) {
        setItems([]);
      }
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  async function openOrderDetail(orderId: number, segmentIds: number[]) {
    setDetailLoadingId(orderId);
    setDetailSegmentIds(segmentIds);
    try {
      const order = await getOrderById(orderId);
      setDetailOrder(order);
      setDetailOpen(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to load order details",
        "error"
      );
    } finally {
      setDetailLoadingId(null);
    }
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your routes…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No active routes assigned to you yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const packageSummary = formatOrderPackageSummary(item);
        const mySegmentIds = item.my_segments.map((s) => s.segment_id);
        const loading = detailLoadingId === item.order_id;
        return (
          <Card key={`${item.order_id}-${item.route_id}`}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Order #{item.order_id} · {item.route_label}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.sender_address || "—"} → {item.destination_address || "—"}
                  </p>
                  {packageSummary && (
                    <p className="text-xs text-muted-foreground mt-1">{packageSummary}</p>
                  )}
                  {(item.upstream_transporter || item.downstream_transporter) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.upstream_transporter && (
                        <span>From: {item.upstream_transporter}</span>
                      )}
                      {item.upstream_transporter && item.downstream_transporter && " · "}
                      {item.downstream_transporter && (
                        <span>To: {item.downstream_transporter}</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <TrackingStatusBadge status={item.tracking_status} />
                  <Button
                    type="button"
                    size="lg"
                    className="h-11 min-w-[11rem] px-5 text-sm font-semibold shadow-sm"
                    disabled={loading}
                    onClick={() => void openOrderDetail(item.order_id, mySegmentIds)}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Package className="h-4 w-4" />
                    )}
                    Order details
                  </Button>
                </div>
              </div>
            </CardHeader>
            {(item.schedule_inactive_zones?.length ?? 0) > 0 && (
              <div className="px-6 pb-2">
                <ScheduleInactiveNotice zones={item.schedule_inactive_zones ?? []} />
              </div>
            )}
            <CardContent className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                Your segments
              </p>
              {item.my_segments.map((seg) => (
                <div
                  key={seg.segment_id}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs border-primary/40 bg-primary/[0.03] ring-1 ring-primary/20",
                    seg.zone_schedule_active === false &&
                      "border-sky-500/40 bg-sky-500/5 ring-sky-500/20",
                  )}
                >
                  <div>
                    <p className="font-medium">
                      Segment {seg.segment_index + 1}: {seg.from_label} → {seg.to_label}
                    </p>
                    <p className="text-muted-foreground capitalize">
                      Cost:{" "}
                      {seg.final_cost != null
                        ? formatCurrency(seg.final_cost, "USD")
                        : seg.cost_status}
                    </p>
                    {(seg.package_weight_lbs != null || seg.package_dimensions_in) && (
                      <p className="text-muted-foreground mt-0.5">
                        {seg.package_weight_lbs != null && `${seg.package_weight_lbs} lb`}
                        {seg.package_weight_lbs != null && seg.package_dimensions_in && " · "}
                        {seg.package_dimensions_in}
                      </p>
                    )}
                    {seg.zone_schedule_active === false && (
                      <p className="text-sky-700 dark:text-sky-300 mt-0.5 flex items-start gap-1">
                        <Clock className="h-3 w-3 shrink-0 mt-0.5" />
                        <span>
                          Not available now
                          {seg.zone_schedule_inactive_reason
                            ? ` — ${seg.zone_schedule_inactive_reason}`
                            : seg.zone_schedule_summary
                              ? ` · ${seg.zone_schedule_summary}`
                              : ""}
                        </span>
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "capitalize font-medium",
                      SEGMENT_STATUS_STYLES[seg.confirmation_status] ?? "text-muted-foreground"
                    )}
                  >
                    {seg.confirmation_status}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      <OrderDetailModal
        open={detailOpen && detailOrder != null}
        order={detailOrder}
        canEditPackage={false}
        viewerRole="driver"
        highlightSegmentIds={detailSegmentIds}
        counterpartyLabel={
          detailOrder
            ? `${detailOrder.sender_name || "Sender"} → ${detailOrder.receiver_name || "Receiver"}`
            : ""
        }
        onClose={() => {
          setDetailOpen(false);
          setDetailOrder(null);
        }}
        onMessage={(text, type) => showToast(text, type ?? "success")}
      />
    </div>
  );
}
