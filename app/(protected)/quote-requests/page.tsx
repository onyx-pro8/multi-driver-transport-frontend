import { RoleGuard } from "@/components/auth/RoleGuard";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { QuoteRequestsPage } from "@/components/orders/QuoteRequestsPage";

export default function QuoteRequestsRoutePage() {
  return (
    <RoleGuard allow={["driver", "admin"]}>
      <DashboardShell
        title="Quote requests"
        subtitle="Review sender quote requests and enter prices for your route segments."
      >
        <QuoteRequestsPage />
      </DashboardShell>
    </RoleGuard>
  );
}
