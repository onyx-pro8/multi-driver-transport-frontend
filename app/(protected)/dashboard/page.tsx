"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { defaultRouteForRole, useAuth } from "@/hooks/useAuth";

export default function DashboardRedirect() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    router.replace(defaultRouteForRole(user?.role));
  }, [isLoading, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}
