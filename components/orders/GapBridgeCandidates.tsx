"use client";

import { cn } from "@/lib/utils";
import type { GapBridgeCandidate, OrderDraftGap } from "@/types";

export function GapBridgeCandidates({ gap, className }: { gap: OrderDraftGap; className?: string }) {
  const candidates = gap.bridge_candidates ?? [];
  const bridgeMessage = gap.bridge_message;

  return (
    <div
      className={cn(
        "rounded-md border border-amber-400/40 bg-background/60 px-3 py-2.5 space-y-2",
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Possible zones for this gap
      </p>
      {bridgeMessage ? (
        <p className="text-xs text-amber-900 dark:text-amber-100">{bridgeMessage}</p>
      ) : null}
      {candidates.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No transport zones in the network can bridge this gap. A new zone or connection is
          required.
        </p>
      ) : (
        <ul className="space-y-2">
          {candidates.map((candidate) => (
            <GapBridgeCandidateRow key={candidate.zone_id} candidate={candidate} />
          ))}
        </ul>
      )}
    </div>
  );
}

function GapBridgeCandidateRow({ candidate }: { candidate: GapBridgeCandidate }) {
  const sideLabel =
    candidate.on_pickup_side && candidate.on_destination_side
      ? "Connects both sides"
      : candidate.on_pickup_side
        ? "Pickup side"
        : candidate.on_destination_side
          ? "Destination side"
          : "Near gap";

  return (
    <li className="rounded-md border border-border/70 px-2.5 py-2 text-xs space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">
          {candidate.transport_name} · {candidate.zone_name}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            candidate.schedule_active
              ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
              : "bg-sky-500/15 text-sky-800 dark:text-sky-200",
          )}
        >
          {candidate.schedule_active ? "Open now" : "Not available now"}
        </span>
      </div>
      {!candidate.schedule_active && candidate.inactive_reason ? (
        <p className="text-sky-900/90 dark:text-sky-100/90 font-medium">{candidate.inactive_reason}</p>
      ) : null}
      <p className="text-muted-foreground">
        {sideLabel}
        {candidate.schedule_summary ? (
          <>
            {" "}
            · <span className="text-foreground/80">Schedule: {candidate.schedule_summary}</span>
          </>
        ) : null}
      </p>
    </li>
  );
}
