"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardContent } from "@/components/ui/card";
import { listDriverZones } from "@/lib/api";
import type { DriverZone } from "@/types";

const H3MapView = dynamic(() => import("@/components/map/H3MapView").then((m) => m.H3MapView), {
  ssr: false,
  loading: () => <div className="h-[480px] rounded-xl bg-muted animate-pulse" />,
});

export function MapViewPage() {
  const [zones, setZones] = useState<DriverZone[]>([]);

  useEffect(() => {
    listDriverZones().then(setZones).catch(() => setZones([]));
  }, []);

  const resolution = zones[0]?.resolution ?? 9;

  return (
    <DashboardShell
      title="Map View"
      subtitle="Visualize driver zones and H3 hexagon coverage."
    >
      <div className="px-6 pb-8">
        <Card>
          <CardContent className="p-4">
            <H3MapView
              height={480}
              resolution={resolution}
              selectedCells={[]}
              savedZones={zones}
              interactive
            />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
