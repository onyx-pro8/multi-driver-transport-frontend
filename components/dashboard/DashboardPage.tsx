"use client";

import { useEffect, useState } from "react";
import { Boxes, Route, Shapes, Users } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { getDashboardStats } from "@/lib/api";
import type { DashboardStats } from "@/types/auth";
import { MapPreviewCard } from "./MapPreviewCard";
import { QuickActions } from "./QuickActions";
import { RecentZones } from "./RecentZones";
import { StatCard } from "./StatCard";

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load stats"));
  }, []);

  return (
    <DashboardShell
      title="Dashboard"
      subtitle="Command center for your multi-driver H3 transport operations."
    >
      <div className="px-6 pb-8 space-y-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Driver Zones"
            value={stats?.total_driver_zones ?? "—"}
            icon={Shapes}
            hint="Total zones created"
          />
          <StatCard
            label="H3 Cells"
            value={stats?.total_h3_cells ?? "—"}
            icon={Boxes}
            hint="Across all zones"
            accent="green"
          />
          <StatCard
            label="Active Drivers"
            value={stats?.total_drivers ?? "—"}
            icon={Users}
            hint="Unique driver names"
            accent="amber"
          />
          <StatCard
            label="Generated Routes"
            value={stats?.total_routes ?? 0}
            icon={Route}
            hint="Milestone 5+"
            accent="violet"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <QuickActions />
            <RecentZones zones={stats?.recent_zones ?? []} />
          </div>
          <div className="space-y-6">
            {/* <MilestoneProgressCard
              current={stats?.milestone ?? 1}
              total={stats?.milestone_total ?? 7}
            /> */}
            <MapPreviewCard zones={stats?.recent_zones ?? []} />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
