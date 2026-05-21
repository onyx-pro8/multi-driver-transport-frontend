"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { DriverZone } from "@/types";

interface RecentZonesProps {
  zones: DriverZone[];
}

export function RecentZones({ zones }: RecentZonesProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Recent Driver Zones</CardTitle>
        <Link href="/driver-zones" className="text-xs text-primary font-medium hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {zones.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No zones yet.{" "}
            <Link href="/driver-zones" className="text-primary hover:underline">
              Create your first zone
            </Link>
          </p>
        ) : (
          <ul className="space-y-3">
            {zones.map((zone) => (
              <li
                key={zone.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{zone.zone_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {zone.driver_name} · {zone.cell_count} cells · res {zone.resolution}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDate(zone.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
