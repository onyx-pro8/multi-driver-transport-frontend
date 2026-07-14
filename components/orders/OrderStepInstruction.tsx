"use client";

import { cn } from "@/lib/utils";
import {
  getOrderStepGuidance,
  getStepBrowseGuidance,
  getStepInstructionDetail,
  type OrderInstructionRole,
  type OrderLikeForInstructions,
  type WorkflowStepId,
} from "@/lib/orderStepInstructions";

interface OrderStepInstructionProps {
  order: OrderLikeForInstructions;
  role?: OrderInstructionRole | string;
  /** When set (e.g. after clicking a stepper step), show that step’s details. */
  selectedStepId?: WorkflowStepId | null;
  className?: string;
  /** Show hint about clicking steps (tracking stepper only). */
  showClickHint?: boolean;
}

export function OrderStepInstruction({
  order,
  role = "receiver",
  selectedStepId = null,
  className,
  showClickHint = false,
}: OrderStepInstructionProps) {
  const live = getOrderStepGuidance(order, role);
  const stepId = selectedStepId ?? live.currentStepId;
  const browsingOtherStep = Boolean(selectedStepId && selectedStepId !== live.currentStepId);
  const shown = browsingOtherStep
    ? getStepBrowseGuidance(stepId, order, role)
    : {
        stepLabel: live.stepLabel,
        currentStatus: live.currentStatus,
        nextStatus: live.nextStatus,
        waitingForYou: live.waitingForYou,
      };

  return (
    <div
      className={cn(
        "rounded-lg border-[3px] border-emerald-500 bg-white px-4 py-4 shadow-sm dark:bg-card",
        className
      )}
      role="region"
      aria-label="Step instruction"
    >
      <p className="text-center text-sm font-bold tracking-wide text-foreground">
        Step Instruction
      </p>

      {showClickHint && (
        <p className="mt-1.5 text-center text-xs text-muted-foreground">
          Click each step above to learn what that stage means.
        </p>
      )}

      <div className="mt-4 space-y-3 text-left text-sm">
        <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Current status
          </p>
          <p className="mt-1.5 leading-relaxed text-foreground">{shown.currentStatus}</p>
        </div>

        <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Next status
          </p>
          <p className="mt-1.5 leading-relaxed text-foreground">{shown.nextStatus}</p>
        </div>
      </div>

      {browsingOtherStep && (
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Showing step:{" "}
          <span className="font-medium text-foreground">{shown.stepLabel}</span>
          {" · "}
          Order is currently at: {getStepInstructionDetail(live.currentStepId).label}
        </p>
      )}

      {shown.waitingForYou ? (
        <p className="mt-4 text-center text-sm font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
          {shown.waitingForYou}
        </p>
      ) : null}
    </div>
  );
}
