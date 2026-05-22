"use client";

import Image from "next/image";
import Link from "next/link";
import { Moon, Sun, Sparkles } from "lucide-react";
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
      {/* Left panel — imagery + gradient */}
      <div className="hidden lg:flex lg:w-[48%] xl:w-1/2 relative overflow-hidden">
        <Image
          src="/auth-bg.png"
          alt=""
          fill
          sizes="(min-width: 1024px) 50vw, 0px"
          className="object-cover"
          priority
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-[#0f172a]/80 to-[#0f172a]/95" />
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-16 left-16 h-64 w-64 rounded-full bg-primary/30 blur-3xl animate-float" />
          <div className="absolute bottom-24 right-12 h-48 w-48 rounded-full bg-cyan-500/20 blur-2xl animate-float-delayed" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full text-white">
          <Link href="/" className="flex items-center gap-3 w-fit animate-fade-in">
            <Image src="/logo.png" alt="Multi-Driver Transport" width={48} height={48} className="rounded-xl" />
            <span className="font-semibold text-lg">Multi-Driver Transport</span>
          </Link>

          <div className="animate-fade-in-up [animation-delay:120ms]">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-1 text-xs font-medium mb-6 border border-white/10">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              H3 geospatial logistics
            </div>
            <h1 className="text-3xl xl:text-4xl font-bold tracking-tight leading-tight text-balance">
              One platform for drivers, senders &amp; receivers
            </h1>
            <p className="mt-4 text-base text-white/75 max-w-md leading-relaxed">
              Drivers define H3-powered coverage with per-zone rates. Senders create orders to
              receivers. Receivers confirm delivery.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-white/70">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Driver zones with rate, mode &amp; availability
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Orders flow: submitted → delivering → received
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Follow drivers to grow their trustworthiness
              </li>
            </ul>
          </div>

          <p className="text-xs text-white/40 animate-fade-in [animation-delay:300ms]">
            Secure JWT authentication · PostgreSQL + H3
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col min-h-screen relative">
        <div className="absolute inset-0 lg:hidden bg-gradient-to-b from-primary/8 via-background to-background pointer-events-none" />
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl lg:hidden animate-float pointer-events-none" />

        <div className="relative flex items-center justify-between px-6 py-4 lg:px-10">
          <Link href="/" className="flex items-center gap-3 lg:hidden animate-fade-in">
            <Image src="/logo.png" alt="Logo" width={40} height={40} className="rounded-lg" />
            <span className="text-sm font-semibold">Multi-Driver Transport</span>
          </Link>
          <Link
            href="/"
            className="hidden lg:inline text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to home
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

        <div className="relative flex-1 flex items-center justify-center px-6 pb-12">
          <div className="w-full max-w-md animate-fade-in-up">
            <div className="mb-8 text-center lg:text-left">
              <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            </div>
            <Card className="shadow-card-lg border-border/80 backdrop-blur-sm bg-card/95">
              <CardContent className="p-6 pt-6">{children}</CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
