import { DashboardShell } from "@/components/layout/DashboardShell";
import { MilestoneOnePage } from "@/components/dashboard/MilestoneOnePage";

export default function DriverZonesPage() {
  return (
    <DashboardShell
      title="H3 Conversion & Driver Zone Creation"
      subtitle="Convert locations to H3 cells and create driver zones."
    >
      <MilestoneOnePage />
    </DashboardShell>
  );
}
