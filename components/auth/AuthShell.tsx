"use client";

import Image from "next/image";
import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = (theme === "system" ? resolvedTheme : theme) === "dark";

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden border-r border-border bg-gradient-to-br from-primary/10 via-accent to-background">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-20 right-20 h-48 w-48 rounded-full bg-primary/10 blur-2xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16">
          <Image
            src="/logo.png"
            alt="Multi-Driver Transport"
            width={72}
            height={72}
            className="rounded-2xl mb-6"
          />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Multi-Driver Transport
          </h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-md">
            H3-powered logistics platform for multi-driver zone management, route planning, and
            transfer optimization.
          </p>
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Milestone 1 — H3 Conversion &amp; Driver Zones
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-screen">
        <div className="flex items-center justify-between px-6 py-4 lg:px-10">
          <Link href="/login" className="flex items-center gap-3 lg:hidden">
            <Image src="/logo.png" alt="Logo" width={40} height={40} className="rounded-lg" />
            <span className="text-sm font-semibold">Multi-Driver Transport</span>
          </Link>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              aria-label="Toggle theme"
              onClick={() => setTheme(isDark ? "light" : "dark")}
            >
              {mounted ? (
                isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <div className="w-full max-w-md">
            <div className="mb-8 text-center lg:text-left">
              <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            </div>
            <Card className="shadow-card-lg">
              <CardContent className="p-6 pt-6">{children}</CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
