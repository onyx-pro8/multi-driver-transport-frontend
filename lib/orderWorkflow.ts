import { isPffPaymentMethod } from "@/lib/paymentFlow";
import type { Order } from "@/types";

export type OrderWorkflowFilter =
  | "awaiting_review"
  | "payment_transport"
  | "goods_transporter"
  | "rejected"
  | "delivered";

export const ORDER_WORKFLOW_FILTERS: {
  id: OrderWorkflowFilter;
  label: string;
  /** Compact label for dashboard charts. */
  shortLabel: string;
}[] = [
  { id: "awaiting_review", label: "Submitted, waiting review", shortLabel: "Submitted" },
  { id: "payment_transport", label: "Payment transport", shortLabel: "Payment" },
  { id: "goods_transporter", label: "Goods transporter", shortLabel: "Goods" },
  { id: "rejected", label: "Rejected", shortLabel: "Rejected" },
  { id: "delivered", label: "Delivered", shortLabel: "Delivered" },
];

export function orderMatchesWorkflowFilter(
  order: Order,
  filter: OrderWorkflowFilter
): boolean {
  switch (filter) {
    case "awaiting_review":
      return order.tracking_status === "AWAITING_CONNECT";
    case "rejected":
      return (
        order.tracking_status === "REJECTED" ||
        order.route_selection_status === "rejected" ||
        order.payment_route_selection_status === "rejected" ||
        order.goods_route_selection_status === "rejected"
      );
    case "delivered":
      return order.tracking_status === "DELIVERED" || order.status === "received";
    case "payment_transport": {
      if (!isPffPaymentMethod(order.payment_method)) return false;
      if (order.tracking_status === "AWAITING_CONNECT") return false;
      if (order.tracking_status === "REJECTED" || order.tracking_status === "DELIVERED") {
        return false;
      }
      const paymentPending =
        !order.payment_selected_route_id ||
        order.payment_route_selection_status !== "confirmed";
      const inPaymentLeg =
        order.tracking_status === "PICKUP_AVAILABLE" ||
        order.tracking_status === "PICKED_UP" ||
        order.tracking_status === "IN_TRANSIT" ||
        order.tracking_status === "CONFIRMED" ||
        order.tracking_status === "ROUTES_READY";
      return (
        paymentPending ||
        (inPaymentLeg && order.tracking_status !== "PAYMENT_DELIVERED" && !order.goods_ready_at)
      );
    }
    case "goods_transporter": {
      if (order.tracking_status === "AWAITING_CONNECT" || order.tracking_status === "REJECTED") {
        return false;
      }
      if (order.tracking_status === "DELIVERED") return false;
      if (isPffPaymentMethod(order.payment_method)) {
        return (
          order.tracking_status === "PAYMENT_DELIVERED" ||
          Boolean(order.goods_ready_at) ||
          order.goods_route_selection_status === "pending" ||
          order.goods_route_selection_status === "partially_confirmed" ||
          Boolean(order.goods_selected_route_id)
        );
      }
      return (
        Boolean(order.selected_route_id) ||
        order.tracking_status === "ROUTES_READY" ||
        order.tracking_status === "CONFIRMED" ||
        order.tracking_status === "PICKUP_AVAILABLE" ||
        order.tracking_status === "PICKED_UP" ||
        order.tracking_status === "IN_TRANSIT"
      );
    }
    default:
      return true;
  }
}

export function isActivelyDelivering(order: Order): boolean {
  if (order.tracking_status === "REJECTED" || order.tracking_status === "DELIVERED") {
    return false;
  }
  if (order.tracking_status === "AWAITING_CONNECT") return false;
  return (
    order.status === "delivering" ||
    order.tracking_status === "PICKUP_AVAILABLE" ||
    order.tracking_status === "PICKED_UP" ||
    order.tracking_status === "IN_TRANSIT" ||
    order.tracking_status === "PAYMENT_DELIVERED" ||
    (order.route_selection_status === "confirmed" && Boolean(order.pickup_ready_at))
  );
}

/** Most recently updated order that is currently in delivery. */
export function latestDeliveringOrder(orders: Order[]): Order | null {
  const active = orders.filter(isActivelyDelivering);
  if (active.length === 0) return null;
  return [...active].sort((a, b) => {
    const aTime = Date.parse(a.updated_at || a.delivering_at || a.submitted_at);
    const bTime = Date.parse(b.updated_at || b.delivering_at || b.submitted_at);
    return bTime - aTime;
  })[0];
}

export function formatPackageWeight(order: Order): string {
  if (order.weight_lbs != null && Number.isFinite(order.weight_lbs)) {
    return `${order.weight_lbs} ${order.package_weight_unit || "lbs"}`;
  }
  return "—";
}

export function formatPackageDimensions(order: Order): string {
  if (order.dimensions?.trim()) return order.dimensions.trim();
  const { package_length: l, package_width: w, package_height: h } = order;
  if (l != null && w != null && h != null) {
    return `${l} × ${w} × ${h} ${order.package_dimension_unit || "in"}`;
  }
  return "—";
}
