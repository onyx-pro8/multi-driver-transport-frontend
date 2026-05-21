import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata = {
  title: "Create account | Multi-Driver Transport",
};

export default function RegisterPage() {
  return (
    <AuthShell title="Create your account" subtitle="Start managing H3 driver zones for your fleet.">
      <RegisterForm />
    </AuthShell>
  );
}
