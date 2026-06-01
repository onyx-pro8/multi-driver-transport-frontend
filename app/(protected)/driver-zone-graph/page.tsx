import { RoleGuard } from "@/components/auth/RoleGuard";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { DriverZoneGraphPage } from "@/components/driver-zone-graph/DriverZoneGraphPage";

export default function Page() {
  return (
    <RoleGuard allow={["driver", "sender", "admin"]}>
      <DashboardShell
        title="Driver-Zone Graph Builder"
        subtitle="View how transport participant zones connect as a network through overlap and adjacency."
      >
        <DriverZoneGraphPage />
      </DashboardShell>
    </RoleGuard>
  );
}
