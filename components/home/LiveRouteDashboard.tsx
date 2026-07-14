"use client";

import { useState } from "react";
import {
  ArrowRight,
  MapPin,
  Plane,
  Ship,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const routes = [
  {
    id: "A",
    name: "Route A",
    badge: "Best Value",
    badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    modes: ["land", "air", "sea"] as const,
    transfers: 3,
    time: "8h 45m",
    price: "$93.00",
  },
  {
    id: "B",
    name: "Route B",
    badge: "Fastest",
    badgeClass: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    modes: ["air", "land"] as const,
    transfers: 2,
    time: "5h 20m",
    price: "$128.00",
  },
  {
    id: "C",
    name: "Route C",
    badge: "Eco",
    badgeClass: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    modes: ["sea", "land", "sea"] as const,
    transfers: 4,
    time: "2d 6h",
    price: "$71.50",
  },
];

const stops = [
  { label: "Pickup", place: "New York, USA", mode: "land" as const, x: 12, y: 58 },
  { label: "London Hub", place: "Transfer", mode: "air" as const, x: 38, y: 32 },
  { label: "Dubai Port", place: "Sea leg", mode: "sea" as const, x: 62, y: 48 },
  { label: "Delivery", place: "Singapore", mode: "land" as const, x: 88, y: 68 },
];

const modeFilters = [
  { id: "air", label: "Air", icon: Plane },
  { id: "land", label: "Land", icon: Truck },
  { id: "sea", label: "Sea", icon: Ship },
] as const;

function ModeIcon({ mode, className }: { mode: "air" | "land" | "sea"; className?: string }) {
  const Icon = mode === "air" ? Plane : mode === "sea" ? Ship : Truck;
  const color =
    mode === "air"
      ? "text-sky-500"
      : mode === "sea"
        ? "text-violet-500"
        : "text-emerald-500";
  return <Icon className={cn("h-3.5 w-3.5", color, className)} />;
}

export function LiveRouteDashboard() {
  const [selected, setSelected] = useState("A");
  const [filter, setFilter] = useState<"air" | "land" | "sea" | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 animate-fade-in-up">
      {/* Top Route Options */}
      <div className="rounded-2xl border border-border bg-card shadow-card p-4 sm:p-5">
        <h3 className="font-semibold mb-4">Top Route Options</h3>
        <div className="space-y-3">
          {routes.map((route) => (
            <button
              key={route.id}
              type="button"
              onClick={() => setSelected(route.id)}
              className={cn(
                "w-full text-left rounded-xl border p-3.5 transition-all",
                selected === route.id
                  ? "border-primary bg-primary/5 shadow-card"
                  : "border-border bg-background hover:border-primary/40",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{route.name}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        route.badgeClass,
                      )}
                    >
                      {route.badge}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    {route.modes.map((m, i) => (
                      <span key={`${route.id}-${m}-${i}`} className="flex items-center gap-1">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                          <ModeIcon mode={m} />
                        </span>
                        {i < route.modes.length - 1 && (
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        )}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {route.price}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{route.time}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {route.transfers} Transfers · Est. {route.time}
                </p>
                <span
                  className={cn(
                    "inline-flex h-7 items-center rounded-lg px-2.5 text-xs font-medium",
                    selected === route.id
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-foreground",
                  )}
                >
                  Select
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Live Route Preview */}
      <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden flex flex-col min-h-[420px]">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border">
          <h3 className="font-semibold text-sm">Live Route Preview</h3>
          <div className="flex items-center gap-1 rounded-full border border-border bg-muted/60 p-1">
            {modeFilters.map((m) => {
              const Icon = m.icon;
              const active = filter === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setFilter(active ? null : m.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative flex-1 bg-gradient-to-br from-accent via-muted/40 to-background p-4 sm:p-6">
          {/* Soft map grid */}
          <div
            className="absolute inset-4 sm:inset-6 rounded-2xl border border-border/60 bg-card/40 dark:bg-card/20 overflow-hidden"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, rgba(0,97,255,0.08), transparent 40%), radial-gradient(circle at 75% 65%, rgba(0,97,255,0.06), transparent 35%)",
            }}
          >
            <svg className="absolute inset-0 h-full w-full opacity-[0.35] dark:opacity-[0.25]" aria-hidden>
              {Array.from({ length: 8 }).map((_, i) => (
                <line
                  key={`h-${i}`}
                  x1="0"
                  y1={`${(i + 1) * 12}%`}
                  x2="100%"
                  y2={`${(i + 1) * 12}%`}
                  stroke="currentColor"
                  strokeWidth="0.5"
                  className="text-border"
                />
              ))}
              {Array.from({ length: 10 }).map((_, i) => (
                <line
                  key={`v-${i}`}
                  x1={`${(i + 1) * 9}%`}
                  y1="0"
                  x2={`${(i + 1) * 9}%`}
                  y2="100%"
                  stroke="currentColor"
                  strokeWidth="0.5"
                  className="text-border"
                />
              ))}
            </svg>

            {/* Route path */}
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              <path
                d="M12,58 C22,50 30,36 38,32 C48,28 54,42 62,48 C72,56 80,64 88,68"
                fill="none"
                stroke="rgb(0,97,255)"
                strokeWidth="0.9"
                strokeDasharray="2.5 1.8"
                opacity="0.85"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M12,58 C18,55 22,52 28,45"
                fill="none"
                stroke="rgb(16,185,129)"
                strokeWidth="1.2"
                opacity="0.9"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M38,32 C48,28 54,42 62,48"
                fill="none"
                stroke="rgb(14,165,233)"
                strokeWidth="1.2"
                opacity="0.9"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M62,48 C72,56 80,64 88,68"
                fill="none"
                stroke="rgb(139,92,246)"
                strokeWidth="1.2"
                opacity="0.9"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {stops.map((stop) => {
              if (filter && stop.mode !== filter && stop.label !== "Pickup" && stop.label !== "Delivery") {
                return null;
              }
              return (
                <div
                  key={stop.label}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${stop.x}%`, top: `${stop.y}%` }}
                >
                  <div className="relative flex flex-col items-center">
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border-2 border-card shadow-card-lg",
                        stop.label === "Pickup" || stop.label === "Delivery"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card text-foreground",
                      )}
                    >
                      {stop.label === "Pickup" || stop.label === "Delivery" ? (
                        <MapPin className="h-4 w-4" />
                      ) : (
                        <ModeIcon mode={stop.mode} className="h-4 w-4" />
                      )}
                    </div>
                    <div className="mt-2 rounded-lg border border-border bg-card/95 px-2.5 py-1.5 shadow-card whitespace-nowrap">
                      <p className="text-[11px] font-semibold leading-none">{stop.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 leading-none">
                        {stop.place}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 px-5 py-3 border-t border-border text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Land
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-500" /> Air
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-violet-500" /> Sea
          </span>
          <Button size="sm" className="ml-auto h-8">
            Book selected route
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
