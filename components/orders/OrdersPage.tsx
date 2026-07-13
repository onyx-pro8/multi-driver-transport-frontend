"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, Package, Plus, Route, Send, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listOrders, connectOrder, rejectOrder, notifyPaymentPickedUpToSender, updateOrderTrackingStatus } from "@/lib/api";
import { RouteCostComparison } from "@/components/orders/RouteCostComparison";
import { shipmentRef } from "@/lib/entityLabels";
import { showToast } from "@/lib/toast";
import { canMarkDelivered, canMarkPickReady, canReceiverMarkPickReadyForPff, canReceiverNotifyPaymentPickedUp, canSenderMarkGoodsReadyForPff, isOrderRouteSelectionBlocked } from "@/lib/trackingActions";
import { cn, formatDate } from "@/lib/utils";
import type { Order, TrackingStatus } from "@/types";
import { ReceiverNewOrderModal } from "./ReceiverNewOrderModal";
import { OrderPossibleRoutes } from "@/components/orders/OrderPossibleRoutes";
import { OrderPackageEditor } from "@/components/orders/OrderPackageEditor";
import { RouteStatusBadge, TrackingStatusBadge } from "@/components/orders/RouteStatusBadge";
import { InquiryReviewPanel } from "@/components/orders/InquiryReviewPanel";
import { RejectionReasonDialog } from "@/components/orders/RejectionReasonDialog";
import { TrackOrderLink } from "@/components/orders/TrackOrderLink";

