import { DashboardShell } from "@/components/layout/DashboardShell";
import { ZoneConnectionsPage } from "@/components/zone-connections/ZoneConnectionsPage";

export default function Page() {
  return (
    <DashboardShell
      title="Zone Overlap & Adjacency Detection"
      subtitle="Detect where transport participant zones overlap or touch, creating possible handoff/transfer points."
    >
      <ZoneConnectionsPage />
    </DashboardShell>
  );
}
