"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Inbox,
  Map,
  Package,
  Route,
  Settings,
  Shapes,
  Truck,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/auth";
import { UserMenu } from "./UserMenu";

interface NavItem {
  label: string;
  href: string;
  icon: typeof Shapes;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Driver Zones", href: "/driver-zones", icon: Shapes, roles: ["driver", "admin"] },
  { label: "Orders", href: "/orders", icon: Package, roles: ["sender", "receiver", "admin"] },
  { label: "Receivers", href: "/receivers", icon: Inbox, roles: ["sender", "admin"] },
  { label: "Drivers", href: "/drivers", icon: Truck, roles: ["sender", "receiver", "admin"] },
  { label: "Map View", href: "/map-view", icon: Map, roles: ["driver", "sender", "receiver", "admin"] },
  { label: "H3 Cells", href: "/h3-cells", icon: Boxes, roles: ["driver", "sender", "admin"] },
  { label: "Routes", href: "/routes", icon: Route, roles: ["sender", "admin"] },
  { label: "Settings", href: "/settings", icon: Settings, roles: ["driver", "sender", "receiver", "admin"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const role = user?.role;

  const items = NAV_ITEMS.filter((i) => (role ? i.roles.includes(role) : false));

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-sidebar sticky top-0 h-screen">
      <div className="h-20 flex items-center gap-3 px-5 border-b border-border">
        <Image src="/logo.png" alt="Multi-Driver Transport" width={40} height={40} className="rounded-lg" />
        <div>
          <p className="text-sm font-semibold text-foreground leading-tight">Multi-Driver</p>
          <p className="text-xs text-muted-foreground capitalize">{role ?? "Transport"}</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
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

      <UserMenu compact />
    </aside>
  );
}
