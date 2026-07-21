"use client";

import { RoleGuard } from "@/components/auth/RoleGuard";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ConfirmationsPage } from "@/components/orders/ConfirmationsPage";
import { useAuth } from "@/hooks/useAuth";

export default function TransporterConfirmationsRoutePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <RoleGuard allow={["driver", "admin"]}>
      <DashboardShell
        title={isAdmin ? "Shipments" : "My shipments"}
        subtitle={
          isAdmin
            ? "View all shipment requests, set prices, and track deliveries across transporters."
            : "Respond to requests, set prices, and track your assigned deliveries."
        }
      >
        <ConfirmationsPage />
      </DashboardShell>
    </RoleGuard>
  );
}
