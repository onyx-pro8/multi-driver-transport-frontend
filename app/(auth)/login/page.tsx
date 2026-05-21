import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = {
  title: "Sign in | Multi-Driver Transport",
};

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your logistics command center.">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
