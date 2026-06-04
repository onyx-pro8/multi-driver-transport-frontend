"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listDriverZones } from "@/lib/api";
import type { DriverZone } from "@/types";

export function H3CellsPage() {
  const [zones, setZones] = useState<DriverZone[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listDriverZones()
      .then(setZones)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  const cells = useMemo(() => {
    const map = new Map<string, { cell: string; zones: string[]; resolution: number }>();
    for (const zone of zones) {
      for (const cell of zone.h3_cells) {
        const existing = map.get(cell);
        if (existing) existing.zones.push(zone.zone_name);
        else map.set(cell, { cell, zones: [zone.zone_name], resolution: zone.resolution });
      }
    }
    return Array.from(map.values());
  }, [zones]);

  return (
    <DashboardShell
      title="Cells"
      subtitle="Inventory of hexagon cells across all transport zones."
    >
      <div className="px-6 pb-8">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        )}
        <Card>
          <CardHeader>
            <CardTitle>
              {cells.length} unique cell{cells.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">H3 Index</th>
                  <th className="py-2 pr-4 font-medium">Resolution</th>
                  <th className="py-2 font-medium">Zones</th>
                </tr>
              </thead>
              <tbody>
                {cells.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-muted-foreground">
                      No H3 cells yet. Create driver zones to populate this view.
                    </td>
                  </tr>
                )}
                {cells.map((row) => (
                  <tr key={row.cell} className="border-b border-border/70 last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">{row.cell}</td>
                    <td className="py-2 pr-4">{row.resolution}</td>
                    <td className="py-2 text-muted-foreground">{row.zones.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
