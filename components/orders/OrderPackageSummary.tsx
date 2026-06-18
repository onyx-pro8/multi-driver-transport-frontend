"use client";

import type { Order } from "@/types";
import { PACKAGE_TYPE_LABELS, type PackageType } from "@/lib/pricing";

export function OrderPackageSummary({ order }: { order: Pick<Order, "package_type" | "package_factor" | "weight_lbs" | "package_length" | "package_width" | "package_height" | "dimensions" | "package_description"> }) {
  const typeLabel =
    order.package_type != null
      ? PACKAGE_TYPE_LABELS[order.package_type as PackageType]
      : "Not set (defaults to Medium at costing)";
  const dims =
    order.package_length != null && order.package_width != null && order.package_height != null
      ? `${order.package_length} × ${order.package_width} × ${order.package_height} in`
      : order.dimensions || "—";

  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div>
        <p className="text-muted-foreground">Package type</p>
        <p className="font-medium">{typeLabel}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Package factor</p>
        <p className="font-medium">{order.package_factor ?? "—"}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Weight</p>
        <p className="font-medium">
          {order.weight_lbs != null ? `${order.weight_lbs} lb` : "—"}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground">Dimensions</p>
        <p className="font-medium">{dims}</p>
      </div>
      {order.package_description ? (
        <div className="col-span-2 sm:col-span-4">
          <p className="text-muted-foreground">Description</p>
          <p className="font-medium">{order.package_description}</p>
        </div>
      ) : null}
    </div>
  );
}
