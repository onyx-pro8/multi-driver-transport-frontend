"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, MapPin, Package, Route as RouteIcon, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shipmentRef } from "@/lib/entityLabels";
import { paymentMethodLabel, isPffPaymentMethod } from "@/lib/paymentFlow";
import { formatDate } from "@/lib/utils";
import {
  formatPackageDimensions,
  formatPackageWeight,
} from "@/lib/orderWorkflow";
import {
  getOrderTrackingStatus,
  getReceiverOrderView,
  getRouteConfirmationStatus,
  getRouteSelections,
  getSelectedRoute,
  getSenderOrderView,
} from "@/lib/api";
import {
  isPffTrackingRouteConfirmed,
  mergePffTrackingSegments,
  PFF_GOODS_ROUTE_TITLE,
  PFF_PAYMENT_ROUTE_TITLE,
} from "@/lib/pffTracking";
import type {
  Order,
  PffRouteSelections,
  RouteConfirmationStatus,
  TrackingStatus,
} from "@/types";
import { OrderPackageEditor } from "@/components/orders/OrderPackageEditor";
import { OrderStepInstruction } from "@/components/orders/OrderStepInstruction";
import { OrderDeliveryChainStatus } from "@/components/orders/OrderDeliveryChainStatus";
import { RoleBasedMapView } from "@/components/orders/RoleBasedMapView";
import { RouteStatusBadge, TrackingStatusBadge } from "@/components/orders/RouteStatusBadge";
import type { OrderInstructionRole } from "@/lib/orderStepInstructions";

interface Props {
  open: boolean;
  order: Order | null;
  canEditPackage: boolean;
  counterpartyLabel: string;
  viewerRole?: OrderInstructionRole | string;
  /** Transporter segment IDs to emphasize on the delivery chain / map. */
  highlightSegmentIds?: number[];
  onClose: () => void;
  onUpdated?: (order: Order) => void;
  onMessage?: (text: string, type?: "success" | "error") => void;
}

