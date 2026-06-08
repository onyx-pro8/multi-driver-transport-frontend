"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MAP_EMPTY_CELLS } from "@/lib/mapConstants";
import type { DriverZone } from "@/types";

import { H3MapView } from "@/components/map/H3MapViewDynamic";

interface MapPreviewCardProps {
  zones: DriverZone[];
}

export function MapPreviewCard({ zones }: MapPreviewCardProps) {
  const resolution = zones[0]?.resolution ?? 9;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Map Preview</CardTitle>
        <Link href="/map-view" className="text-xs text-primary font-medium hover:underline">
          Open map
        </Link>
      </CardHeader>
      <CardContent>
        {zones.length === 0 ? (
          <div className="h-48 rounded-xl border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground">
            Add driver zones to see map preview
          </div>
        ) : (
          <H3MapView
            height={192}
            resolution={resolution}
            selectedCells={MAP_EMPTY_CELLS}
            savedZones={zones}
            interactive={false}
            showZoneTooltips={false}
            zoom={4}
          />
        )}
      </CardContent>
    </Card>
  );
}
