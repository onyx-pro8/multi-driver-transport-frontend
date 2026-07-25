import { RoleGuard } from "@/components/auth/RoleGuard";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { RoutesPage } from "@/components/orders/RoutesPage";

export default function RoutesRoutePage() {
  return (
    <RoleGuard allow={["sender", "receiver", "admin", "driver"]}>
      <DashboardShell
        title="Routes"
        subtitle="Compare and select delivery routes."
      >
        <RoutesPage />
      </DashboardShell>
    </RoleGuard>
  );
}
