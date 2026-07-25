"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

export interface ChartSlice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  title: string;
  slices: ChartSlice[];
  className?: string;
}

type NamedSlice = ChartSlice & { name: string };

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: NamedSlice }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const name = item.name ?? item.payload?.label ?? item.payload?.name ?? "";
  const value = Number(item.value ?? 0);
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">{name}</p>
      <p className="mt-0.5 tabular-nums text-muted-foreground">{value}</p>
    </div>
  );
}

/** Recharts donut — large, interactive, with compact legend. */
export function OrderStatusDonutChart({ title, slices, className }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const data = useMemo<NamedSlice[]>(
    () => slices.map((s) => ({ ...s, name: s.label })),
    [slices]
  );

  return (
    <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
      <p className="text-sm font-semibold tracking-tight">{title}</p>
      <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <div className="relative h-56 w-56 shrink-0 sm:h-64 sm:w-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="58%"
                outerRadius="88%"
                paddingAngle={total > 0 ? 2 : 0}
                cornerRadius={6}
                stroke="none"
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.label}
                    fill={entry.color}
                    opacity={
                      activeIndex == null || activeIndex === index ? 1 : 0.45
                    }
                    style={{
                      filter:
                        activeIndex === index
                          ? "drop-shadow(0 4px 10px rgba(0,0,0,.18))"
                          : undefined,
                      transition: "opacity 160ms ease",
                      cursor: "pointer",
                    }}
                  />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-4xl font-bold tabular-nums leading-none tracking-tight">
              {total}
            </p>
            <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Total
            </p>
          </div>
        </div>

        <ul className="w-full min-w-0 max-w-sm flex-1 space-y-2">
          {slices.map((s, index) => {
            const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
            const active = activeIndex === index;
            return (
              <li
                key={s.label}
                className={cn(
                  "flex cursor-default items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                  active
                    ? "border-primary/30 bg-primary/5"
                    : "border-transparent bg-muted/35"
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full ring-2 ring-background"
                  style={{ backgroundColor: s.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {s.label}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {pct}%
                </span>
                <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {s.value}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

interface BarProps {
  title: string;
  bars: ChartSlice[];
  className?: string;
}

/** Recharts bar chart for workflow breakdown. */
export function OrderStatusBarChart({ title, bars, className }: BarProps) {
  const total = bars.reduce((sum, b) => sum + b.value, 0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const data = useMemo(
    () =>
      bars.map((b) => ({
        name: b.label,
        label: b.label,
        value: b.value,
        fill: b.color,
      })),
    [bars]
  );

  return (
    <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold tracking-tight">{title}</p>
        <p className="text-xs text-muted-foreground tabular-nums">{total} total</p>
      </div>

      <div className="mt-4 h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
            barCategoryGap="28%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="hsl(var(--border))"
            />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              height={32}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={32}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.45 }}
              content={<ChartTooltip />}
            />
            <Bar
              dataKey="value"
              radius={[8, 8, 0, 0]}
              maxBarSize={48}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={entry.fill}
                  opacity={activeIndex == null || activeIndex === index ? 1 : 0.45}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
        {bars.map((b, index) => {
          const active = activeIndex === index;
          return (
            <li
              key={b.label}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs transition-colors",
                active ? "bg-primary/10 text-foreground" : "text-muted-foreground"
              )}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: b.color }}
                aria-hidden
              />
              <span className="font-medium">{b.label}</span>
              <span className="tabular-nums font-semibold text-foreground">{b.value}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
