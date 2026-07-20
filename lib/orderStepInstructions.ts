import {
  canMarkDelivered,
  canMarkPickReady,
  canReceiverMarkPickReadyForPff,
  canReceiverNotifyPaymentPickedUp,
  canSenderMarkGoodsReadyForPff,
} from "@/lib/trackingActions";
import { isPffPaymentMethod } from "@/lib/paymentFlow";
import type { TrackingStatus } from "@/types";

export type OrderInstructionRole = "receiver" | "sender" | "driver" | "admin";

export type WorkflowStepId =
  | "awaiting_connect"
  | "select_route"
  | "transporter_confirm"
  | "confirmed"
  | "pick_ready"
  | "picked_up"
  | "in_transit"
  | "payment_delivered"
  | "goods_ready"
  | "delivered"
  | "rejected";

export interface OrderLikeForInstructions {
  tracking_status: TrackingStatus | string;
  payment_method?: string | null;
  route_selection_status?: string | null;
  selected_route_id?: number | null;
  selected_route_label?: string | null;
  pickup_ready_at?: string | null;
  goods_ready_at?: string | null;
  payment_pickup_notified_at?: string | null;
  payment_route_selection_status?: string | null;
  goods_route_selection_status?: string | null;
  payment_selected_route_id?: number | null;
  goods_selected_route_id?: number | null;
  receiver_name?: string | null;
  sender_name?: string | null;
}

export interface StepInstructionDetail {
  id: WorkflowStepId;
  label: string;
  /** Detailed description when browsing a step on the tracking stepper. */
  explanations: string[];
}

export interface OrderStepGuidance {
  currentStepId: WorkflowStepId;
  stepLabel: string;
  /** Plain-language description of where the order is now. */
  currentStatus: string;
  /** Plain-language description of what should happen next, and where. */
  nextStatus: string;
  /**
   * Urgency callout for the signed-in user — shown in red when they must act.
   * Null when no action is required from them right now.
   */
  waitingForYou: string | null;
}

const STEP_DETAILS: Record<WorkflowStepId, StepInstructionDetail> = {
  awaiting_connect: {
    id: "awaiting_connect",
    label: "Awaiting connect",
    explanations: [
      "The receiver created this shipment request.",
      "The sender must review and accept it before any routes can be built.",
      "Transporters are not involved until the order is accepted.",
    ],
  },
  select_route: {
    id: "select_route",
    label: "Select preferred route",
    explanations: [
      "The sender has accepted the order.",
      "Available multi-transporter routes and costs can be compared on the Routes page.",
      "For PFF (advanced payment), a payment route and a goods route are chosen separately.",
    ],
  },
  transporter_confirm: {
    id: "transporter_confirm",
    label: "Transporter confirmation",
    explanations: [
      "A preferred route has been selected.",
      "Each transporter on that route must accept their segment.",
      "Delivery tracking does not start until every segment is accepted.",
    ],
  },
  confirmed: {
    id: "confirmed",
    label: "Route confirmed",
    explanations: [
      "All transporters accepted the selected route.",
      "The package is not moving yet — someone must send a pickup request first.",
      "On standard orders the sender marks pick ready; on PFF the receiver marks payment pickup available.",
    ],
  },
  pick_ready: {
    id: "pick_ready",
    label: "Pick ready",
    explanations: [
      "Pickup is available, so transporters may collect the package.",
      "The first transporter on the route should mark their segment as picked up.",
      "Progress continues on the Tracking page as each segment updates.",
    ],
  },
  picked_up: {
    id: "picked_up",
    label: "Picked up",
    explanations: [
      "The first transporter collected the package (or payment package on PFF).",
      "Later transporters mark their leg in transit as the chain continues.",
      "Follow handoffs on the Tracking page map.",
    ],
  },
  in_transit: {
    id: "in_transit",
    label: "In transit",
    explanations: [
      "The shipment is moving through the multi-transporter chain.",
      "Each segment hands off to the next covering zone.",
      "When it arrives, the receiver confirms delivery on the Orders page.",
    ],
  },
  payment_delivered: {
    id: "payment_delivered",
    label: "Payment delivered",
    explanations: [
      "Payment reached the producer (sender) on the PFF payment route.",
      "The sender must mark goods ready before the return goods route can start.",
      "Goods transporters wait until goods are marked ready.",
    ],
  },
  goods_ready: {
    id: "goods_ready",
    label: "Goods ready",
    explanations: [
      "The producer marked the goods package ready for return pickup.",
      "Goods-route transporters can now pick up and deliver to the receiver.",
    ],
  },
  delivered: {
    id: "delivered",
    label: "Delivered",
    explanations: [
      "Shipment completed — the package was received by the receiver.",
      "No further delivery actions are required.",
    ],
  },
  rejected: {
    id: "rejected",
    label: "Rejected",
    explanations: [
      "The sender rejected this shipment request.",
      "Routes and delivery tracking do not apply to rejected orders.",
    ],
  },
};