export function OrdersPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const isSender = user?.role === "sender" || user?.role === "admin";
  const isReceiver = user?.role === "receiver" || user?.role === "admin";

  const [orders, setOrders] = useState<Order[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const hasOrdersRef = useRef(false);
  const [updating, setUpdating] = useState<number | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [rejectionReasonOrder, setRejectionReasonOrder] = useState<Order | null>(null);
  const [costRefreshKey, setCostRefreshKey] = useState(0);
  const [orderFormModalOpen, setOrderFormModalOpen] = useState(false);

  const isAwaitingConnect = (order: Order) => order.tracking_status === "AWAITING_CONNECT";
  const isRejected = (order: Order) => order.tracking_status === "REJECTED";

  const refresh = useCallback(async () => {
    if (!hasOrdersRef.current) {
      setInitialLoading(true);
    }
    try {
      const data = await listOrders();
      setOrders(data);
      hasOrdersRef.current = true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load orders", "error");
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const raw = searchParams.get("orderId");
    if (!raw) return;
    const id = Number(raw);
    if (Number.isFinite(id)) setSelectedOrderId(id);
  }, [searchParams]);

  const showMessage = useCallback((text: string, type: "success" | "error" = "success") => {
    showToast(text, type);
  }, []);

  const counts = useMemo(() => {
    const c = { awaitingConnect: 0, noRoute: 0, pending: 0, confirmed: 0, rejected: 0 };
    orders.forEach((o) => {
      if (isAwaitingConnect(o)) {
        c.awaitingConnect += 1;
        return;
      }
      if (!o.selected_route_id) {
        c.noRoute += 1;
      } else if (o.route_selection_status === "confirmed") {
        c.confirmed += 1;
      } else if (o.route_selection_status === "rejected") {
        c.rejected += 1;
      } else {
        c.pending += 1;
      }
    });
    return c;
  }, [orders]);

  const selectedOrder = useMemo(
    () => (selectedOrderId == null ? null : orders.find((o) => o.id === selectedOrderId) ?? null),
    [selectedOrderId, orders]
  );

  function handleRowClick(order: Order) {
    if (isSender && isAwaitingConnect(order)) {
      setSelectedOrderId(order.id);
      setReviewModalOpen(true);
      return;
    }
    setReviewModalOpen(false);
    setSelectedOrderId((prev) => (prev === order.id ? null : order.id));
  }

  function openReviewModal(order: Order) {
    setSelectedOrderId(order.id);
    setReviewModalOpen(true);
  }

  function closeReviewModal() {
    if (connecting != null || rejecting != null) return;
    setReviewModalOpen(false);
  }

  async function handleConnect(order: Order) {
    setConnecting(order.id);
    try {
      const { route_recalc_warning, ...updated } = await connectOrder(order.id);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setSelectedOrderId(updated.id);
      setReviewModalOpen(false);
      setCostRefreshKey((k) => k + 1);
      showMessage("Shipment accepted. Select a route and send confirmations.");
      if (route_recalc_warning) {
        showMessage(route_recalc_warning, "error");
      }
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Failed to connect order", "error");
    } finally {
      setConnecting(null);
    }
  }

  async function handleReject(order: Order, reason: string) {
    setRejecting(order.id);
    try {
      const updated = await rejectOrder(order.id, reason);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setReviewModalOpen(false);
      showMessage("Shipment request rejected.");
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Failed to reject shipment", "error");
      throw err;
    } finally {
      setRejecting(null);
    }
  }

  async function handleNotifyPaymentPickup(order: Order) {
    setUpdating(order.id);
    try {
      await notifyPaymentPickedUpToSender(order.id);
      await refresh();
      showMessage("Producer notified that payment was collected.");
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Notification failed", "error");
    } finally {
      setUpdating(null);
    }
  }

  async function handleTrackingAction(order: Order, status: TrackingStatus) {
    setUpdating(order.id);
    try {
      await updateOrderTrackingStatus(order.id, status);
      await refresh();
      showMessage(
        status === "PICKUP_AVAILABLE"
          ? "Pickup marked as ready."
          : status === "DELIVERED"
            ? "Order marked as delivered."
            : "Status updated."
      );
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Update failed", "error");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <>
      <div className="px-6 pb-8 space-y-6">
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {isSender && (
            <StatTile icon={<Send className="h-5 w-5" />} label="Awaiting connect" value={counts.awaitingConnect} />
          )}
          <StatTile icon={<Route className="h-5 w-5" />} label="No route selected" value={counts.noRoute} />
          <StatTile icon={<Clock className="h-5 w-5" />} label="Awaiting confirmation" value={counts.pending} />
          <StatTile icon={<CheckCircle2 className="h-5 w-5" />} label="Route confirmed" value={counts.confirmed} />
          <StatTile icon={<XCircle className="h-5 w-5" />} label="Route rejected" value={counts.rejected} />
        </section>

        {isReceiver && (
          <div className="flex flex-col gap-4 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/8 via-card to-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-sm">
                <Send className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight">Request a shipment</h2>
                <p className="max-w-xl text-sm text-muted-foreground">
                  Submit a request to a sender. They review payment and order details before
                  connecting routes.
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="lg"
              className="shrink-0 self-start sm:self-center"
              onClick={() => setOrderFormModalOpen(true)}
            >
              <Plus className="h-4 w-4" />
              New shipment request
            </Button>
          </div>
        )}

        {isSender && (
          <Card className="border-dashed">
            <CardContent className="py-6 text-sm text-muted-foreground">
              Incoming shipment requests appear below. Click a row to review payment method and order
              description, then <strong className="text-foreground">Accept</strong> or{" "}
              <strong className="text-foreground">Reject</strong> before routes are built.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                {isSender ? "Your shipments" : "Shipments to you"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Click any row to view package details and route options.
              </p>
            </div>
            {isReceiver && (
              <Button type="button" variant="outline" size="sm" onClick={() => setOrderFormModalOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                New request
              </Button>
            )}
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {initialLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Package className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">No shipments yet</p>
                  <p className="text-sm text-muted-foreground">
                    {isReceiver
                      ? "Start by submitting your first shipment request."
                      : "Incoming shipment requests will appear here."}
                  </p>
                </div>
                {isReceiver && (
                  <Button type="button" size="sm" onClick={() => setOrderFormModalOpen(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    New shipment request
                  </Button>
                )}
              </div>
            ) : (
              <table className="w-full min-w-[1000px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-3 pr-4 font-medium">#</th>
                    <th className="py-3 pr-4 font-medium">{isSender ? "Receiver" : "Sender"}</th>
                    <th className="py-3 pr-4 font-medium">Phone</th>
                    <th className="py-3 pr-4 font-medium">From</th>
                    <th className="py-3 pr-4 font-medium">To</th>
                    <th className="py-3 pr-4 font-medium">Route</th>
                    {/* <th className="py-3 pr-4 font-medium">Distance</th> */}
                    <th className="py-3 pr-4 font-medium">Route status</th>
                    <th className="py-3 pr-4 font-medium">Delivery status</th>
                    <th className="py-3 pr-4 font-medium">Submitted</th>
                    <th className="py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const counterparty = isSender ? order.receiver_name : order.sender_name;
                    const counterpartyPhone = isSender ? order.receiver_phone : order.sender_phone;
                    const isSelected = selectedOrderId === order.id;
                    const hasRoute = Boolean(order.selected_route_id);
                    return (
                      <tr
                        key={order.id}
                        onClick={() => handleRowClick(order)}
                        className={cn(
                          "border-b border-border/70 last:border-0 cursor-pointer transition-colors",
                          isSelected ? "bg-primary/5" : "hover:bg-muted/50"
                        )}
                      >
                        <td className="py-3 pr-4 font-mono text-xs">#{order.id}</td>
                        <td className="py-3 pr-4 font-medium">{counterparty}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{counterpartyPhone || "—"}</td>
                        <td className="py-3 pr-4 max-w-[160px] truncate" title={order.sender_address}>
                          {order.sender_address || "—"}
                        </td>
                        <td className="py-3 pr-4 max-w-[160px] truncate" title={order.destination_address}>
                          {order.destination_address || "—"}
                        </td>
                        <td className="py-3 pr-4 max-w-[140px] truncate text-muted-foreground" title={order.selected_route_label ?? undefined}>
                          {order.selected_route_label || "—"}
                        </td>
                        {/* <td className="py-3 pr-4">
                          {order.selected_route_id ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-foreground">
                                {formatDistanceKm(order.selected_route_total_distance_km)}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                Sea {formatDistanceKm(order.selected_route_method_distance_km?.sea ?? 0)} · Air{" "}
                                {formatDistanceKm(order.selected_route_method_distance_km?.air ?? 0)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td> */}
                        <td className="py-3 pr-4">
                          <div className="flex flex-col gap-1 items-start">
                            {isAwaitingConnect(order) ? (
                              <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20">
                                Awaiting connect
                              </span>
                            ) : isRejected(order) ? (
                              <TrackingStatusBadge status="REJECTED" />
                            ) : hasRoute && order.route_selection_status ? (
                              <RouteStatusBadge status={order.route_selection_status} />
                            ) : (
                              <span className="text-xs text-muted-foreground">No route selected</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          {isRejected(order) ? (
                            <span className="text-xs text-muted-foreground">Rejected</span>
                          ) : isAwaitingConnect(order) ? (
                            <span className="text-xs text-muted-foreground">Not started</span>
                          ) : order.route_selection_status === "confirmed" ? (
                            <TrackingStatusBadge status={order.tracking_status} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">{formatDate(order.submitted_at)}</td>
                        <td
                          className="py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            {isSender && isAwaitingConnect(order) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openReviewModal(order)}
                              >
                                Review
                              </Button>
                            )}
                            {isSender && canMarkPickReady(order) && (
                              <Button
                                size="sm"
                                disabled={updating === order.id}
                                onClick={() => void handleTrackingAction(order, "PICKUP_AVAILABLE")}
                              >
                                {updating === order.id ? "Updating…" : "Pick ready"}
                              </Button>
                            )}
                            {isReceiver && canReceiverMarkPickReadyForPff(order) && (
                              <Button
                                size="sm"
                                disabled={updating === order.id}
                                onClick={() => void handleTrackingAction(order, "PICKUP_AVAILABLE")}
                              >
                                {updating === order.id ? "Updating…" : "Payment pickup available"}
                              </Button>
                            )}
                            {isReceiver && canReceiverNotifyPaymentPickedUp(order) && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updating === order.id}
                                onClick={() => void handleNotifyPaymentPickup(order)}
                              >
                                {updating === order.id ? "Sending…" : "Notify producer"}
                              </Button>
                            )}
                            {isSender && canSenderMarkGoodsReadyForPff(order) && (
                              <Button
                                size="sm"
                                disabled={updating === order.id}
                                onClick={() => void handleTrackingAction(order, "PICKUP_AVAILABLE")}
                              >
                                {updating === order.id ? "Updating…" : "Goods ready"}
                              </Button>
                            )}
                            {isReceiver &&
                              (order.receiver_user_id === user?.id || user?.role === "admin") &&
                              canMarkDelivered(order) && (
                                <Button
                                  size="sm"
                                  disabled={updating === order.id}
                                  onClick={() => void handleTrackingAction(order, "DELIVERED")}
                                >
                                  {updating === order.id ? "Updating…" : "Delivered"}
                                </Button>
                              )}
                            {isRejected(order) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRejectionReasonOrder(order)}
                              >
                                View reason
                              </Button>
                            )}
                            {!isAwaitingConnect(order) && !isRejected(order) && (
                              <TrackOrderLink orderId={order.id} />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <InquiryReviewPanel
          open={reviewModalOpen && selectedOrder != null && isAwaitingConnect(selectedOrder)}
          order={selectedOrder}
          canAct={isSender}
          accepting={selectedOrder != null && connecting === selectedOrder.id}
          rejecting={selectedOrder != null && rejecting === selectedOrder.id}
          onClose={closeReviewModal}
          onAccept={() => selectedOrder && void handleConnect(selectedOrder)}
          onReject={(reason) =>
            selectedOrder ? handleReject(selectedOrder, reason) : Promise.resolve()
          }
        />

        <RejectionReasonDialog
          open={rejectionReasonOrder != null}
          order={rejectionReasonOrder}
          onClose={() => setRejectionReasonOrder(null)}
        />

        <ReceiverNewOrderModal
          open={orderFormModalOpen}
          onClose={() => setOrderFormModalOpen(false)}
          onCreated={(order) => {
            setOrders((prev) => [order, ...prev]);
          }}
          onMessage={showMessage}
        />

        {selectedOrder && (
          <div className="space-y-4">
            {isOrderRouteSelectionBlocked(selectedOrder) && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="py-4 text-sm text-muted-foreground">
                  {isRejected(selectedOrder)
                    ? isSender
                      ? "You rejected this shipment request."
                      : "The sender rejected this shipment request."
                    : "A transporter rejected the selected route. Route comparison and selection are no longer available."}
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Package details · {shipmentRef(selectedOrder.id)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <OrderPackageEditor
                  order={selectedOrder}
                  canEdit={isSender && !isAwaitingConnect(selectedOrder)}
                  onUpdated={(updated) => {
                    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
                  }}
                  onCostsRecalculated={() => setCostRefreshKey((k) => k + 1)}
                  onMessage={(text, type) => showMessage(text, type)}
                />
              </CardContent>
            </Card>
            {selectedOrder.selected_route_id && selectedOrder.selected_route_segments && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Shipment distance</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Total:{" "}
                    <span className="font-medium text-foreground">
                      {formatDistanceKm(selectedOrder.selected_route_total_distance_km)}
                    </span>{" "}
                    · Sea {formatDistanceKm(selectedOrder.selected_route_method_distance_km?.sea ?? 0)} · Air{" "}
                    {formatDistanceKm(selectedOrder.selected_route_method_distance_km?.air ?? 0)}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedOrder.selected_route_segments.map((segment) => (
                      <div
                        key={`${segment.route_id}-${segment.segment_index}-${segment.transport_method}-${segment.from_label}-${segment.to_label}`}
                        className="rounded-md border border-border/70 px-3 py-2 text-sm"
                      >
                        <p className="font-medium">
                          Segment {segment.segment_index + 1}: {segment.from_label} → {segment.to_label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {segment.transport_method.toUpperCase()} · {formatDistanceKm(segment.distance_km)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {!isAwaitingConnect(selectedOrder) && !isOrderRouteSelectionBlocked(selectedOrder) && (
              <>
                <OrderPossibleRoutes
                  order={selectedOrder}
                  refreshSignal={costRefreshKey}
                  onMessage={showMessage}
                />
                {(isReceiver || isSender) && (
                  <RouteCostComparison
                    orderId={selectedOrder.id}
                    order={selectedOrder}
                    onOrderUpdated={(updated) => {
                      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
                    }}
                    refreshSignal={costRefreshKey}
                    onMessage={showMessage}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function formatDistanceKm(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 100) / 100;
  return `${rounded.toLocaleString()} km`;
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            {icon}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold tracking-tight">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
