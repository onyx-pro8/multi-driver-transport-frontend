"use client";

import { RoleGuard } from "@/components/auth/RoleGuard";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { QuoteRequestsPage } from "@/components/orders/QuoteRequestsPage";
import { useAuth } from "@/hooks/useAuth";

export default function QuoteRequestsRoutePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <RoleGuard allow={["driver", "admin"]}>
      <DashboardShell
        title={isAdmin ? "Set prices" : "Quote requests"}
        subtitle={
          isAdmin
            ? "Review all pending quote requests and enter prices for any route segment."
            : "Review sender quote requests and enter prices for your route segments."
        }
      >
        <QuoteRequestsPage />
      </DashboardShell>
    </RoleGuard>
  );
}
