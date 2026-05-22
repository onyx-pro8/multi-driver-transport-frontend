import { RoleGuard } from "@/components/auth/RoleGuard";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ReceiversPage } from "@/components/receivers/ReceiversPage";

export default function Page() {
  return (
    <RoleGuard allow={["sender", "admin"]}>
      <DashboardShell
        title="Receivers"
        subtitle="Browse registered receivers and use them when creating orders."
      >
        <ReceiversPage />
      </DashboardShell>
    </RoleGuard>
  );
}
