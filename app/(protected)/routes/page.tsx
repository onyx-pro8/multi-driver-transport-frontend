import { RoleGuard } from "@/components/auth/RoleGuard";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { RoutesPage } from "@/components/orders/RoutesPage";

export default function RoutesRoutePage() {
  return (
    <RoleGuard allow={["sender", "receiver", "admin", "driver"]}>
      <DashboardShell
        title="Routes"
        subtitle="Compare possible delivery routes by estimated cost for each shipment."
      >
        <RoutesPage />
      </DashboardShell>
    </RoleGuard>
  );
}