export function getStepInstructionDetail(stepId: WorkflowStepId): StepInstructionDetail {
  return STEP_DETAILS[stepId];
}

function normalizeRole(role: OrderInstructionRole | string | undefined): OrderInstructionRole {
  if (role === "receiver" || role === "sender" || role === "driver" || role === "admin") {
    return role;
  }
  return "receiver";
}

function partyName(name: string | null | undefined, fallback: string): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed : fallback;
}

function isRouteFullyConfirmed(order: OrderLikeForInstructions, isPff: boolean): boolean {
  if (isPff) {
    return (
      order.payment_route_selection_status === "confirmed" &&
      order.goods_route_selection_status === "confirmed"
    );
  }
  return order.route_selection_status === "confirmed";
}

function isRouteSelectionRejected(order: OrderLikeForInstructions, isPff: boolean): boolean {
  if (isPff) {
    const paymentRejected = order.payment_route_selection_status === "rejected";
    const goodsRejected = order.goods_route_selection_status === "rejected";
    // Either leg rejected means that leg must be reselected before confirmation can continue.
    return paymentRejected || goodsRejected;
  }
  return order.route_selection_status === "rejected";
}

function hasAnyRouteSelected(order: OrderLikeForInstructions, isPff: boolean): boolean {
  if (isPff) {
    return Boolean(
      order.payment_selected_route_id || order.goods_selected_route_id || order.selected_route_id
    );
  }
  return Boolean(order.selected_route_id);
}

function deriveCurrentStepId(order: OrderLikeForInstructions, isPff: boolean): WorkflowStepId {
  const status = order.tracking_status;

  if (status === "REJECTED") return "rejected";
  if (status === "AWAITING_CONNECT") return "awaiting_connect";
  if (status === "DELIVERED") return "delivered";

  if (status === "PAYMENT_DELIVERED") {
    return order.goods_ready_at ? "goods_ready" : "payment_delivered";
  }

  if (status === "IN_TRANSIT") return "in_transit";
  if (status === "PICKED_UP") return "picked_up";
  if (status === "PICKUP_AVAILABLE") return "pick_ready";

  const routeConfirmed = isRouteFullyConfirmed(order, isPff);
  if (routeConfirmed) {
    if (!order.pickup_ready_at) return "confirmed";
    return "pick_ready";
  }

  // After a transporter rejects a route, send sender/receiver back to route selection
  // instead of leaving them stuck on transporter confirmation.
  if (isRouteSelectionRejected(order, isPff)) {
    return "select_route";
  }

  if (hasAnyRouteSelected(order, isPff) || status === "ROUTES_IN_PROGRESS") {
    return "transporter_confirm";
  }

  if (status === "ROUTES_READY") {
    return order.pickup_ready_at ? "pick_ready" : "confirmed";
  }

  if (status === "CONFIRMED") {
    return "select_route";
  }

  return "select_route";
}

