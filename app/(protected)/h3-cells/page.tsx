import { RoleGuard } from "@/components/auth/RoleGuard";
import { H3CellsPage } from "@/components/dashboard/H3CellsPage";

export default function Page() {
  return (
    <RoleGuard allow={["driver", "admin"]}>
      <H3CellsPage />
    </RoleGuard>
  );
}
