"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { defaultRouteForRole, useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/types/auth";

interface RoleGuardProps {
  allow: UserRole[];
  children: React.ReactNode;
}

/**
 * Only render `children` when the current user's role is in `allow`.
 * Otherwise, redirect to their default landing page.
 */
export function RoleGuard({ allow, children }: RoleGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const allowed = !!user && allow.includes(user.role);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (!allowed) {
      router.replace(defaultRouteForRole(user.role));
    }
  }, [isLoading, user, allowed, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!allowed) return null;
  return <>{children}</>;
}
