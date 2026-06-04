import { RoleGuard } from "@/components/auth/RoleGuard";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { DriversPage } from "@/components/drivers/DriversPage";

export default function Page() {
  return (
    <RoleGuard allow={["sender", "receiver", "admin"]}>
      <DashboardShell
        title="Transporters"
        subtitle="Browse transporters, see their trustworthiness, and follow the ones you trust."
      >
        <DriversPage />
      </DashboardShell>
    </RoleGuard>
  );
}
