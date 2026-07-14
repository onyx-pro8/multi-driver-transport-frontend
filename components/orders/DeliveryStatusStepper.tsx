"use client";

import { useEffect, useState } from "react";
import { Check, DollarSign, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  deriveEffectiveTrackingStatus,
  getPffGoodsStepIndex,
  getPffPaymentStepIndex,
} from "@/lib/deliveryProgress";
import {
  getOrderStepGuidance,
  workflowStepFromDeliveryStep,
  type OrderInstructionRole,
  type OrderLikeForInstructions,
  type WorkflowStepId,
} from "@/lib/orderStepInstructions";
import {
  PFF_GOODS_ROUTE_DIRECTION,
  PFF_GOODS_ROUTE_TITLE,
  PFF_PAYMENT_ROUTE_DIRECTION,
  PFF_PAYMENT_ROUTE_TITLE,
} from "@/lib/pffTracking";
import { OrderStepInstruction } from "@/components/orders/OrderStepInstruction";
import type { SegmentConfirmationDetail, TrackingStatus } from "@/types";

export const TRACKING_STATUS_LABELS: Record<TrackingStatus, string> = {
  AWAITING_CONNECT: "Awaiting sender connect",
  REJECTED: "Rejected",
  CONFIRMED: "Confirmed",
  ROUTES_IN_PROGRESS: "Routes in progress",
  ROUTES_READY: "Routes ready",
  PICKUP_AVAILABLE: "Pickup ready",
  PICKED_UP: "Picked up",
  IN_TRANSIT: "In transit",
  PAYMENT_DELIVERED: "Payment delivered",
  DELIVERED: "Delivered",
};

const TRACKING_STATUS_HINTS: Record<TrackingStatus, string> = {
  AWAITING_CONNECT: "The receiver submitted this request. The sender must connect before routes are built.",
  REJECTED: "The sender rejected this shipment request.",
  CONFIRMED: "Route confirmed by all transporters. Sender can mark the package as pick ready.",
  ROUTES_IN_PROGRESS: "Payment and/or goods routes are being selected and confirmed.",
  ROUTES_READY: "Both payment and goods routes are confirmed. Receiver can mark payment pickup available.",
  PICKUP_AVAILABLE: "Package is ready at the sender — waiting for the first transporter to pick up.",
  PICKED_UP: "Package has been collected and is moving through the route.",
  IN_TRANSIT: "Package is in transit through the multi-transporter chain toward the receiver.",
  PAYMENT_DELIVERED:
    "Payment reached the producer. Producer can mark goods ready for the return delivery leg.",
  DELIVERED: "Package has been delivered to the receiver.",
};

const PFF_TRACKING_STATUS_HINTS: Partial<Record<TrackingStatus, string>> = {
  ROUTES_IN_PROGRESS:
    "Receiver and sender can each pick a route. Delivery starts after both are confirmed.",
  ROUTES_READY:
    "Both routes are confirmed. Receiver can mark payment pickup available on the payment route.",
  PICKUP_AVAILABLE:
    "Payment package is ready at the receiver — waiting for the first transporter on the payment route.",
  PICKED_UP: "Payment is moving through the payment route toward the producer.",
  IN_TRANSIT:
    "Payment or goods are in transit on their respective routes. Check each row below.",
  PAYMENT_DELIVERED:
    "Payment reached the producer. Sender can mark goods ready on the delivery route.",
  DELIVERED: "Goods have been delivered to the receiver.",
};

const ROUTE_NOT_CONFIRMED_HINT =
  "Delivery tracking starts after all transporters confirm the selected route.";

const PFF_ROUTE_NOT_CONFIRMED_HINT =
  "Tracking starts after both payment and goods routes are confirmed by all transporters.";

const DELIVERY_STEPS: { id: string; label: string }[] = [
  { id: "CONFIRMED", label: "Confirmed" },
  { id: "pick_ready", label: "Pick ready" },
  { id: "PICKED_UP", label: TRACKING_STATUS_LABELS.PICKED_UP },
  { id: "IN_TRANSIT", label: TRACKING_STATUS_LABELS.IN_TRANSIT },
  { id: "DELIVERED", label: TRACKING_STATUS_LABELS.DELIVERED },
];

