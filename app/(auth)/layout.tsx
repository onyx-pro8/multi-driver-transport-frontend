"use client";

import { Suspense } from "react";
import { GuestGuard } from "@/components/auth/GuestGuard";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      }
    >
      <GuestGuard>{children}</GuestGuard>
    </Suspense>
  );
}
