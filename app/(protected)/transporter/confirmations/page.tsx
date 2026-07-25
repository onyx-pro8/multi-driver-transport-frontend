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
            ? "View shipment requests and deliveries across transporters. Set prices on the Set prices page."
            : "Respond to requests and manage your assigned deliveries. Set quotes on Set prices."
        }
      >
        <ConfirmationsPage />
      </DashboardShell>
    </RoleGuard>
  );
}
