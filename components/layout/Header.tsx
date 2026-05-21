"use client";

import { Bell, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "./UserMenu";

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export function Header({
  title = "Dashboard",
  subtitle = "Overview of your multi-driver transport operations.",
}: HeaderProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = (theme === "system" ? resolvedTheme : theme) === "dark";

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="h-20 flex items-center justify-between gap-4 px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
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
          <Button variant="outline" size="sm" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
