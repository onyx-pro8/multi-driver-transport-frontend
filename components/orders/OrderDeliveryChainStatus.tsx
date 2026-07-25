"use client";

import { Fragment, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  DELIVERY_NODE_COLORS,
  getActiveDeliveryPosition,
  getReceiverNodeState,
  getSegmentNodeState,
  getSenderNodeState,
} from "@/lib/deliveryProgress";
import { isPffPaymentMethod } from "@/lib/paymentFlow";
import type { SegmentConfirmationDetail, TrackingStatus } from "@/types";

interface Props {
  segments: SegmentConfirmationDetail[];
  trackingStatus?: TrackingStatus;
  pickupReadyAt?: string | null;
  goodsReadyAt?: string | null;
  paymentMethod?: string | null;
  routeConfirmed?: boolean;
  senderLabel?: string;
  receiverLabel?: string;
  /** Segment IDs to emphasize (e.g. this transporter's legs). */
  highlightSegmentIds?: number[];
  className?: string;
}

type ChainNode = {
  key: string;
  label: string;
  phase: "completed" | "current" | "upcoming";
};

type ChainLeg = {
  key: string;
  transporterName: string;
  driverName?: string | null;
  phase: "completed" | "current" | "upcoming";
  mine?: boolean;
};

const ROW_SIZE = 5;

/**
 * Multi-row delivery chain: nodes + visible connector lines with transporter labels.
 */
