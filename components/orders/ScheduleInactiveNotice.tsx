"use client";

import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduleInactiveZone } from "@/types";

interface Props {
  zones: ScheduleInactiveZone[];
  className?: string;
  /** When true, show a stronger callout (e.g. inside an incomplete-route box). */
  emphasized?: boolean;
}

function coversLabel(covers: ScheduleInactiveZone["covers"]): string {
  if (covers === "both") return "pickup and destination";
  if (covers === "pickup") return "pickup";
  return "destination";
}

export function ScheduleInactiveNotice({ zones, className, emphasized }: Props) {
  if (zones.length === 0) return null;

  return (
    <div
      className={cn(
        emphasized
          ? "rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 py-3 text-sm text-sky-950 dark:text-sky-100 space-y-2"
          : "rounded-xl border border-sky-500/30 bg-sky-500/5 px-4 py-3 text-sm text-sky-950 dark:text-sky-100 space-y-2",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Clock className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium">Zones closed at this date &amp; time</p>
          <p className="text-xs opacity-90">
            These transporters cover this shipment but are <strong>not available now</strong>.
            Routes only use zones that are open right now — try another time or wait for their
            operating window.
          </p>
        </div>
      </div>
      <ul className="space-y-2 text-xs pl-6">
        {zones.map((z) => (
          <li
            key={z.zone_id}
            className="rounded-md border border-sky-500/25 bg-background/50 px-2.5 py-2 space-y-1"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">
                {z.transport_name} · {z.zone_name}
              </span>
              <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
                Not available now
              </span>
            </div>
            {z.inactive_reason ? (
              <p className="text-sky-900/90 dark:text-sky-100/90 font-medium">{z.inactive_reason}</p>
            ) : null}
            <p className="text-muted-foreground">
              Covers {coversLabel(z.covers)}
              {z.schedule_summary ? (
                <>
                  {" "}
                  · <span className="text-foreground/80">When open: {z.schedule_summary}</span>
                </>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