const PFF_PAYMENT_STEPS: { id: string; label: string; finalLabel?: string }[] = [
  { id: "confirmed", label: "Confirmed" },
  { id: "pick_ready", label: "Pick ready" },
  { id: "picked_up", label: "Picked up" },
  { id: "in_transit", label: "In transit" },
  { id: "payment_delivered", label: "Delivered", finalLabel: "Delivered (payment)" },
];

const PFF_GOODS_STEPS: { id: string; label: string; finalLabel?: string }[] = [
  { id: "pickup", label: "Pickup" },
  { id: "picked_up", label: "Picked up" },
  { id: "in_transit", label: "In transit" },
  { id: "delivered", label: "Delivered", finalLabel: "Delivered (goods)" },
];

function currentStepIndex(
  routeConfirmed: boolean,
  pickupReadyAt: string | null | undefined,
  trackingStatus: TrackingStatus
): number {
  if (!routeConfirmed) return -1;
  if (!pickupReadyAt) return 0;
  if (trackingStatus === "CONFIRMED" || trackingStatus === "PICKUP_AVAILABLE") return 1;
  if (trackingStatus === "PICKED_UP") return 2;
  if (trackingStatus === "IN_TRANSIT") return 3;
  if (trackingStatus === "PAYMENT_DELIVERED") return 2;
  if (trackingStatus === "DELIVERED") return 4;
  return 1;
}

function currentStatusLabel(
  routeConfirmed: boolean,
  pickupReadyAt: string | null | undefined,
  trackingStatus: TrackingStatus,
  isPff = false
): string {
  if (trackingStatus === "AWAITING_CONNECT") {
    return TRACKING_STATUS_LABELS.AWAITING_CONNECT;
  }
  if (!routeConfirmed) return isPff ? "Routes not confirmed" : "Route not confirmed";
  if (!pickupReadyAt && !isPff) return TRACKING_STATUS_LABELS.CONFIRMED;
  return TRACKING_STATUS_LABELS[trackingStatus];
}

export function getDeliveryStatusLabel(
  routeConfirmed: boolean,
  pickupReadyAt: string | null | undefined,
  trackingStatus: TrackingStatus
): string {
  return currentStatusLabel(routeConfirmed, pickupReadyAt, trackingStatus);
}

function currentStatusHint(
  routeConfirmed: boolean,
  pickupReadyAt: string | null | undefined,
  trackingStatus: TrackingStatus,
  isPff = false
): string {
  if (trackingStatus === "AWAITING_CONNECT") {
    return TRACKING_STATUS_HINTS.AWAITING_CONNECT;
  }
  if (!routeConfirmed) {
    return isPff ? PFF_ROUTE_NOT_CONFIRMED_HINT : ROUTE_NOT_CONFIRMED_HINT;
  }
  if (!pickupReadyAt && !isPff) return TRACKING_STATUS_HINTS.CONFIRMED;
  if (isPff && PFF_TRACKING_STATUS_HINTS[trackingStatus]) {
    return PFF_TRACKING_STATUS_HINTS[trackingStatus]!;
  }
  return TRACKING_STATUS_HINTS[trackingStatus];
}

interface RouteStepperRowProps {
  title: string;
  subtitle: string;
  steps: { id: string; label: string; finalLabel?: string }[];
  activeIndex: number;
  routeStarted: boolean;
  finalIcon?: "payment" | "goods";
  selectedStepId?: WorkflowStepId | null;
  onSelectStep?: (stepId: WorkflowStepId) => void;
  row?: "payment" | "goods";
}

