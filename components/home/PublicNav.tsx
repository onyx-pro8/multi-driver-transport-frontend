"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#for-drivers", label: "For Drivers" },
  { href: "#about", label: "Pricing" },
  { href: "#about", label: "About" },
];

export function PublicNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = (theme === "system" ? resolvedTheme : theme) === "dark";

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-card/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl h-16 flex items-center justify-between gap-4 px-6">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <Image
            src="/logo.png"
            alt="Multi-Driver Transport"
            width={36}
            height={36}
            className="rounded-lg"
          />
          <span className="text-sm font-semibold hidden sm:inline">
            Multi-Driver Transport
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-7 text-sm text-muted-foreground">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label="Toggle theme"
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {mounted ? (
              isDark ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )
            ) : (
              <Sun className="h-4 w-4" />
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
                  <Link href="/register" className="hidden sm:block">
                    <Button size="sm">Get Started</Button>
                  </Link>
                  <Link href="/login" className="hidden sm:block">
                    <Button variant="outline" size="sm">
                      Sign in
                    </Button>
                  </Link>
                </>
              )}
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {menuOpen && (
        <div className="lg:hidden border-t border-border bg-card px-6 py-4 space-y-3">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          {!isLoading && !isAuthenticated && (
            <div className="flex flex-col gap-2 pt-2 sm:hidden">
              <Link href="/register" onClick={() => setMenuOpen(false)}>
                <Button size="sm" className="w-full">
                  Get Started
                </Button>
              </Link>
              <Link href="/login" onClick={() => setMenuOpen(false)}>
                <Button variant="outline" size="sm" className="w-full">
                  Sign in
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
