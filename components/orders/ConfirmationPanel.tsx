"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Loader2,
  Map as MapIcon,
  Package,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { confirmSegment, rejectSegment, updateSegmentLegStatus, applyManualSegmentCost } from "@/lib/api";
import {
  canSegmentMarkInTransit,
  canSegmentMarkPickedUp,
  pffHandoffRoleLabel,
  pffLegPhaseLabel,
  segmentActionBlockedReason,
  SEGMENT_LEG_LABELS,
} from "@/lib/trackingActions";
import { cn, formatCurrency } from "@/lib/utils";
import type { RouteConfirmationStatus, SegmentCostStatus, TransporterConfirmationItem } from "@/types";
import { RouteStatusBadge, TrackingStatusBadge } from "@/components/orders/RouteStatusBadge";
import { OrderProgressBar } from "@/components/orders/SegmentTimeline";
import { canTrackOrder, TrackOrderLink } from "@/components/orders/TrackOrderLink";
import { ScheduleInactiveNotice } from "@/components/orders/ScheduleInactiveNotice";
import { RejectSegmentDialog } from "@/components/orders/RejectSegmentDialog";
import { PACKAGE_TYPE_LABELS } from "@/lib/pricing";
import {
  defaultPaymentPackageEntry,
  formatPaymentPackageDimensions,
  PAYMENT_PACKAGE_TYPE_LABELS,
  type PaymentPackageEntry,
  type PaymentPackageType,
} from "@/lib/paymentPackages";

const ConfirmationSegmentMap = dynamic(
  () =>
    import("@/components/orders/ConfirmationSegmentMap").then((m) => m.ConfirmationSegmentMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[320px] items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading map…
      </div>
    ),
  },
);

const SEGMENT_COST_LABEL: Record<SegmentCostStatus, string> = {
  calculated: "Calculated",
  manual: "Quoted",
  missing: "Cost not set",
  requested: "Quote pending",
};

function transporterSegmentCostLabel(item: TransporterConfirmationItem): string {
  if (item.final_cost != null) {
    return formatCurrency(item.final_cost, item.currency);
  }
  return SEGMENT_COST_LABEL[item.cost_status] ?? "Cost unavailable";
}

function transporterSegmentCostTotal(items: TransporterConfirmationItem[]): string | null {
  const priced = items.filter((i) => i.final_cost != null);
  if (priced.length === 0) return null;
  const total = priced.reduce((sum, i) => sum + (i.final_cost ?? 0), 0);
  return formatCurrency(total, priced[0].currency);
}

function formatDistanceKm(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 100) / 100;
  return `${rounded.toLocaleString()} km`;
}

function transporterDistanceTotalKm(items: TransporterConfirmationItem[]): number | null {
  const distances = items
    .map((item) => item.distance_km)
    .filter((value): value is number => value != null && Number.isFinite(value));
  if (distances.length === 0) return null;
  return Math.round(distances.reduce((sum, value) => sum + value, 0) * 100) / 100;
}

