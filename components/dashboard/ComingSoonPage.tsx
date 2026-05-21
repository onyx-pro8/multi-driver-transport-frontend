import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardContent } from "@/components/ui/card";

interface ComingSoonPageProps {
  title: string;
  subtitle: string;
  milestone?: number;
}

export function ComingSoonPage({ title, subtitle, milestone }: ComingSoonPageProps) {
  return (
    <DashboardShell title={title} subtitle={subtitle}>
      <div className="px-6 pb-8">
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-lg font-semibold">Coming in Milestone {milestone ?? "—"}</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              This section is reserved for a future milestone. Your Milestone 1 driver zone workflow
              remains fully available under Driver Zones.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
