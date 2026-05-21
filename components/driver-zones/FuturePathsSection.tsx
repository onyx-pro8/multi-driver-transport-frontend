"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Placeholder for Milestone 7 route visualization — layout reserved per spec. */
export function FuturePathsSection() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Possible Multi-Driver Paths (Visualized)</h2>
        <p className="text-sm text-muted-foreground">
          Route and transfer visualization arrives in Milestone 7. This section reserves space for future path overlays.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["Path 1", "Path 2", "Path 3"].map((title, i) => (
          <Card key={title} className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="h-36 rounded-xl border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground"
                style={{
                  background:
                    i === 0
                      ? "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(34,197,94,0.08))"
                      : i === 1
                        ? "linear-gradient(135deg, rgba(6,182,212,0.08), rgba(234,179,8,0.08))"
                        : "linear-gradient(135deg, rgba(168,85,247,0.08), rgba(239,68,68,0.08))",
                }}
              >
                Milestone 7 — Multi-driver path preview
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Pickup Location
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-orange-500" /> Drop-off Location
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-primary" /> H3 Hexagon (Cell)
        </span>
      </div>
    </section>
  );
}
