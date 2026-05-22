"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { defaultRouteForRole, useAuth } from "@/hooks/useAuth";

export function GuestGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const redirect = searchParams.get("redirect") || defaultRouteForRole(user?.role);
      router.replace(redirect);
    }
  }, [isLoading, isAuthenticated, router, searchParams, user?.role]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) return null;

  return <>{children}</>;
}
