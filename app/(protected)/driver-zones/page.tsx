import { RoleGuard } from "@/components/auth/RoleGuard";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { DriverZonesPage } from "@/components/driver-zones/DriverZonesPage";

export default function Page() {
  return (
    <RoleGuard allow={["driver", "admin"]}>
      <DashboardShell
        title="Driver Zones"
        subtitle="Define coverage with H3 cells or geofences and set per-zone rates."
      >
        <DriverZonesPage />
      </DashboardShell>
    </RoleGuard>
  );
}
