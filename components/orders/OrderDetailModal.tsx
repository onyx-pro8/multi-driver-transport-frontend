"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shipmentRef } from "@/lib/entityLabels";
import { paymentMethodLabel } from "@/lib/paymentFlow";
import { formatDate } from "@/lib/utils";
import type { Order } from "@/types";
import { OrderPackageEditor } from "@/components/orders/OrderPackageEditor";
import { TrackingStatusBadge } from "@/components/orders/RouteStatusBadge";

interface Props {
  open: boolean;
  order: Order | null;
  canEditPackage: boolean;
  counterpartyLabel: string;
  onClose: () => void;
  onUpdated?: (order: Order) => void;
  onMessage?: (text: string, type?: "success" | "error") => void;
}

export function OrderDetailModal({
  open,
  order,
  canEditPackage,
  counterpartyLabel,
  onClose,
  onUpdated,
  onMessage,
}: Props) {
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

  if (!open || !order || !mounted) return null;

  const isRejected = order.tracking_status === "REJECTED";

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
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
      <div className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 space-y-1">
            <h2 id="order-detail-title" className="text-base font-semibold">
              {shipmentRef(order.id)}
            </h2>
            <p className="text-xs text-muted-foreground">
              {counterpartyLabel} · Submitted {formatDate(order.submitted_at)}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {isRejected && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-muted-foreground">
              This shipment request was rejected by the sender.
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Payment method</p>
              <p className="mt-1 text-sm font-medium">{paymentMethodLabel(order.payment_method)}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Delivery status</p>
              <div className="mt-1">
                {isRejected ? (
                  <TrackingStatusBadge status="REJECTED" />
                ) : (
                  <TrackingStatusBadge status={order.tracking_status} />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2 rounded-lg border border-border/70 px-3 py-2.5">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">From</p>
                <p className="font-medium">{order.sender_address || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-border/70 px-3 py-2.5">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">To</p>
                <p className="font-medium">{order.destination_address || "—"}</p>
              </div>
            </div>
          </div>

          {(order.package_description?.trim() || order.notes?.trim()) && (
            <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="mt-1 text-sm whitespace-pre-wrap">
                {order.package_description?.trim() || order.notes?.trim()}
              </p>
            </div>
          )}

          <div className="rounded-lg border border-border/70 px-3 py-3">
            <p className="mb-3 text-sm font-medium">Package details</p>
            <OrderPackageEditor
              order={order}
              canEdit={canEditPackage}
              onUpdated={onUpdated}
              onMessage={onMessage}
            />
          </div>

          {order.selected_route_id && order.selected_route_segments && (
            <div className="rounded-lg border border-border/70 px-3 py-3">
              <p className="text-sm font-medium">Selected route distance</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Total {formatDistanceKm(order.selected_route_total_distance_km)} · Sea{" "}
                {formatDistanceKm(order.selected_route_method_distance_km?.sea ?? 0)} · Air{" "}
                {formatDistanceKm(order.selected_route_method_distance_km?.air ?? 0)}
              </p>
              <div className="mt-3 space-y-2">
                {order.selected_route_segments.map((segment) => (
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
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-border px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function formatDistanceKm(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 100) / 100;
  return `${rounded.toLocaleString()} km`;
}
