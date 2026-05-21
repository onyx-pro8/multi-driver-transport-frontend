import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata = {
  title: "Reset password | Multi-Driver Transport",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password" subtitle="Enter a strong password for your account.">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
