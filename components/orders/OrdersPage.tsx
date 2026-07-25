"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  Clock,
  Package,
  Plus,
  Route,
  Send,
  X,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  listOrders,
  connectOrder,
  rejectOrder,
  notifyPaymentPickedUpToSender,
  updateOrderTrackingStatus,
} from "@/lib/api";
import { showToast } from "@/lib/toast";
import {
  canMarkDelivered,
  canMarkPickReady,
  canReceiverMarkPickReadyForPff,
  canReceiverNotifyPaymentPickedUp,
  canSenderMarkGoodsReadyForPff,
} from "@/lib/trackingActions";
import { cn, formatDate } from "@/lib/utils";
import {
  ORDER_WORKFLOW_FILTERS,
  orderMatchesWorkflowFilter,
  type OrderWorkflowFilter,
} from "@/lib/orderWorkflow";
import type { Order, TrackingStatus } from "@/types";
import { ReceiverNewOrderModal } from "./ReceiverNewOrderModal";
import { InquiryReviewPanel } from "@/components/orders/InquiryReviewPanel";
import { RejectionReasonDialog } from "@/components/orders/RejectionReasonDialog";
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";
import { RouteStatusBadge, TrackingStatusBadge } from "@/components/orders/RouteStatusBadge";

type SortKey = "submitted_at" | "updated_at";
type SortDir = "asc" | "desc";

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
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [orderFormModalOpen, setOrderFormModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<OrderWorkflowFilter[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [sortKey, setSortKey] = useState<SortKey>("submitted_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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
    if (!Number.isFinite(id)) return;
    setSelectedOrderId(id);
    setDetailModalOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (!filterOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [filterOpen]);

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
      if (!o.selected_route_id && !o.goods_selected_route_id && !o.payment_selected_route_id) {
        c.noRoute += 1;
      } else if (
        o.route_selection_status === "confirmed" ||
        (o.goods_route_selection_status === "confirmed" &&
          (!o.payment_selected_route_id || o.payment_route_selection_status === "confirmed"))
      ) {
        c.confirmed += 1;
      } else if (
        o.route_selection_status === "rejected" ||
        o.goods_route_selection_status === "rejected" ||
        o.payment_route_selection_status === "rejected"
      ) {
        c.rejected += 1;
      } else {
        c.pending += 1;
      }
    });
    return c;
  }, [orders]);

  const displayedOrders = useMemo(() => {
    let list =
      activeFilters.length === 0
        ? [...orders]
        : orders.filter((o) =>
            activeFilters.some((f) => orderMatchesWorkflowFilter(o, f))
          );

    list.sort((a, b) => {
      const aTime = Date.parse(a[sortKey] || a.submitted_at);
      const bTime = Date.parse(b[sortKey] || b.submitted_at);
      const cmp = aTime - bTime;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [orders, activeFilters, sortKey, sortDir]);

  const selectedOrder = useMemo(
    () => (selectedOrderId == null ? null : orders.find((o) => o.id === selectedOrderId) ?? null),
    [selectedOrderId, orders]
  );

  function toggleFilter(id: OrderWorkflowFilter) {
    setActiveFilters((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }

  function handleSortClick(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function handleRowClick(order: Order) {
    setSelectedOrderId(order.id);
    if (isSender && isAwaitingConnect(order)) {
      setReviewModalOpen(true);
      setDetailModalOpen(false);
    } else {
      setDetailModalOpen(true);
      setReviewModalOpen(false);
    }
  }

  function openReviewModal(order: Order) {
    setSelectedOrderId(order.id);
    setReviewModalOpen(true);
    setDetailModalOpen(false);
  }

  function closeReviewModal() {
    if (connecting != null || rejecting != null) return;
    setReviewModalOpen(false);
  }

  function closeDetailModal() {
    setDetailModalOpen(false);
  }

  async function handleConnect(order: Order) {
    setConnecting(order.id);
    try {
      const { route_recalc_warning, ...updated } = await connectOrder(order.id);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setReviewModalOpen(false);
      showMessage("Shipment connected. Open Routes to compare paths.");
      if (route_recalc_warning) showMessage(route_recalc_warning, "error");
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Failed to connect shipment", "error");
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
      const result = await notifyPaymentPickedUpToSender(order.id);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? {
                ...o,
                tracking_status: result.tracking_status,
                payment_pickup_notified_at: new Date().toISOString(),
              }
            : o
        )
      );
      showMessage("Producer notified that payment was picked up.");
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Notify failed", "error");
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
          ? "Pickup marked available."
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
            <StatTile
              icon={<Send className="h-5 w-5" />}
              label="Awaiting connect"
              value={counts.awaitingConnect}
            />
          )}
          <StatTile
            icon={<Route className="h-5 w-5" />}
            label="No route selected"
            value={counts.noRoute}
          />
          <StatTile
            icon={<Clock className="h-5 w-5" />}
            label="Awaiting confirmation"
            value={counts.pending}
          />
          <StatTile
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Route confirmed"
            value={counts.confirmed}
          />
          <StatTile
            icon={<XCircle className="h-5 w-5" />}
            label="Route rejected"
            value={counts.rejected}
          />
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
                  Submit a request to a sender. They review it before routes are built.
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

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                {isSender ? "Your shipments" : "Shipments to you"}
              </CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative" ref={filterRef}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFilterOpen((o) => !o)}
                >
                  Filter
                  {activeFilters.length > 0 && (
                    <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                      {activeFilters.length}
                    </span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 ml-1" />
                </Button>
                {filterOpen && (
                  <div className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-border bg-card p-2 shadow-lg">
                    {ORDER_WORKFLOW_FILTERS.map((f) => {
                      const checked = activeFilters.includes(f.id);
                      return (
                        <label
                          key={f.id}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                        >
                          <Checkbox
                            checked={checked}
                            onChange={() => toggleFilter(f.id)}
                          />
                          <span>{f.label}</span>
                        </label>
                      );
                    })}
                    {activeFilters.length > 0 && (
                      <button
                        type="button"
                        className="mt-1 flex w-full items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/60"
                        onClick={() => setActiveFilters([])}
                      >
                        <X className="h-3 w-3" />
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </div>
              {isReceiver && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOrderFormModalOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  New request
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {initialLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : displayedOrders.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Package className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {orders.length === 0 ? "No shipments yet" : "No matching shipments"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {orders.length === 0
                      ? isReceiver
                        ? "Start by submitting your first shipment request."
                        : "Incoming shipment requests will appear here."
                      : "Try clearing or changing the workflow filters."}
                  </p>
                </div>
                {isReceiver && orders.length === 0 && (
                  <Button type="button" size="sm" onClick={() => setOrderFormModalOpen(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    New shipment request
                  </Button>
                )}
              </div>
            ) : (
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-3 pr-4 font-medium">Number</th>
                    <th className="py-3 pr-4 font-medium">
                      {isSender ? "Receiver" : "Sender"}
                    </th>
                    <th className="py-3 pr-4 font-medium">Phone</th>
                    <th className="py-3 pr-4 font-medium">Status (Route)</th>
                    <th className="py-3 pr-4 font-medium">Status (Delivery)</th>
                    <SortableTh
                      label="Submit Date"
                      active={sortKey === "submitted_at"}
                      dir={sortDir}
                      onClick={() => handleSortClick("submitted_at")}
                    />
                    <SortableTh
                      label="Update Date"
                      active={sortKey === "updated_at"}
                      dir={sortDir}
                      onClick={() => handleSortClick("updated_at")}
                    />
                    <th className="py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedOrders.map((order) => {
                    const counterparty = isSender ? order.receiver_name : order.sender_name;
                    const counterpartyPhone = isSender
                      ? order.receiver_phone
                      : order.sender_phone;
                    const isSelected =
                      selectedOrderId === order.id && (detailModalOpen || reviewModalOpen);
                    const hasRoute = Boolean(
                      order.selected_route_id ||
                        order.goods_selected_route_id ||
                        order.payment_selected_route_id
                    );
                    return (
                      <tr
                        key={order.id}
                        onClick={() => handleRowClick(order)}
                        className={cn(
                          "border-b border-border/70 last:border-0 cursor-pointer transition-colors",
                          isSelected ? "bg-primary/5" : "hover:bg-muted/50"
                        )}
                      >
                        <td className="py-3 pr-4 font-mono text-xs">{order.id}</td>
                        <td className="py-3 pr-4 font-medium">{counterparty}</td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {counterpartyPhone || "—"}
                        </td>
                        <td className="py-3 pr-4">
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
                        </td>
                        <td className="py-3 pr-4">
                          {isRejected(order) ? (
                            <span className="text-xs text-muted-foreground">Rejected</span>
                          ) : isAwaitingConnect(order) ? (
                            <span className="text-xs text-muted-foreground">Not started</span>
                          ) : order.route_selection_status === "confirmed" ||
                            order.goods_route_selection_status === "confirmed" ? (
                            <TrackingStatusBadge status={order.tracking_status} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {formatDate(order.submitted_at)}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {formatDate(order.updated_at)}
                        </td>
                        <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
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
                                onClick={() =>
                                  void handleTrackingAction(order, "PICKUP_AVAILABLE")
                                }
                              >
                                {updating === order.id ? "Updating…" : "Pick ready"}
                              </Button>
                            )}
                            {isReceiver && canReceiverMarkPickReadyForPff(order) && (
                              <Button
                                size="sm"
                                disabled={updating === order.id}
                                onClick={() =>
                                  void handleTrackingAction(order, "PICKUP_AVAILABLE")
                                }
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
                                onClick={() =>
                                  void handleTrackingAction(order, "PICKUP_AVAILABLE")
                                }
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
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedOrderId(order.id);
                                setDetailModalOpen(true);
                              }}
                            >
                              Details
                            </Button>
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

        <OrderDetailModal
          open={detailModalOpen && selectedOrder != null}
          order={selectedOrder}
          canEditPackage={
            isSender && selectedOrder != null && !isAwaitingConnect(selectedOrder)
          }
          viewerRole={user?.role}
          counterpartyLabel={
            selectedOrder
              ? isSender
                ? `Receiver: ${selectedOrder.receiver_name}`
                : `Sender: ${selectedOrder.sender_name}`
              : ""
          }
          onClose={closeDetailModal}
          onUpdated={(updated) => {
            setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
          }}
          onMessage={showMessage}
        />
      </div>
    </>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className="py-3 pr-4 font-medium">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        <Icon className="h-3.5 w-3.5" />
      </button>
    </th>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
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
