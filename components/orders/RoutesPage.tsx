"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, MapPin, Package, Route as RouteIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusBadges } from "@/components/orders/OrderStatusBadges";
import { connectOrder, listOrders, rejectOrder } from "@/lib/api";
import { getShipmentEntityLabels, shipmentRef } from "@/lib/entityLabels";
import { showToast } from "@/lib/toast";
import { cn, formatDate } from "@/lib/utils";
import { isPffPaymentMethod } from "@/lib/paymentFlow";
import type { Order } from "@/types";
import { RouteCostComparison } from "@/components/orders/RouteCostComparison";
import { OrderPossibleRoutes } from "@/components/orders/OrderPossibleRoutes";
import { InquiryReviewPanel } from "@/components/orders/InquiryReviewPanel";
import { RoutesAnnounceCard } from "@/components/orders/RoutesAnnounceCard";

export function RoutesPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const isSender = user?.role === "sender" || user?.role === "admin";
  const isDriver = user?.role === "driver";
  const isReceiver = user?.role === "receiver" || user?.role === "admin";
  const entity = getShipmentEntityLabels();
  const entityLabel = entity.lowercase;
  const EntityLabel = entity.capitalized;

  const [orders, setOrders] = useState<Order[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const hasOrdersRef = useRef(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [costRefreshKey, setCostRefreshKey] = useState(0);
  const [announceRefreshKey, setAnnounceRefreshKey] = useState(0);
  const [connecting, setConnecting] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [highlightedZoneIds, setHighlightedZoneIds] = useState<number[] | null>(
    null,
  );
  const [highlightedPurpose, setHighlightedPurpose] = useState<
    "payment" | "goods" | null
  >(null);

  const isAwaitingConnect = (order: Order) => order.tracking_status === "AWAITING_CONNECT";
  const isRejected = (order: Order) => order.tracking_status === "REJECTED";

  const refresh = useCallback(async (silent = false) => {
    if (!silent && !hasOrdersRef.current) {
      setInitialLoading(true);
    }
    try {
      const data = await listOrders();
      setOrders(data);
      hasOrdersRef.current = data.length > 0;
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : `Failed to load ${entityLabel}s`,
        "error"
      );
    } finally {
      setInitialLoading(false);
    }
  }, [entityLabel]);

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  // Deep-link: /routes?orderId=5
  useEffect(() => {
    const raw = searchParams.get("orderId");
    if (!raw) return;
    const id = Number(raw);
    if (Number.isFinite(id)) setSelectedOrderId(id);
  }, [searchParams]);

  // Auto-select the first order when none is chosen yet.
  useEffect(() => {
    if (selectedOrderId != null || orders.length === 0) return;
    setSelectedOrderId(orders[0].id);
  }, [orders, selectedOrderId]);

  // Clear map highlight when switching shipments.
  useEffect(() => {
    setHighlightedZoneIds(null);
    setHighlightedPurpose(null);
  }, [selectedOrderId]);

  const selectedOrder = useMemo(
    () =>
      selectedOrderId == null ? null : orders.find((o) => o.id === selectedOrderId) ?? null,
    [selectedOrderId, orders]
  );

  const selectedIsPff = isPffPaymentMethod(selectedOrder?.payment_method);
  const showPaymentMap =
    selectedIsPff && (isReceiver || isDriver);
  const showGoodsMap =
    !selectedIsPff || isSender || isDriver;

  const showMessage = useCallback((text: string, type: "success" | "error" = "success") => {
    showToast(text, type);
  }, []);

  function handleHighlightRoute(
    zoneIds: number[] | null,
    purpose?: "payment" | "goods" | null,
  ) {
    setHighlightedZoneIds(zoneIds);
    setHighlightedPurpose(zoneIds ? purpose ?? null : null);
  }

  function mapPreview(purpose?: "payment" | "goods") {
    if (!selectedOrder || isAwaitingConnect(selectedOrder)) return null;
    const activeHighlight =
      purpose == null || highlightedPurpose == null
        ? highlightedZoneIds
        : highlightedPurpose === purpose
          ? highlightedZoneIds
          : null;
    return (
      <OrderPossibleRoutes
        order={selectedOrder}
        refreshSignal={costRefreshKey}
        onMessage={showMessage}
        hidePathList
        purpose={purpose}
        highlightedZoneIds={activeHighlight}
        onClearHighlight={() => {
          setHighlightedZoneIds(null);
          setHighlightedPurpose(null);
        }}
      />
    );
  }

  function selectOrder(order: Order) {
    setSelectedOrderId(order.id);
    if (isSender && isAwaitingConnect(order)) {
      setReviewModalOpen(true);
    } else {
      setReviewModalOpen(false);
    }
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
      setReviewModalOpen(false);
      setCostRefreshKey((k) => k + 1);
      showToast("Shipment connected. Compare routes below.", "success");
      if (route_recalc_warning) {
        showToast(route_recalc_warning, "error");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to connect shipment", "error");
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
      showToast("Shipment request rejected.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to reject shipment", "error");
      throw err;
    } finally {
      setRejecting(null);
    }
  }

  return (
    <>
      <div className="px-6 pb-8">
        <div className="grid gap-4 lg:grid-cols-[minmax(18rem,20rem)_minmax(0,1fr)] lg:items-start xl:grid-cols-[minmax(24rem,28rem)_minmax(0,1fr)]">
          {/* Left: shipment list — single column with its own scroll */}
          <Card className="flex w-full min-w-0 shrink-0 flex-col overflow-hidden self-start lg:sticky lg:top-0 lg:max-h-[calc(100vh-5rem)]">
            <CardHeader className="shrink-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <RouteIcon className="h-4 w-4" />
                Select {entity.indefiniteArticle} {EntityLabel}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {isDriver
                  ? "Pick a shipment to view routes and enter quotes for your segments."
                  : "Pick a shipment to compare possible delivery routes by estimated cost."}
              </p>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto pb-4">
              {initialLoading ? (
                <div className="py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading {entityLabel}s…
                </div>
              ) : orders.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">No {entityLabel}s yet.</p>
                  {isSender && (
                    <Link
                      href="/orders"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Package className="h-4 w-4" />
                      View shipments on Orders
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {orders.map((order) => {
                    const isSelected = selectedOrderId === order.id;
                    const counterparty = isSender
                      ? order.receiver_name
                      : isDriver
                        ? `${order.sender_name} → ${order.receiver_name}`
                        : order.sender_name;
                    return (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => selectOrder(order)}
                        className={cn(
                          "rounded-xl border p-3 text-left transition-colors",
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "border-border hover:bg-muted/50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{shipmentRef(order.id)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {isSender ? "To" : isDriver ? "Route" : "From"}: {counterparty}
                            </p>
                          </div>
                          <OrderStatusBadges order={order} compact />
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          <p className="flex items-start gap-1.5">
                            <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                            <span className="line-clamp-1">{order.sender_address || "—"}</span>
                          </p>
                          <p className="flex items-start gap-1.5">
                            <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-primary" />
                            <span className="line-clamp-1">{order.destination_address || "—"}</span>
                          </p>
                        </div>
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          {formatDate(order.created_at)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: announce + map + cost comparison — top aligns with left card */}
          <div className="min-w-0 self-start space-y-3">
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

            {selectedOrder ? (
              isRejected(selectedOrder) ? (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    This shipment request was rejected by the sender.
                  </CardContent>
                </Card>
              ) : (
                <>
                  <RoutesAnnounceCard
                    order={selectedOrder}
                    refreshSignal={costRefreshKey + announceRefreshKey}
                    onOrderUpdated={(updated) => {
                      setOrders((prev) =>
                        prev.map((o) => (o.id === updated.id ? updated : o)),
                      );
                    }}
                    onMessage={showMessage}
                  />
                  <RouteCostComparison
                    orderId={selectedOrder.id}
                    order={selectedOrder}
                    onOrderUpdated={(updated) => {
                      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
                    }}
                    refreshSignal={costRefreshKey}
                    onMessage={showMessage}
                    onHighlightRoute={handleHighlightRoute}
                    highlightedZoneIds={highlightedZoneIds}
                    onRouteSelectionChanged={() =>
                      setAnnounceRefreshKey((k) => k + 1)
                    }
                    paymentMapSlot={
                      selectedIsPff && showPaymentMap
                        ? mapPreview("payment")
                        : undefined
                    }
                    goodsMapSlot={
                      selectedIsPff && showGoodsMap
                        ? mapPreview("goods")
                        : undefined
                    }
                    mapSlot={
                      !selectedIsPff && showGoodsMap
                        ? mapPreview()
                        : undefined
                    }
                  />
                </>
              )
            ) : !initialLoading && orders.length > 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Select {entity.indefiniteArticle} {entityLabel} to view route cost comparison.
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