function RouteStepperRow({
  title,
  subtitle,
  steps,
  activeIndex,
  routeStarted,
  finalIcon,
  selectedStepId,
  onSelectStep,
  row = "payment",
}: RouteStepperRowProps) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-medium text-violet-700 dark:text-violet-300">{title}</p>
        <p className="text-[10px] text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-start gap-1 sm:gap-0">
        {steps.map((step, index) => {
          const isComplete = routeStarted && activeIndex > index;
          const isCurrent = routeStarted && activeIndex === index;
          const isUpcoming = !routeStarted || activeIndex < index;
          const isFinal = index === steps.length - 1;
          const label = isFinal && step.finalLabel ? step.finalLabel : step.label;
          const workflowId = workflowStepFromDeliveryStep(step.id, { isPff: true, row });
          const isSelected = selectedStepId === workflowId;

          return (
            <div key={step.id} className="flex items-center min-w-[72px] sm:min-w-0 sm:flex-1">
              <button
                type="button"
                onClick={() => onSelectStep?.(workflowId)}
                className={cn(
                  "flex flex-col items-center flex-1 px-1 rounded-lg transition-colors",
                  onSelectStep && "cursor-pointer hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  isSelected && "bg-emerald-500/10 ring-1 ring-emerald-500/40"
                )}
                aria-pressed={isSelected}
                aria-label={`Step instruction: ${label}`}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                    isComplete && "border-green-500 bg-green-500 text-white",
                    isCurrent &&
                      "border-primary bg-primary text-primary-foreground ring-4 ring-primary/20",
                    isUpcoming && "border-border bg-background text-muted-foreground"
                  )}
                >
                  {isComplete ? (
                    isFinal && finalIcon === "payment" ? (
                      <DollarSign className="h-4 w-4" />
                    ) : isFinal && finalIcon === "goods" ? (
                      <Package className="h-4 w-4" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )
                  ) : isCurrent && isFinal && finalIcon === "payment" ? (
                    <DollarSign className="h-4 w-4" />
                  ) : isCurrent && isFinal && finalIcon === "goods" ? (
                    <Package className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <p
                  className={cn(
                    "mt-2 text-center text-[10px] sm:text-xs leading-tight max-w-[88px]",
                    isCurrent || isSelected
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {label}
                </p>
              </button>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "hidden sm:block h-0.5 flex-1 mx-1 mt-[-1.25rem]",
                    isComplete ? "bg-green-500" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DeliveryStatusStepperProps {
  trackingStatus: TrackingStatus;
  pickupReadyAt?: string | null;
  goodsReadyAt?: string | null;
  routeConfirmed?: boolean;
  bothRoutesConfirmed?: boolean;
  isPff?: boolean;
  segments?: Pick<SegmentConfirmationDetail, "segment_index" | "leg_status" | "leg_phase">[];
  /** When provided, shows a Step Instruction panel and makes steps clickable. */
  order?: OrderLikeForInstructions | null;
  viewerRole?: OrderInstructionRole | string;
  className?: string;
}

export function DeliveryStatusStepper({
  trackingStatus,
  pickupReadyAt = null,
  goodsReadyAt = null,
  routeConfirmed = false,
  bothRoutesConfirmed = false,
  isPff = false,
  segments,
  order = null,
  viewerRole = "receiver",
  className,
}: DeliveryStatusStepperProps) {
  const effectiveStatus = deriveEffectiveTrackingStatus(
    trackingStatus,
    pickupReadyAt,
    segments,
    { isPff, goodsReady: Boolean(goodsReadyAt) }
  );
  const confirmed = isPff ? bothRoutesConfirmed : routeConfirmed;
  const statusLabel = currentStatusLabel(confirmed, pickupReadyAt, effectiveStatus, isPff);
  const statusHint = currentStatusHint(confirmed, pickupReadyAt, effectiveStatus, isPff);

  const paymentActiveIndex = isPff
    ? getPffPaymentStepIndex(bothRoutesConfirmed, pickupReadyAt, segments)
    : -1;
  const goodsActiveIndex = isPff
    ? getPffGoodsStepIndex(bothRoutesConfirmed, goodsReadyAt, segments, effectiveStatus)
    : -1;
  const activeIndex = currentStepIndex(confirmed, pickupReadyAt, effectiveStatus);

  const instructionOrder: OrderLikeForInstructions | null = order
    ? {
        ...order,
        tracking_status: effectiveStatus,
        pickup_ready_at: pickupReadyAt ?? order.pickup_ready_at,
        goods_ready_at: goodsReadyAt ?? order.goods_ready_at,
        route_selection_status: confirmed
          ? "confirmed"
          : order.route_selection_status,
      }
    : null;

  const currentWorkflowStep = instructionOrder
    ? getOrderStepGuidance(instructionOrder, viewerRole).currentStepId
    : null;
  const [selectedStepId, setSelectedStepId] = useState<WorkflowStepId | null>(null);

  useEffect(() => {
    setSelectedStepId(currentWorkflowStep);
  }, [currentWorkflowStep]);

  return (
    <div className={cn("rounded-xl border border-border bg-muted/20 p-4 space-y-4", className)}>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Delivery status — where is it now?
        </p>
        <p className="text-lg font-semibold mt-1">{statusLabel}</p>
        <p className="text-sm text-muted-foreground mt-1">{statusHint}</p>
      </div>

      {isPff ? (
        <div className="space-y-5 pt-1">
          <RouteStepperRow
            title={PFF_PAYMENT_ROUTE_TITLE}
            subtitle={PFF_PAYMENT_ROUTE_DIRECTION}
            steps={PFF_PAYMENT_STEPS}
            activeIndex={paymentActiveIndex}
            routeStarted={bothRoutesConfirmed}
            finalIcon="payment"
            row="payment"
            selectedStepId={selectedStepId}
            onSelectStep={instructionOrder ? setSelectedStepId : undefined}
          />
          <RouteStepperRow
            title={PFF_GOODS_ROUTE_TITLE}
            subtitle={PFF_GOODS_ROUTE_DIRECTION}
            steps={PFF_GOODS_STEPS}
            activeIndex={goodsActiveIndex}
            routeStarted={bothRoutesConfirmed && goodsActiveIndex >= 0}
            finalIcon="goods"
            row="goods"
            selectedStepId={selectedStepId}
            onSelectStep={instructionOrder ? setSelectedStepId : undefined}
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-1 sm:gap-0">
          {DELIVERY_STEPS.map((step, index) => {
            const isComplete = routeConfirmed && activeIndex > index;
            const isCurrent = routeConfirmed && activeIndex === index;
            const isUpcoming = !routeConfirmed || activeIndex < index;
            const workflowId = workflowStepFromDeliveryStep(step.id);
            const isSelected = selectedStepId === workflowId;

            return (
              <div key={step.id} className="flex items-center min-w-[72px] sm:min-w-0 sm:flex-1">
                <button
                  type="button"
                  onClick={() => instructionOrder && setSelectedStepId(workflowId)}
                  disabled={!instructionOrder}
                  className={cn(
                    "flex flex-col items-center flex-1 px-1 rounded-lg transition-colors",
                    instructionOrder &&
                      "cursor-pointer hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    isSelected && instructionOrder && "bg-emerald-500/10 ring-1 ring-emerald-500/40"
                  )}
                  aria-pressed={isSelected}
                  aria-label={`Step instruction: ${step.label}`}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                      isComplete && "border-green-500 bg-green-500 text-white",
                      isCurrent &&
                        "border-primary bg-primary text-primary-foreground ring-4 ring-primary/20",
                      isUpcoming && "border-border bg-background text-muted-foreground"
                    )}
                  >
                    {isComplete ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  <p
                    className={cn(
                      "mt-2 text-center text-[10px] sm:text-xs leading-tight max-w-[88px]",
                      isCurrent || isSelected
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </p>
                </button>
                {index < DELIVERY_STEPS.length - 1 && (
                  <div
                    className={cn(
                      "hidden sm:block h-0.5 flex-1 mx-1 mt-[-1.25rem]",
                      isComplete ? "bg-green-500" : "bg-border"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {instructionOrder && (
        <OrderStepInstruction
          order={instructionOrder}
          role={viewerRole}
          selectedStepId={selectedStepId}
          showClickHint
        />
      )}
    </div>
  );
}
