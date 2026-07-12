"use client";

import Image from "next/image";
import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function PublicNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = (theme === "system" ? resolvedTheme : theme) === "dark";

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-card/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl h-16 flex items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo.png" alt="Multi-Driver Transport" width={36} height={36} className="rounded-lg" />
          <span className="text-sm font-semibold hidden sm:inline">Multi-Driver Transport</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="hover:text-foreground transition-colors">
            How it works
          </a>
        </nav>

        <div className="flex items-center gap-2">
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
          {!isLoading && (
            <>
              {isAuthenticated ? (
                <Link href="/dashboard">
                  <Button size="sm">Open app</Button>
                </Link>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="ghost" size="sm">
                      Sign in
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button size="sm">Get started</Button>
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