function actionOrder(order: OrderLikeForInstructions) {
  return {
    ...order,
    tracking_status: String(order.tracking_status),
    payment_method: order.payment_method ?? undefined,
  };
}

function buildCurrentAndNext(
  order: OrderLikeForInstructions,
  role: OrderInstructionRole,
  isPff: boolean,
  stepId: WorkflowStepId
): Pick<OrderStepGuidance, "currentStatus" | "nextStatus" | "waitingForYou"> {
  const receiver = partyName(order.receiver_name, "Receiver");
  const sender = partyName(order.sender_name, "Sender");
  const gates = actionOrder(order);
  const r = role === "admin" ? null : role;

  switch (stepId) {
    case "rejected":
      return {
        currentStatus: `The sender (${sender}) rejected this shipment request from ${receiver}. No delivery will run for this order.`,
        nextStatus:
          "No next step. The receiver can create a new shipment request on the Orders page if needed.",
        waitingForYou: null,
      };

    case "awaiting_connect":
      return {
        currentStatus: `The receiver (${receiver}) created the order and is waiting for the sender to accept it.`,
        nextStatus: `The sender (${sender}) should review and accept the ${receiver} order on the Orders page. Until it is accepted, routes cannot be compared or selected.`,
        waitingForYou:
          r === "sender" || role === "admin"
            ? "WAITING FOR YOU TO REVIEW AND ACCEPT THIS ORDER"
            : null,
      };

    case "select_route":
      if (isPff) {
        const paymentRejected = order.payment_route_selection_status === "rejected";
        const goodsRejected = order.goods_route_selection_status === "rejected";
        if (paymentRejected || goodsRejected) {
          return {
            currentStatus: `A transporter rejected ${
              paymentRejected && goodsRejected
                ? "the payment and goods routes"
                : paymentRejected
                  ? "the payment route"
                  : "the goods route"
            } for this PFF shipment.`,
            nextStatus: `${
              paymentRejected
                ? `${receiver} should reselect the payment route`
                : ""
            }${paymentRejected && goodsRejected ? ", and " : ""}${
              goodsRejected
                ? `${sender} should reselect the goods route`
                : ""
            } on the Routes page.`,
            waitingForYou:
              (paymentRejected && (r === "receiver" || role === "admin")) ||
              (goodsRejected && (r === "sender" || role === "admin"))
                ? "WAITING FOR YOU TO RESELECT THE REJECTED ROUTE ON ROUTES PAGE"
                : null,
          };
        }
        return {
          currentStatus: `The sender (${sender}) accepted the order. This is a PFF (advanced payment) shipment, so payment and goods routes still need to be chosen.`,
          nextStatus: `${receiver} should select the payment route, and ${sender} should select the goods route, on the Routes page. Delivery cannot start until both routes are chosen and confirmed.`,
          waitingForYou:
            r === "receiver" || role === "admin"
              ? "WAITING FOR YOU TO SELECT THE PAYMENT ROUTE ON ROUTES PAGE"
              : r === "sender"
                ? "WAITING FOR YOU TO SELECT THE GOODS ROUTE ON ROUTES PAGE"
                : null,
        };
      }
      if (order.route_selection_status === "rejected") {
        return {
          currentStatus: `A transporter rejected the selected route for ${receiver}'s order.`,
          nextStatus: `The sender (${sender}) should open the Routes page and select a different route (or reselect the same one) so transporters can be asked again.`,
          waitingForYou:
            r === "sender" || role === "admin"
              ? "WAITING FOR YOU TO RESELECT A ROUTE ON ROUTES PAGE"
              : null,
        };
      }
      return {
        currentStatus: `The sender (${sender}) accepted the order from ${receiver}. No preferred route has been selected yet.`,
        nextStatus: `The sender (${sender}) should open the Routes page, compare route costs, and select the goods route for this order.`,
        waitingForYou:
          r === "sender" || role === "admin"
            ? "WAITING FOR YOU TO SELECT THE GOODS ROUTE ON ROUTES PAGE"
            : null,
      };

    case "transporter_confirm": {
      const routeHint = order.selected_route_label?.trim()
        ? ` (“${order.selected_route_label.trim()}”)`
        : "";
      return {
        currentStatus: `A preferred route${routeHint} was selected for ${receiver}'s order. Transporter confirmation is still required on one or more segments.`,
        nextStatus:
          "Each transporter on the selected route should open Confirmations (or My shipments) and accept their segment. After every segment is accepted, the route becomes fully confirmed.",
        waitingForYou:
          r === "driver" ? "WAITING FOR YOU TO CONFIRM YOUR SEGMENT" : null,
      };
    }

    case "confirmed":
      if (isPff) {
        return {
          currentStatus: `Both payment and goods routes are confirmed for ${receiver}'s PFF order. Pickup has not been requested yet.`,
          nextStatus: `The receiver (${receiver}) should mark payment pickup available on the Orders page (or Tracking page) so payment-route transporters can collect the payment package.`,
          waitingForYou:
            canReceiverMarkPickReadyForPff(gates) && (r === "receiver" || role === "admin")
              ? "WAITING FOR YOU TO SEND PAYMENT PICKUP REQUEST"
              : null,
        };
      }
      return {
        currentStatus: `All transporters confirmed the route for ${receiver}'s order. The package is ready for a pickup request, but pickup has not been sent yet.`,
        nextStatus: `The sender (${sender}) should mark “Pick ready” on the Orders page when the package is available for the first transporter to collect.`,
        waitingForYou:
          canMarkPickReady(gates) && (r === "sender" || role === "admin")
            ? "WAITING FOR YOU TO SEND PICKUP REQUEST"
            : null,
      };

    case "pick_ready":
      return {
        currentStatus: isPff
          ? `Payment pickup is available for ${receiver}'s order. Transporters on the payment route can collect the payment package.`
          : `Pickup is available for ${receiver}'s order. The first transporter can collect the package from ${sender}.`,
        nextStatus:
          "The first transporter should update their segment to “Picked up” on Confirmations / My shipments. Later transporters then mark their legs in transit.",
        waitingForYou:
          r === "driver" ? "WAITING FOR YOU TO UPDATE YOUR SEGMENT STATUS" : null,
      };

    case "picked_up":
      return {
        currentStatus: isPff
          ? `Payment was picked up and is moving toward ${sender} on the payment route.`
          : `The package was picked up from ${sender} and is moving toward ${receiver}.`,
        nextStatus: isPff
          ? canReceiverNotifyPaymentPickedUp(gates)
            ? `The receiver (${receiver}) should notify the producer that payment was collected (Orders page), then transporters continue until payment is delivered.`
            : "Transporters should keep updating segment status until payment is delivered to the producer."
          : "Transporters should keep updating each segment until the package is in transit to the receiver.",
        waitingForYou:
          canReceiverNotifyPaymentPickedUp(gates) && (r === "receiver" || role === "admin")
            ? "WAITING FOR YOU TO NOTIFY PRODUCER OF PAYMENT PICKUP"
            : r === "driver"
              ? "WAITING FOR YOU TO UPDATE YOUR SEGMENT STATUS"
              : null,
      };

    case "in_transit":
      return {
        currentStatus: isPff
          ? `Payment or goods for ${receiver}'s order are in transit on their confirmed routes.`
          : `The package for ${receiver}'s order is in transit through the multi-transporter chain.`,
        nextStatus: canMarkDelivered(gates)
          ? `The receiver (${receiver}) should confirm “Delivered” on the Orders page (or Tracking page) when the package arrives.`
          : "Continue watching Tracking until the final handoff. The receiver confirms delivery after arrival.",
        waitingForYou:
          canMarkDelivered(gates) && (r === "receiver" || role === "admin")
            ? "WAITING FOR YOU TO CONFIRM DELIVERY"
            : r === "driver"
              ? "WAITING FOR YOU TO UPDATE YOUR SEGMENT STATUS"
              : null,
      };

    case "payment_delivered":
      return {
        currentStatus: `Payment was delivered to the producer (${sender}). Goods for ${receiver} are not ready for return pickup yet.`,
        nextStatus: `The sender (${sender}) should mark “Goods ready” on the Orders page so the goods-route transporters can start the return delivery to ${receiver}.`,
        waitingForYou:
          canSenderMarkGoodsReadyForPff(gates) && (r === "sender" || role === "admin")
            ? "WAITING FOR YOU TO MARK GOODS READY"
            : null,
      };

    case "goods_ready":
      return {
        currentStatus: `Goods are ready at ${sender}. The goods route can now run toward ${receiver}.`,
        nextStatus:
          "Goods-route transporters should pick up and move the package to the receiver. The receiver confirms delivery when it arrives.",
        waitingForYou:
          r === "driver" ? "WAITING FOR YOU TO UPDATE YOUR SEGMENT STATUS" : null,
      };

    case "delivered":
      return {
        currentStatus: `This shipment is complete. The package was delivered to the receiver (${receiver}).`,
        nextStatus: "No next step. You can review history on the Tracking page if needed.",
        waitingForYou: null,
      };
  }
}