export function OrderDeliveryChainStatus({
  segments,
  trackingStatus = "CONFIRMED",
  pickupReadyAt = null,
  goodsReadyAt = null,
  paymentMethod,
  routeConfirmed = false,
  senderLabel = "Sender",
  receiverLabel = "Receiver",
  highlightSegmentIds = [],
  className,
}: Props) {
  const mineIds = useMemo(() => new Set(highlightSegmentIds), [highlightSegmentIds]);
  const sorted = [...segments].sort((a, b) => a.segment_index - b.segment_index);
  const isPff =
    isPffPaymentMethod(paymentMethod) ||
    sorted.some((s) => s.leg_phase === "payment" || s.leg_phase === "goods");
  const progressOptions = { isPff, goodsReadyAt };

  const activePosition = getActiveDeliveryPosition(
    trackingStatus,
    pickupReadyAt,
    routeConfirmed,
    sorted,
    progressOptions
  );

  const nodes: ChainNode[] = [
    {
      key: "sender",
      label: senderLabel,
      phase: getSenderNodeState(
        trackingStatus,
        pickupReadyAt,
        routeConfirmed,
        sorted,
        progressOptions
      ),
    },
  ];

  for (let i = 0; i < sorted.length; i++) {
    const seg = sorted[i];
    const isLast = i === sorted.length - 1;
    const segPhase = getSegmentNodeState(seg, activePosition);
    nodes.push({
      key: `handoff-${seg.segment_id}`,
      label: isLast ? receiverLabel : locationLabel(seg, i),
      phase: isLast
        ? getReceiverNodeState(trackingStatus, routeConfirmed, sorted, {
            isPff,
            pickupReadyAt,
          })
        : segPhase,
    });
  }

  if (sorted.length === 0) {
    nodes.push({
      key: "receiver",
      label: receiverLabel,
      phase: getReceiverNodeState(trackingStatus, routeConfirmed, sorted, {
        isPff,
        pickupReadyAt,
      }),
    });
  }

  const legs: ChainLeg[] = sorted.map((seg) => ({
    key: `leg-${seg.segment_id}`,
    transporterName: seg.transporter_name,
    driverName: null,
    phase: getSegmentNodeState(seg, activePosition),
    mine: mineIds.has(seg.segment_id),
  }));

  if (nodes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Delivery path appears after a route is confirmed.
      </p>
    );
  }

  const rows = chunkChain(nodes, legs, ROW_SIZE);

  return (
    <div className={cn("space-y-6", className)}>
      <p className="text-sm font-medium">Current delivery status</p>
      <div className="space-y-10 overflow-x-auto overflow-y-visible pb-2 pt-3">
        {rows.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`} className="min-w-[720px] pr-2">
            <div className="flex items-start w-full">
              {row.nodes.map((node, i) => {
                const leg = i < row.nodes.length - 1 ? row.legs[i] : null;
                return (
                  <Fragment key={node.key}>
                    <div className="flex w-[7.5rem] shrink-0 flex-col items-center">
                      <div className="relative flex h-7 w-7 items-center justify-center">
                        {node.phase === "current" && (
                          <span
                            className="absolute inset-0 rounded-full bg-primary/25"
                            aria-hidden
                          />
                        )}
                        <div
                          className={cn(
                            "relative z-[1] h-5 w-5 shrink-0 rounded-full border-2 transition-colors",
                            DELIVERY_NODE_COLORS[node.phase],
                            node.phase === "current" && "shadow-[0_0_0_3px_rgba(37,99,235,0.35)]"
                          )}
                          title={node.label}
                        />
                      </div>
                      <p
                        className={cn(
                          "mt-2 max-w-[7.5rem] text-center text-[10px] font-medium leading-tight line-clamp-3",
                          node.phase === "current" ? "text-primary" : "text-foreground"
                        )}
                      >
                        {node.label}
                      </p>
                    </div>
                    {leg && (
                      <div className="flex min-w-[5.5rem] flex-1 flex-col items-stretch pt-[11px]">
                        <div
                          className={cn(
                            "h-[3px] w-full rounded-full",
                            leg.mine && "h-[5px] ring-2 ring-primary/40 ring-offset-1 ring-offset-background",
                            leg.phase === "completed"
                              ? "bg-green-500"
                              : leg.phase === "current"
                                ? "bg-primary"
                                : "bg-slate-700 dark:bg-slate-300"
                          )}
                          aria-hidden
                        />
                        <div className="mt-2 px-1 text-center">
                          {leg.mine && (
                            <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                              Your leg
                            </p>
                          )}
                          <p
                            className={cn(
                              "text-[10px] font-semibold leading-tight line-clamp-2",
                              leg.mine
                                ? "text-primary"
                                : leg.phase === "current"
                                  ? "text-primary"
                                  : "text-foreground"
                            )}
                          >
                            {leg.transporterName}
                          </p>
                          {leg.driverName && (
                            <p className="text-[9px] text-muted-foreground line-clamp-1">
                              ({leg.driverName})
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </Fragment>
                );
              })}
              {row.continues && (
                <div className="ml-1 flex shrink-0 flex-col items-center pt-1">
                  <div className="h-10 w-[3px] rounded-full bg-primary/80" aria-hidden />
                  <span className="mt-1 text-[9px] font-medium text-muted-foreground">cont.</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <LegendDot className={DELIVERY_NODE_COLORS.completed} label="Completed" />
        <LegendDot className={DELIVERY_NODE_COLORS.current} label="Current" />
        <LegendDot className={DELIVERY_NODE_COLORS.upcoming} label="Upcoming" />
        {highlightSegmentIds.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-full bg-primary ring-2 ring-primary/40" aria-hidden />
            Your segment
          </span>
        )}
      </div>
    </div>
  );
}

function locationLabel(seg: SegmentConfirmationDetail, index: number): string {
  const label = seg.to_label?.trim();
  if (label) return label;
  return `Transfer ${index + 1}`;
}

function chunkChain(
  nodes: ChainNode[],
  legs: ChainLeg[],
  size: number
): { nodes: ChainNode[]; legs: (ChainLeg | null)[]; continues: boolean }[] {
  if (nodes.length <= size) {
    return [
      {
        nodes,
        legs: nodes.slice(0, -1).map((_, i) => legs[i] ?? null),
        continues: false,
      },
    ];
  }

  const rows: { nodes: ChainNode[]; legs: (ChainLeg | null)[]; continues: boolean }[] = [];
  let offset = 0;
  while (offset < nodes.length) {
    const slice = nodes.slice(offset, offset + size);
    const legSlice = slice.slice(0, -1).map((_, i) => legs[offset + i] ?? null);
    const continues = offset + size < nodes.length;
    rows.push({ nodes: slice, legs: legSlice, continues });
    if (!continues) break;
    offset = offset + size - 1;
  }
  return rows;
}

function LegendDot({ className, label }: { className: string; label: string }) {
  const isCurrent = label === "Current";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative inline-flex h-4 w-4 items-center justify-center">
        {isCurrent && (
          <span className="absolute inset-0 rounded-full bg-primary/25" aria-hidden />
        )}
        <span
          className={cn(
            "relative z-[1] h-2.5 w-2.5 rounded-full border-2",
            className,
            isCurrent && "shadow-[0_0_0_2px_rgba(37,99,235,0.35)]"
          )}
        />
      </span>
      {label}
    </span>
  );
}