export function OrderDetailModal({
  open,
  order,
  canEditPackage,
  counterpartyLabel,
  viewerRole = "receiver",
  highlightSegmentIds = [],
  onClose,
  onUpdated,
  onMessage,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>("CONFIRMED");
  const [pickupReadyAt, setPickupReadyAt] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<RouteConfirmationStatus | null>(null);
  const [paymentConfirmation, setPaymentConfirmation] =
    useState<RouteConfirmationStatus | null>(null);
  const [goodsConfirmation, setGoodsConfirmation] =
    useState<RouteConfirmationStatus | null>(null);
  const [routeSelections, setRouteSelections] = useState<PffRouteSelections | null>(null);
  const [loadingExtras, setLoadingExtras] = useState(false);

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

  const loadExtras = useCallback(
    async (current: Order) => {
      setLoadingExtras(true);
      try {
        const tracking = await getOrderTrackingStatus(current.id).catch(() => null);
        if (tracking) {
          setTrackingStatus(tracking.tracking_status);
          setPickupReadyAt(tracking.pickup_ready_at);
        } else {
          setTrackingStatus(current.tracking_status);
          setPickupReadyAt(current.pickup_ready_at ?? null);
        }

        if (isPffPaymentMethod(current.payment_method)) {
          const selections = await getRouteSelections(current.id).catch(() => null);
          setRouteSelections(selections);
          let payConf: RouteConfirmationStatus | null = null;
          let goodsConf: RouteConfirmationStatus | null = null;
          if (selections?.payment?.selected_route_id) {
            payConf = await getRouteConfirmationStatus(
              selections.payment.selected_route_id
            ).catch(() => null);
          }
          if (selections?.goods?.selected_route_id) {
            goodsConf = await getRouteConfirmationStatus(
              selections.goods.selected_route_id
            ).catch(() => null);
          }
          setPaymentConfirmation(payConf);
          setGoodsConfirmation(goodsConf);
          setConfirmation(goodsConf ?? payConf);
          return;
        }

        setRouteSelections(null);
        setPaymentConfirmation(null);
        setGoodsConfirmation(null);

        const role = viewerRole === "admin" ? "sender" : viewerRole;
        if (role === "sender") {
          const view = await getSenderOrderView(current.id).catch(() => null);
          if (view?.confirmation) {
            setConfirmation(view.confirmation);
            return;
          }
        } else if (role === "receiver") {
          const view = await getReceiverOrderView(current.id).catch(() => null);
          if (view?.confirmation) {
            setConfirmation(view.confirmation);
            return;
          }
        }

        if (current.selected_route_id) {
          const status = await getRouteConfirmationStatus(current.selected_route_id).catch(
            () => null
          );
          setConfirmation(status);
        } else {
          try {
            const selection = await getSelectedRoute(current.id);
            const status = await getRouteConfirmationStatus(selection.selected_route_id);
            setConfirmation(status);
          } catch {
            setConfirmation(null);
          }
        }
      } finally {
        setLoadingExtras(false);
      }
    },
    [viewerRole]
  );

  useEffect(() => {
    if (!open || !order) {
      setConfirmation(null);
      setPaymentConfirmation(null);
      setGoodsConfirmation(null);
      setRouteSelections(null);
      return;
    }
    void loadExtras(order);
  }, [open, order, loadExtras]);

  const isPff = isPffPaymentMethod(order?.payment_method);
  const mergedSegments = useMemo(
    () => mergePffTrackingSegments(paymentConfirmation, goodsConfirmation),
    [paymentConfirmation, goodsConfirmation]
  );
  const trackingConfirmation = useMemo((): RouteConfirmationStatus | null => {
    if (!isPff) return confirmation;
    if (!paymentConfirmation && !goodsConfirmation) return null;
    const base = goodsConfirmation ?? paymentConfirmation!;
    return { ...base, segments: mergedSegments };
  }, [isPff, confirmation, paymentConfirmation, goodsConfirmation, mergedSegments]);

  const mapRole =
    viewerRole === "driver"
      ? "driver"
      : viewerRole === "receiver"
        ? "receiver"
        : "sender";

  if (!open || !order || !mounted) return null;

  const isRejected = order.tracking_status === "REJECTED";
  const hasRoute = Boolean(
    order.selected_route_id || order.goods_selected_route_id || order.payment_selected_route_id
  );
  const segments = order.selected_route_segments ?? [];
  const routeConfirmed =
    order.route_selection_status === "confirmed" ||
    confirmation?.selection_status === "confirmed";
  const bothRoutesConfirmed = isPffTrackingRouteConfirmed(
    isPff,
    routeSelections,
    routeConfirmed
  );

  const chainSegments = trackingConfirmation?.segments ?? [];
  const pickupTransporter =
    chainSegments.find((s) => s.segment_index === 0)?.transporter_name ??
    chainSegments[0]?.transporter_name ??
    null;

  const estimatedDelivery =
    order.route_schedule_at != null
      ? formatDate(order.route_schedule_at)
      : order.selected_route_total_distance_km != null
        ? `~${Math.max(1, Math.ceil(order.selected_route_total_distance_km / 80))} day(s) (est.)`
        : "—";

  const instructionOrder = {
    ...order,
    tracking_status: trackingStatus || order.tracking_status,
    pickup_ready_at: pickupReadyAt ?? order.pickup_ready_at,
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-detail-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(96vh,920px)] w-full max-w-[min(96vw,1400px)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 space-y-1">
            <h2 id="order-detail-title" className="text-base font-semibold">
              {shipmentRef(order.id)}
            </h2>
            <p className="text-xs text-muted-foreground">
              {counterpartyLabel} · Submitted {formatDate(order.submitted_at)}
              {order.updated_at ? ` · Updated ${formatDate(order.updated_at)}` : ""}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {isRejected && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-muted-foreground">
              This shipment request was rejected by the sender.
            </div>
          )}

          {/* Previous modal: step introduction */}
          <OrderStepInstruction order={instructionOrder} role={viewerRole} />

          {/* Snapshot tiles */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoTile
              label="Order pickup time"
              value={
                pickupReadyAt || order.pickup_ready_at
                  ? formatDate(pickupReadyAt || order.pickup_ready_at!)
                  : "Not set"
              }
            />
            <InfoTile label="Package weight" value={formatPackageWeight(order)} />
            <InfoTile label="Package dimensions" value={formatPackageDimensions(order)} />
            <InfoTile
              label="Pickup transporter"
              value={pickupTransporter ?? "—"}
              icon={<Truck className="h-3.5 w-3.5" />}
            />
            <InfoTile label="Estimated delivery" value={estimatedDelivery} />
            <InfoTile label="Payment method" value={paymentMethodLabel(order.payment_method)} />
            <InfoTile label="Shipping method" value={order.shipping_method || "—"} />
            <InfoTile label="Package type" value={order.package_type || "—"} />
            <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Route status</p>
              <div className="mt-1">
                {hasRoute && order.route_selection_status ? (
                  <RouteStatusBadge status={order.route_selection_status} />
                ) : !isRejected ? (
                  <span className="text-sm font-medium">Not selected</span>
                ) : (
                  <span className="text-sm font-medium">—</span>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Delivery status</p>
              <div className="mt-1">
                {isRejected ? (
                  <TrackingStatusBadge status="REJECTED" />
                ) : (
                  <TrackingStatusBadge status={trackingStatus || order.tracking_status} />
                )}
              </div>
            </div>
            {order.goods_ready_at && (
              <InfoTile label="Goods ready" value={formatDate(order.goods_ready_at)} />
            )}
            {order.payment_pickup_notified_at && (
              <InfoTile
                label="Payment pickup notified"
                value={formatDate(order.payment_pickup_notified_at)}
              />
            )}
          </div>

          {/* Parties & contacts */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/70 px-3 py-2.5 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Sender</p>
              <p className="text-sm font-semibold">{order.sender_name || "—"}</p>
              <p className="text-xs text-muted-foreground">{order.sender_phone || "No phone"}</p>
              {order.source_name?.trim() && (
                <p className="text-xs text-muted-foreground">Source: {order.source_name}</p>
              )}
              {order.source_contact?.trim() && (
                <p className="text-xs text-muted-foreground">Contact: {order.source_contact}</p>
              )}
            </div>
            <div className="rounded-lg border border-border/70 px-3 py-2.5 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Receiver</p>
              <p className="text-sm font-semibold">{order.receiver_name || "—"}</p>
              <p className="text-xs text-muted-foreground">{order.receiver_phone || "No phone"}</p>
            </div>
          </div>

          {/* Addresses */}
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2 rounded-lg border border-border/70 px-3 py-2.5">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">From (pickup)</p>
                <p className="font-medium">{order.sender_address || "—"}</p>
                {order.sender_billing_address?.trim() &&
                  order.sender_billing_address !== order.sender_address && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Billing: {order.sender_billing_address}
                    </p>
                  )}
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-border/70 px-3 py-2.5">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">To (destination)</p>
                <p className="font-medium">{order.destination_address || "—"}</p>
                {order.receiver_billing_address?.trim() &&
                  order.receiver_billing_address !== order.destination_address && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Billing: {order.receiver_billing_address}
                    </p>
                  )}
              </div>
            </div>
          </div>

          {/* Previous modal: route summary + segments */}
          <div className="rounded-lg border border-border/70 px-3 py-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <RouteIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Route</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {hasRoute
                      ? order.selected_route_label ||
                        (order.selected_route_id
                          ? `Route #${order.selected_route_id}`
                          : "Route selected")
                      : "No route selected yet"}
                  </p>
                </div>
              </div>
              {hasRoute && order.route_selection_status ? (
                <RouteStatusBadge status={order.route_selection_status} />
              ) : !isRejected ? (
                <span className="text-xs text-muted-foreground shrink-0">Not selected</span>
              ) : null}
            </div>

            {isPff && (
              <div className="grid gap-2 sm:grid-cols-2 text-xs">
                <p className="text-muted-foreground">
                  {PFF_PAYMENT_ROUTE_TITLE}:{" "}
                  <span className="text-foreground font-medium">
                    {order.payment_selected_route_id
                      ? `#${order.payment_selected_route_id} · ${
                          order.payment_route_selection_status ?? "pending"
                        }`
                      : "Not selected"}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  {PFF_GOODS_ROUTE_TITLE}:{" "}
                  <span className="text-foreground font-medium">
                    {order.goods_selected_route_id
                      ? `#${order.goods_selected_route_id} · ${
                          order.goods_route_selection_status ?? "pending"
                        }`
                      : "Not selected"}
                  </span>
                </p>
              </div>
            )}

            {hasRoute && (
              <p className="text-xs text-muted-foreground">
                Total {formatDistanceKm(order.selected_route_total_distance_km)} · Sea{" "}
                {formatDistanceKm(order.selected_route_method_distance_km?.sea ?? 0)} · Air{" "}
                {formatDistanceKm(order.selected_route_method_distance_km?.air ?? 0)} · Land{" "}
                {formatDistanceKm(order.selected_route_method_distance_km?.land ?? 0)}
              </p>
            )}

            {segments.length > 0 ? (
              <div className="space-y-2">
                {segments.map((segment) => (
                  <div
                    key={`${segment.route_id}-${segment.segment_index}-${segment.transport_method}-${segment.from_label}-${segment.to_label}`}
                    className="rounded-md border border-border/70 px-3 py-2 text-sm"
                  >
                    <p className="font-medium">
                      Segment {segment.segment_index + 1}: {segment.from_label} →{" "}
                      {segment.to_label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {segment.transport_method.toUpperCase()} ·{" "}
                      {formatDistanceKm(segment.distance_km)}
                      {segment.route_purpose ? ` · ${segment.route_purpose}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : !hasRoute && !isRejected ? (
              <p className="text-xs text-muted-foreground">
                After the sender accepts this order, open the Routes page to compare costs and
                choose a preferred multi-transporter path.
              </p>
            ) : null}
          </div>

          {/* Live delivery status chain + map */}
          {loadingExtras ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading delivery status…
            </div>
          ) : (
            <>
              {chainSegments.length > 0 && (
                <div className="rounded-lg border border-border/70 px-4 py-4 overflow-visible">
                  <OrderDeliveryChainStatus
                    segments={chainSegments}
                    trackingStatus={trackingStatus}
                    pickupReadyAt={pickupReadyAt ?? order.pickup_ready_at}
                    goodsReadyAt={order.goods_ready_at}
                    paymentMethod={order.payment_method}
                    routeConfirmed={bothRoutesConfirmed || routeConfirmed}
                    senderLabel="Sender"
                    receiverLabel="Receiver"
                    highlightSegmentIds={highlightSegmentIds}
                  />
                </div>
              )}

              {isPff && (paymentConfirmation || goodsConfirmation) && (
                <div className="grid gap-3 sm:grid-cols-2 text-xs text-muted-foreground">
                  {paymentConfirmation && (
                    <p>
                      {PFF_PAYMENT_ROUTE_TITLE}: {paymentConfirmation.progress_percent}% confirmed
                      ({paymentConfirmation.confirmed_count}/
                      {paymentConfirmation.total_segments})
                    </p>
                  )}
                  {goodsConfirmation && (
                    <p>
                      {PFF_GOODS_ROUTE_TITLE}: {goodsConfirmation.progress_percent}% confirmed (
                      {goodsConfirmation.confirmed_count}/{goodsConfirmation.total_segments})
                    </p>
                  )}
                </div>
              )}

              <div className="rounded-lg border border-border/70 px-4 py-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Interactive map — current delivery location
                </p>
                <RoleBasedMapView
                  order={order}
                  confirmation={trackingConfirmation}
                  trackingStatus={trackingStatus}
                  pickupReadyAt={pickupReadyAt ?? order.pickup_ready_at}
                  goodsReadyAt={order.goods_ready_at}
                  routeConfirmed={bothRoutesConfirmed || routeConfirmed}
                  role={mapRole}
                  showTimeline={false}
                  showSegmentCards={false}
                  emphasizeSegmentIds={highlightSegmentIds}
                />
              </div>
            </>
          )}

          {(order.package_description?.trim() || order.notes?.trim()) && (
            <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Description / notes</p>
              <p className="mt-1 text-sm whitespace-pre-wrap">
                {order.package_description?.trim() || order.notes?.trim()}
              </p>
              {order.package_description?.trim() && order.notes?.trim() && (
                <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
                  Notes: {order.notes.trim()}
                </p>
              )}
            </div>
          )}

          <div className="rounded-lg border border-border/70 px-3 py-3">
            <p className="mb-3 text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Package details
            </p>
            <OrderPackageEditor
              order={order}
              canEdit={canEditPackage}
              onUpdated={onUpdated}
              onMessage={onMessage}
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-border px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function InfoTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-medium truncate" title={value}>
        {value}
      </p>
    </div>
  );
}

function formatDistanceKm(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 100) / 100;
  return `${rounded.toLocaleString()} km`;
}