function formatShipmentPackageSummary(
  item: TransporterConfirmationItem | undefined,
): string | null {
  if (!item) return null;
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

function formatPaymentPackagesSummary(packages: PaymentPackageEntry[]): string | null {
  if (packages.length === 0) return null;
  return packages
    .map((pkg, index) => {
      const typeLabel =
        PAYMENT_PACKAGE_TYPE_LABELS[pkg.payment_type as PaymentPackageType] ?? pkg.payment_type;
      const dims = formatPaymentPackageDimensions(pkg);
      const label = packages.length > 1 ? `Payment ${index + 1}` : "Payment";
      return `${label}: ${typeLabel} · ${pkg.description} · ${pkg.weight_lbs} lb · ${dims}`;
    })
    .join(" | ");
}

function SegmentShipmentDetails({ item }: { item: TransporterConfirmationItem }) {
  if (item.leg_phase === "payment") {
    const packages =
      item.payment_packages && item.payment_packages.length > 0
        ? item.payment_packages
        : [defaultPaymentPackageEntry()];
    const summary = formatPaymentPackagesSummary(packages);

    return (
      <div className="mt-2 rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">
          Payment details
        </p>
        <p className="text-sm mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Package className="h-3.5 w-3.5 text-violet-600 dark:text-violet-300 shrink-0" />
          <span>{summary}</span>
        </p>
      </div>
    );
  }

  return <ShipmentPackageDetails item={item} />;
}

function ShipmentPackageDetails({ item }: { item: TransporterConfirmationItem }) {
  const summary = formatShipmentPackageSummary(item);
  if (!summary) {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
        Package weight and dimensions not provided — ask the sender if you need them to quote.
      </p>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Shipment details
      </p>
      <p className="text-sm mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span>{summary}</span>
      </p>
    </div>
  );
}

function SegmentAvailabilityBadge({ item }: { item: TransporterConfirmationItem }) {
  if (item.zone_schedule_active === false) {
    return (
      <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-950 dark:text-sky-100 space-y-1">
        <p className="font-medium flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          Not available now
        </p>
        {item.zone_schedule_inactive_reason ? (
          <p className="font-medium">{item.zone_schedule_inactive_reason}</p>
        ) : (
          <p>Your zone is outside operating hours.</p>
        )}
        {item.zone_schedule_summary ? (
          <p className="text-muted-foreground">When open: {item.zone_schedule_summary}</p>
        ) : null}
      </div>
    );
  }

  if (item.zone_schedule_active === true && item.zone_schedule_summary) {
    return (
      <p className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        Available now · {item.zone_schedule_summary}
      </p>
    );
  }

  return null;
}

const SEGMENT_STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20",
  accepted: "bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20",
  rejected: "bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20",
};

/** Current selection that still needs action or is in progress — not rejected/superseded. */
export function isActiveTransporterConfirmation(
  item: TransporterConfirmationItem,
): boolean {
  if (item.status === "rejected") return false;
  if (!item.is_current_selection) return false;
  if (item.route_selection_status == null || item.route_selection_status === "rejected") {
    return false;
  }
  return true;
}

interface OrderGroup {
  key: string;
  order_id: number;
  route_id: number | null;
  /** Distinct route labels in this order (e.g. "Payment route 1", "Goods route 1"). */
  route_labels: string[];
  sender_name: string | null;
  receiver_name: string | null;
  transporters: string[];
  sender_address: string;
  destination_address: string;
  items: TransporterConfirmationItem[];
  pendingCount: number;
  acceptedCount: number;
  rejectedCount: number;
  schedule_inactive_zones: TransporterConfirmationItem["schedule_inactive_zones"];
  route_is_complete: boolean;
  /** False for rejected / superseded history cards (read-only). */
  actionable: boolean;
}

function buildGroups(
  items: TransporterConfirmationItem[],
  options: { actionable: boolean; groupByRoute: boolean },
): OrderGroup[] {
  const map = new Map<string, OrderGroup>();
  const inactiveZoneKeys = new Map<string, Set<number>>();

  for (const item of items) {
    const key = options.groupByRoute
      ? `history-${item.order_id}-${item.route_id}`
      : `active-${item.order_id}`;
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        order_id: item.order_id,
        route_id: options.groupByRoute ? item.route_id : null,
        route_labels: [],
        sender_name: item.sender_name ?? null,
        receiver_name: item.receiver_name ?? null,
        transporters: [],
        sender_address: item.sender_address,
        destination_address: item.destination_address,
        items: [],
        pendingCount: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        schedule_inactive_zones: [],
        route_is_complete: true,
        actionable: options.actionable,
      };
      map.set(key, group);
      inactiveZoneKeys.set(key, new Set());
    }
    group.items.push(item);
    if (!group.route_labels.includes(item.route_label)) {
      group.route_labels.push(item.route_label);
    }
    for (const transporter of item.transporters ?? []) {
      if (!group.transporters.includes(transporter)) {
        group.transporters.push(transporter);
      }
    }
    if (item.status === "pending") group.pendingCount += 1;
    else if (item.status === "accepted") group.acceptedCount += 1;
    else if (item.status === "rejected") group.rejectedCount += 1;
    if (item.route_is_complete === false) group.route_is_complete = false;
    const seen = inactiveZoneKeys.get(key)!;
    for (const zone of item.schedule_inactive_zones ?? []) {
      if (!seen.has(zone.zone_id)) {
        seen.add(zone.zone_id);
        (group.schedule_inactive_zones ??= []).push(zone);
      }
    }
  }

  const groups = Array.from(map.values());
  groups.forEach((group) => {
    group.route_labels.sort((a, b) => a.localeCompare(b));
  });
  return groups.sort(
    (a, b) => b.pendingCount - a.pendingCount || b.order_id - a.order_id,
  );
}

