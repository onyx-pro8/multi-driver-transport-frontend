"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, Loader2, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTransporterOrders } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { TransporterOrderViewItem } from "@/types";
import { TrackingStatusBadge } from "@/components/orders/RouteStatusBadge";
import { canTrackOrder, TrackOrderLink } from "@/components/orders/TrackOrderLink";
import { ScheduleInactiveNotice } from "@/components/orders/ScheduleInactiveNotice";
import { PACKAGE_TYPE_LABELS } from "@/lib/pricing";

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
        return (
        <Card key={`${item.order_id}-${item.route_id}`}>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
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
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canTrackOrder({
                  tracking_status: item.tracking_status,
                  route_selection_status: item.my_segments.some(
                    (segment) => segment.confirmation_status === "rejected"
                  )
                    ? "rejected"
                    : null,
                }) && (
                  <TrackOrderLink orderId={item.order_id} />
                )}
                <TrackingStatusBadge status={item.tracking_status} />
              </div>
            </div>
          </CardHeader>
          {(item.schedule_inactive_zones?.length ?? 0) > 0 && (
            <div className="px-6 pb-2">
              <ScheduleInactiveNotice zones={item.schedule_inactive_zones ?? []} />
            </div>
          )}
          <CardContent className="space-y-2">
            {item.my_segments.map((seg) => (
              <div
                key={seg.segment_id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs",
                  seg.zone_schedule_active === false
                    ? "border-sky-500/40 bg-sky-500/5"
                    : "border-border/70",
                )}
              >
                <div>
                  <p className="font-medium">
                    Segment {seg.segment_index + 1}: {seg.from_label} → {seg.to_label}
                  </p>
                  <p className="text-muted-foreground capitalize">
                    Cost: {seg.cost_status}
                    {seg.final_cost != null && ` · $${seg.final_cost.toFixed(2)}`}
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
    </div>
  );
}
