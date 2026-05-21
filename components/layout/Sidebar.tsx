"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  LayoutDashboard,
  Map,
  Route,
  Settings,
  Shapes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "./UserMenu";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, disabled: false },
  { label: "Driver Zones", href: "/driver-zones", icon: Shapes, disabled: false },
  { label: "H3 Cells", href: "/h3-cells", icon: Boxes, disabled: false },
  { label: "Routes", href: "/routes", icon: Route, disabled: false },
  { label: "Map View", href: "/map-view", icon: Map, disabled: false },
  { label: "Settings", href: "/settings", icon: Settings, disabled: false },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-sidebar sticky top-0 h-screen">
      <div className="h-20 flex items-center gap-3 px-5 border-b border-border">
        <Image src="/logo.png" alt="Multi-Driver Transport" width={40} height={40} className="rounded-lg" />
        <div>
          <p className="text-sm font-semibold text-foreground leading-tight">Multi-Driver</p>
          <p className="text-xs text-muted-foreground">Transport</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-active text-primary"
                  : "text-sidebar-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* <div className="mx-4 mb-4 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>Milestone Progress</span>
          <span className="font-semibold text-primary">1/7</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full w-[14%] rounded-full bg-primary" />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">H3 Conversion &amp; Driver Zones</p>
      </div> */}

      <UserMenu compact />
    </aside>
  );
}