/** Order payment/goods legs before standard segments, then by segment index. */
function legRank(item: TransporterConfirmationItem): number {
  if (item.leg_phase === "payment") return 0;
  if (item.leg_phase === "goods") return 1;
  return 2;
}

function sortOrderSegments(
  a: TransporterConfirmationItem,
  b: TransporterConfirmationItem,
): number {
  return (
    legRank(a) - legRank(b) ||
    a.route_label.localeCompare(b.route_label) ||
    a.segment_index - b.segment_index
  );
}

interface ConfirmationPanelProps {
  items: TransporterConfirmationItem[];
  onUpdated?: () => void | Promise<void>;
  onPatchItem?: (segmentId: number, patch: Partial<TransporterConfirmationItem>) => void;
  onMessage?: (text: string, type?: "success" | "error") => void;
}

export function ConfirmationPanel({ items, onUpdated, onPatchItem, onMessage }: ConfirmationPanelProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);
  const [legUpdatingId, setLegUpdatingId] = useState<number | null>(null);
  const [manualInputs, setManualInputs] = useState<Record<number, string>>({});
  const [savingCostId, setSavingCostId] = useState<number | null>(null);

  const { activeGroups, historyGroups } = useMemo(() => {
    const activeItems = items.filter(isActiveTransporterConfirmation);
    const historyItems = items.filter((item) => !isActiveTransporterConfirmation(item));
    return {
      activeGroups: buildGroups(activeItems, { actionable: true, groupByRoute: false }),
      historyGroups: buildGroups(historyItems, { actionable: false, groupByRoute: true }),
    };
  }, [items]);

  const selectedGroup = useMemo(
    () =>
      [...activeGroups, ...historyGroups].find((g) => g.key === selectedKey) ?? null,
    [activeGroups, historyGroups, selectedKey],
  );

  const totalPending = items.filter(
    (i) => isActiveTransporterConfirmation(i) && i.status === "pending",
  ).length;

  async function handleManualSave(item: TransporterConfirmationItem) {
    const raw =
      manualInputs[item.segment_id] ??
      (item.final_cost != null ? String(item.final_cost) : "");
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      onMessage?.("Enter a valid cost >= 0", "error");
      return;
    }
    setSavingCostId(item.segment_id);
    try {
      await applyManualSegmentCost(item.segment_id, value);
      onMessage?.("Segment cost saved.");
      onUpdated?.();
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : "Failed to save segment cost", "error");
    } finally {
      setSavingCostId(null);
    }
  }

  async function handleAccept(segmentId: number) {
    setActingId(segmentId);
    try {
      await confirmSegment(segmentId);
      onPatchItem?.(segmentId, { status: "accepted" });
      onMessage?.("Segment accepted.");
      onUpdated?.();
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : "Failed to accept", "error");
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(segmentId: number, reason: string) {
    setActingId(segmentId);
    try {
      await rejectSegment(segmentId, reason);
      onPatchItem?.(segmentId, {
        status: "rejected",
        rejection_reason: reason.trim() || null,
      });
      onMessage?.("Segment rejected.");
      setRejectingId(null);
      onUpdated?.();
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : "Failed to reject", "error");
      throw err;
    } finally {
      setActingId(null);
    }
  }

  async function handleSegmentLegAction(
    segmentId: number,
    legStatus: "picked_up" | "in_transit"
  ) {
    setLegUpdatingId(segmentId);
    try {
      await updateSegmentLegStatus(segmentId, legStatus);
      onPatchItem?.(segmentId, { leg_status: legStatus });
      onMessage?.(
        legStatus === "picked_up"
          ? "Segment marked as picked up."
          : "Segment marked as in transit."
      );
      await onUpdated?.();
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : "Failed to update segment status", "error");
    } finally {
      setLegUpdatingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No segment confirmation requests assigned to you.
        </CardContent>
      </Card>
    );
  }

  if (selectedGroup) {
    const trackingItem = selectedGroup.items[0];
    const hasRouteAvailabilityIssue =
      !selectedGroup.route_is_complete ||
      (selectedGroup.schedule_inactive_zones?.length ?? 0) > 0;
    const rejectingItem =
      selectedGroup.items.find((i) => i.segment_id === rejectingId) ?? null;

    return (
      <div className="space-y-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2"
          onClick={() => {
            setSelectedKey(null);
            setRejectingId(null);
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to shipments
        </Button>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base">
                  Order #{selectedGroup.order_id}
                  {!selectedGroup.actionable && (
                    <span className="ml-2 text-xs font-medium text-red-700 dark:text-red-300">
                      Rejected / previous route
                    </span>
                  )}
                </CardTitle>
                {selectedGroup.route_labels.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedGroup.route_labels.join(" · ")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedGroup.sender_name || "Sender"} {"->"} {selectedGroup.receiver_name || "Receiver"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedGroup.sender_address || "—"} → {selectedGroup.destination_address || "—"}
                </p>
                {selectedGroup.transporters.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Transporters: {selectedGroup.transporters.join(" · ")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {selectedGroup.pendingCount} pending · {selectedGroup.acceptedCount} accepted ·{" "}
                  {selectedGroup.rejectedCount} rejected
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Shipment distance:{" "}
                  <span className="font-medium text-foreground">
                    {formatDistanceKm(transporterDistanceTotalKm(selectedGroup.items))}
                  </span>
                </p>
                {formatShipmentPackageSummary(trackingItem) && (
                  <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-1">
                    <Package className="h-3 w-3 shrink-0" />
                    {formatShipmentPackageSummary(trackingItem)}
                  </p>
                )}
                {selectedGroup.actionable &&
                  trackingItem.route_selection_status === "confirmed" && (
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    {trackingItem.pickup_ready_at ? (
                      <TrackingStatusBadge status={trackingItem.order_tracking_status} />
                    ) : (
                      <span className="text-xs text-muted-foreground">Awaiting sender pick ready</span>
                    )}
                  </div>
                )}
              </div>
              {selectedGroup.actionable &&
                canTrackOrder({
                  tracking_status: trackingItem.order_tracking_status,
                  route_selection_status: trackingItem.route_selection_status,
                }) && (
                <TrackOrderLink orderId={selectedGroup.order_id} className="shrink-0" />
              )}
            </div>
          </CardHeader>
        </Card>

        {!selectedGroup.actionable && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-950 dark:text-red-100">
            <p className="font-medium">This route is no longer active</p>
            <p className="text-xs mt-1 opacity-90">
              It was rejected or replaced by a new route selection. No action is needed here —
              check Active requests if you have a new segment on this shipment.
            </p>
          </div>
        )}

        {selectedGroup.actionable && hasRouteAvailabilityIssue && (
          <div className="space-y-3">
            {!selectedGroup.route_is_complete && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
                <p className="font-medium">Route may be incomplete</p>
                <p className="text-xs mt-1 opacity-90">
                  This path may not fully connect pickup to destination. Confirm your segment
                  cost only if you can cover your leg when the route is active.
                </p>
              </div>
            )}
            {(selectedGroup.schedule_inactive_zones?.length ?? 0) > 0 && (
              <ScheduleInactiveNotice zones={selectedGroup.schedule_inactive_zones ?? []} />
            )}
          </div>
        )}

        {[...selectedGroup.items]
          .sort(sortOrderSegments)
          .map((item) => (
            <SegmentCard
              key={item.confirmation_id}
              item={item}
              readOnly={!selectedGroup.actionable}
              actingId={actingId}
              legUpdatingId={legUpdatingId}
              manualInput={
                manualInputs[item.segment_id] ??
                (item.final_cost != null ? String(item.final_cost) : "")
              }
              savingCost={savingCostId === item.segment_id}
              onManualInputChange={(value) =>
                setManualInputs((prev) => ({ ...prev, [item.segment_id]: value }))
              }
              onManualSave={() => void handleManualSave(item)}
              onAccept={handleAccept}
              onSegmentLegAction={handleSegmentLegAction}
              onOpenReject={setRejectingId}
            />
          ))}

        <RejectSegmentDialog
          open={rejectingId != null}
          segmentLabel={
            rejectingItem
              ? `Segment ${rejectingItem.segment_index + 1}: ${rejectingItem.from_label} → ${rejectingItem.to_label}`
              : "this segment"
          }
          submitting={actingId != null && actingId === rejectingId}
          onClose={() => {
            if (actingId == null) setRejectingId(null);
          }}
          onConfirm={async (reason) => {
            if (rejectingId == null) return;
            await handleReject(rejectingId, reason);
          }}
        />
      </div>
    );
  }

  function renderGroupCard(group: OrderGroup) {
    const segmentCostTotal = transporterSegmentCostTotal(group.items);
    const shipmentDistance = transporterDistanceTotalKm(group.items);
    const orderTrackingStatus = group.items[0]?.order_tracking_status ?? "CONFIRMED";
    const orderRouteSelectionStatus = group.items[0]?.route_selection_status ?? null;
    const hasAvailabilityIssue =
      !group.route_is_complete || (group.schedule_inactive_zones?.length ?? 0) > 0;
    const packageSummary = formatShipmentPackageSummary(group.items[0]);
    return (
      <Card
        key={group.key}
        className={cn(
          "cursor-pointer transition-colors hover:bg-muted/30",
          !group.actionable && "border-red-500/25 bg-red-500/[0.03]",
        )}
        onClick={() => setSelectedKey(group.key)}
      >
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium truncate">
                Order #{group.order_id}
                {group.route_labels.length > 0 && (
                  <span className="text-muted-foreground font-normal">
                    {" · "}
                    {group.route_labels.join(" · ")}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {group.sender_name || "Sender"} {"->"} {group.receiver_name || "Receiver"}
              </p>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {group.sender_address || "—"} → {group.destination_address || "—"}
              </p>
              {group.transporters.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  Transporters: {group.transporters.join(" · ")}
                </p>
              )}
              {packageSummary && (
                <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-1">
                  <Package className="h-3 w-3 shrink-0" />
                  {packageSummary}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {group.items.length} segment{group.items.length === 1 ? "" : "s"}
                {group.actionable && group.pendingCount > 0 && (
                  <span className="ml-2 text-amber-700 dark:text-amber-300 font-medium">
                    {group.pendingCount} pending
                  </span>
                )}
                {!group.actionable && (
                  <span className="ml-2 text-red-700 dark:text-red-300 font-medium">
                    {group.rejectedCount > 0
                      ? `${group.rejectedCount} rejected`
                      : "Previous route"}
                  </span>
                )}
                {segmentCostTotal && (
                  <span className="ml-2 font-medium text-foreground">
                    · Your cost: {segmentCostTotal}
                  </span>
                )}
                {shipmentDistance != null && (
                  <span className="ml-2 font-medium text-foreground">
                    · Distance: {formatDistanceKm(shipmentDistance)}
                  </span>
                )}
                {group.actionable && hasAvailabilityIssue && (
                  <span className="ml-2 inline-flex items-center gap-1 text-sky-700 dark:text-sky-300 font-medium">
                    <Clock className="h-3 w-3" />
                    Route availability limited
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {group.actionable &&
                canTrackOrder({
                  tracking_status: orderTrackingStatus,
                  route_selection_status: orderRouteSelectionStatus,
                }) && (
                <TrackOrderLink
                  orderId={group.order_id}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Active requests</h3>
          <p className="text-xs text-muted-foreground">
            Pending and accepted segments on the currently selected route.
          </p>
        </div>
        {totalPending > 0 && (
          <p className="text-sm text-muted-foreground">
            {totalPending} segment{totalPending === 1 ? "" : "s"} awaiting your response across{" "}
            {activeGroups.length} order{activeGroups.length === 1 ? "" : "s"}.
          </p>
        )}
        {activeGroups.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No active confirmation requests right now.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">{activeGroups.map(renderGroupCard)}</div>
        )}
      </section>

      {historyGroups.length > 0 && (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Rejected & previous routes</h3>
            <p className="text-xs text-muted-foreground">
              Routes you or another transporter rejected, or that were replaced after reselection.
              These are history only — they are not mixed with active requests.
            </p>
          </div>
          <div className="space-y-3">{historyGroups.map(renderGroupCard)}</div>
        </section>
      )}
    </div>
  );
}

const LEG_STATUS_BADGE: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground border border-border",
  picked_up: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20",
  in_transit: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20",
};

interface SegmentCardProps {
  item: TransporterConfirmationItem;
  readOnly?: boolean;
  actingId: number | null;
  legUpdatingId: number | null;
  manualInput: string;
  savingCost: boolean;
  onManualInputChange: (value: string) => void;
  onManualSave: () => void;
  onAccept: (segmentId: number) => void;
  onSegmentLegAction: (segmentId: number, legStatus: "picked_up" | "in_transit") => void;
  onOpenReject: (segmentId: number) => void;
}

function SegmentCard({
  item,
  readOnly = false,
  actingId,
  legUpdatingId,
  manualInput,
  savingCost,
  onManualInputChange,
  onManualSave,
  onAccept,
  onSegmentLegAction,
  onOpenReject,
}: SegmentCardProps) {
  const [showMap, setShowMap] = useState(false);
  const showPickedUp = !readOnly && canSegmentMarkPickedUp(item);
  const showInTransit = !readOnly && canSegmentMarkInTransit(item);
  const legUpdating = legUpdatingId === item.segment_id;
  const handoffLabel = pffHandoffRoleLabel(item.handoff_role);
  const blockedReason = segmentActionBlockedReason(item);
  const segmentUnavailable = item.zone_schedule_active === false;

  return (
    <Card
      className={cn(
        segmentUnavailable && "border-sky-500/40 ring-1 ring-sky-500/20",
        readOnly && "opacity-95",
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              {item.leg_phase ? (
                <span className="text-violet-700 dark:text-violet-300 text-xs font-medium uppercase tracking-wide block mb-0.5">
                  {pffLegPhaseLabel(item.leg_phase)}
                </span>
              ) : null}
              Segment {item.segment_index + 1}: {item.from_label} → {item.to_label}
            </CardTitle>
            {handoffLabel ? (
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 font-medium">
                {handoffLabel}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground mt-1">
              Transporter:{" "}
              <span className="font-medium text-foreground">{item.transporter_name}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Driver:{" "}
              <span className="font-medium text-foreground">
                {item.driver_name ?? "—"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Request sent: {new Date(item.sent_at).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Segment distance:{" "}
              <span className="font-medium text-foreground">{formatDistanceKm(item.distance_km)}</span>
            </p>
            <SegmentShipmentDetails item={item} />
            <p className="text-sm font-medium mt-3">Your segment cost</p>
            {!readOnly && item.status === "pending" ? (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Input
                  className="h-8 w-28"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={manualInput}
                  onChange={(e) => onManualInputChange(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={savingCost || actingId === item.segment_id}
                  onClick={onManualSave}
                >
                  {savingCost ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : item.cost_status === "calculated" ? (
                    "Override"
                  ) : (
                    "Save"
                  )}
                </Button>
                {item.final_cost == null && (
                  <span className="text-xs text-amber-700 dark:text-amber-300">
                    {SEGMENT_COST_LABEL[item.cost_status] ?? "Cost not set"}
                  </span>
                )}
              </div>
            ) : (
              <p
                className={cn(
                  "text-sm font-semibold mt-1",
                  item.final_cost != null ? "text-foreground" : "text-amber-700 dark:text-amber-300"
                )}
              >
                {transporterSegmentCostLabel(item)}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                SEGMENT_STATUS_BADGE[item.status]
              )}
            >
              {item.status}
            </span>
            {!readOnly && item.status === "pending" && (
              <div className="flex flex-wrap justify-end gap-2 rounded-xl border-2 border-primary/40 bg-primary/10 p-2 shadow-sm">
                <Button
                  type="button"
                  className="min-w-[6.5rem] shadow-md"
                  onClick={() => onAccept(item.segment_id)}
                  disabled={actingId === item.segment_id}
                >
                  {actingId === item.segment_id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Accept
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-w-[6.5rem] border-danger/40 bg-background text-danger hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={() => onOpenReject(item.segment_id)}
                  disabled={actingId === item.segment_id}
                >
                  <X className="h-4 w-4" />
                  Reject
                </Button>
              </div>
            )}
            {item.status === "accepted" &&
              item.route_selection_status === "confirmed" &&
              (showPickedUp || showInTransit) && (
                <div className="flex flex-wrap justify-end gap-2 rounded-xl border-2 border-indigo-500/40 bg-indigo-500/10 p-2 shadow-sm">
                  {showPickedUp && (
                    <Button
                      type="button"
                      className="min-w-[7rem] bg-blue-600 text-white shadow-md hover:bg-blue-600/90"
                      disabled={legUpdating}
                      onClick={() => onSegmentLegAction(item.segment_id, "picked_up")}
                    >
                      {legUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Package className="h-4 w-4" />
                      )}
                      Picked up
                    </Button>
                  )}
                  {showInTransit && (
                    <Button
                      type="button"
                      className="min-w-[7rem] bg-indigo-600 text-white shadow-md hover:bg-indigo-600/90"
                      disabled={legUpdating}
                      onClick={() => onSegmentLegAction(item.segment_id, "in_transit")}
                    >
                      {legUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                      In transit
                    </Button>
                  )}
                </div>
              )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <SegmentAvailabilityBadge item={item} />

        {item.status === "accepted" && item.route_selection_status === "confirmed" && (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "w-fit rounded-full px-2 py-0.5 text-xs font-medium",
                LEG_STATUS_BADGE[item.leg_status] ?? LEG_STATUS_BADGE.not_started
              )}
            >
              Leg: {SEGMENT_LEG_LABELS[item.leg_status]}
            </span>
            {blockedReason ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">{blockedReason}</p>
            ) : null}
          </div>
        )}

        {item.status !== "pending" && item.rejection_reason ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            Rejection reason: {item.rejection_reason}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowMap((open) => !open)}
          >
            <MapIcon className="h-3.5 w-3.5" />
            {showMap ? "Hide map" : "View map"}
            {showMap ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {showMap && <ConfirmationSegmentMap item={item} />}
      </CardContent>
    </Card>
  );
}

interface RouteConfirmationStatusPanelProps {
  confirmation: RouteConfirmationStatus;
  className?: string;
}

export function RouteConfirmationStatusPanel({
  confirmation,
  className,
}: RouteConfirmationStatusPanelProps) {
  return (
    <div className={cn("rounded-xl border border-border p-4 space-y-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <RouteStatusBadge status={confirmation.selection_status} />
        {confirmation.payment_status === "ready" && (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
            Payment ready
          </span>
        )}
      </div>
      <OrderProgressBar
        percent={confirmation.progress_percent}
        label="Segment confirmation progress"
      />
      <div className="space-y-2">
        {confirmation.segments.map((seg) => (
          <div
            key={seg.segment_id}
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs",
              seg.status === "accepted" && "bg-green-500/5 border border-green-500/20",
              seg.status === "pending" && "bg-amber-500/5 border border-amber-500/20",
              seg.status === "rejected" && "bg-red-500/5 border border-red-500/20"
            )}
          >
            <div>
              <p className="font-medium">
                {seg.from_label} → {seg.to_label}
              </p>
              <p className="text-muted-foreground">{seg.transporter_name}</p>
            </div>
            <div className="text-right">
              <p className="capitalize font-medium">{seg.status}</p>
              <p className="text-muted-foreground capitalize">
                Leg: {SEGMENT_LEG_LABELS[seg.leg_status ?? "not_started"]}
              </p>
              {seg.final_cost != null && (
                <p className="text-muted-foreground">
                  {formatCurrency(seg.final_cost, seg.currency)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
