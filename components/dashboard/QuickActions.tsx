"use client";

import Link from "next/link";
import { ArrowRightLeft, Map, Plus, Shapes } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const actions = [
  {
    label: "Convert locations",
    description: "Pickup & drop-off to H3",
    href: "/driver-zones",
    icon: ArrowRightLeft,
  },
  {
    label: "Add driver zone",
    description: "Define driver coverage",
    href: "/driver-zones",
    icon: Plus,
  },
  {
    label: "View H3 cells",
    description: "Browse cell inventory",
    href: "/h3-cells",
    icon: Shapes,
  },
  {
    label: "Open map view",
    description: "Visualize zones on map",
    href: "/map-view",
    icon: Map,
  },
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 hover:border-primary/40 hover:bg-accent transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{action.label}</p>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
