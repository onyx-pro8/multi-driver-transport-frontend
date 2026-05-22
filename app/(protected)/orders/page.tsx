import { RoleGuard } from "@/components/auth/RoleGuard";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { OrdersPage } from "@/components/orders/OrdersPage";

export default function Page() {
  return (
    <RoleGuard allow={["sender", "receiver", "admin"]}>
      <DashboardShell
        title="Orders"
        subtitle="Submit, track, and confirm deliveries between senders and receivers."
      >
        <OrdersPage />
      </DashboardShell>
    </RoleGuard>
  );
}