/** Role-aware guidance for the order’s current place in the workflow. */
export function getOrderStepGuidance(
  order: OrderLikeForInstructions,
  role: OrderInstructionRole | string | undefined
): OrderStepGuidance {
  const normalizedRole = normalizeRole(role);
  const isPff = isPffPaymentMethod(order.payment_method);
  const currentStepId = deriveCurrentStepId(order, isPff);
  const detail = STEP_DETAILS[currentStepId];
  const { currentStatus, nextStatus, waitingForYou } = buildCurrentAndNext(
    order,
    normalizedRole,
    isPff,
    currentStepId
  );

  return {
    currentStepId,
    stepLabel: detail.label,
    currentStatus,
    nextStatus,
    waitingForYou,
  };
}

/** Guidance for a specific workflow step (used when browsing the tracking stepper). */
export function getStepBrowseGuidance(
  stepId: WorkflowStepId,
  order: OrderLikeForInstructions,
  role: OrderInstructionRole | string | undefined
): Pick<OrderStepGuidance, "currentStatus" | "nextStatus" | "waitingForYou" | "stepLabel"> {
  const normalizedRole = normalizeRole(role);
  const isPff = isPffPaymentMethod(order.payment_method);
  const live = getOrderStepGuidance(order, normalizedRole);

  if (stepId === live.currentStepId) {
    return {
      stepLabel: live.stepLabel,
      currentStatus: live.currentStatus,
      nextStatus: live.nextStatus,
      waitingForYou: live.waitingForYou,
    };
  }

  const detail = STEP_DETAILS[stepId];
  const hypothetical = buildCurrentAndNext(order, normalizedRole, isPff, stepId);

  return {
    stepLabel: detail.label,
    currentStatus: `About this step — ${detail.label}: ${detail.explanations.join(" ")}`,
    nextStatus: hypothetical.nextStatus,
    waitingForYou: null,
  };
}

/** Map delivery-stepper step index / id onto workflow instruction steps. */
export function workflowStepFromDeliveryStep(
  stepKey: string,
  opts: { isPff?: boolean; row?: "payment" | "goods" | "standard" } = {}
): WorkflowStepId {
  if (stepKey === "CONFIRMED" || stepKey === "confirmed") return "confirmed";
  if (stepKey === "pick_ready" || stepKey === "pickup") return "pick_ready";
  if (stepKey === "PICKED_UP" || stepKey === "picked_up") return "picked_up";
  if (stepKey === "IN_TRANSIT" || stepKey === "in_transit") return "in_transit";
  if (stepKey === "payment_delivered") return "payment_delivered";
  if (stepKey === "DELIVERED" || stepKey === "delivered") {
    return opts.row === "payment" ? "payment_delivered" : "delivered";
  }
  return "confirmed";
}
