"use client";

import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import type { Order } from "@/types";
import { updateOrderPackage } from "@/lib/api";
import {
  PACKAGE_TYPE_LABELS,
  PACKAGE_TYPES,
  packageFactorForType,
  type PackageType,
} from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { OrderPackageSummary } from "@/components/orders/OrderPackageSummary";

interface Props {
  order: Order;
  canEdit: boolean;
  onUpdated?: (order: Order) => void;
  onCostsRecalculated?: () => void;
  onMessage?: (text: string, type?: "success" | "error") => void;
}

export function OrderPackageEditor({
  order,
  canEdit,
  onUpdated,
  onCostsRecalculated,
  onMessage,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [packageType, setPackageType] = useState<PackageType>(
    (order.package_type as PackageType) ?? "medium"
  );
  const [weightLbs, setWeightLbs] = useState(
    order.weight_lbs != null ? String(order.weight_lbs) : ""
  );
  const [length, setLength] = useState(
    order.package_length != null ? String(order.package_length) : ""
  );
  const [width, setWidth] = useState(
    order.package_width != null ? String(order.package_width) : ""
  );
  const [height, setHeight] = useState(
    order.package_height != null ? String(order.package_height) : ""
  );
  const [description, setDescription] = useState(order.package_description ?? "");

  if (!editing) {
    return (
      <div className="space-y-2">
        <OrderPackageSummary order={order} />
        {canEdit && order.status === "submitted" && (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit package
          </Button>
        )}
      </div>
    );
  }

  async function handleSave() {
    const weight = weightLbs.trim() ? Number(weightLbs) : null;
    const len = length.trim() ? Number(length) : null;
    const w = width.trim() ? Number(width) : null;
    const h = height.trim() ? Number(height) : null;
    if (weight != null && (!Number.isFinite(weight) || weight <= 0)) {
      onMessage?.("Enter a valid weight in lbs", "error");
      return;
    }
    setSaving(true);
    try {
      const result = await updateOrderPackage(order.id, {
        package_type: packageType,
        weight_lbs: weight,
        package_length: len,
        package_width: w,
        package_height: h,
        package_description: description.trim(),
      });
      onUpdated?.(result.order);
      if (result.route_cost_recalculated) {
        onCostsRecalculated?.();
        onMessage?.("Package updated and route costs recalculated.");
      } else {
        onMessage?.("Package updated. Route costs will refresh when routes are available.");
      }
      setEditing(false);
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : "Failed to update package", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Package type</Label>
          <Select
            value={packageType}
            onChange={(e) => setPackageType(e.target.value as PackageType)}
          >
            {PACKAGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {PACKAGE_TYPE_LABELS[t]} (×{packageFactorForType(t)})
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Weight (lb)</Label>
          <Input inputMode="decimal" value={weightLbs} onChange={(e) => setWeightLbs(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Length (in)</Label>
          <Input inputMode="decimal" value={length} onChange={(e) => setLength(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Width (in)</Label>
          <Input inputMode="decimal" value={width} onChange={(e) => setWidth(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Height (in)</Label>
          <Input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save package
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={saving}
          onClick={() => setEditing(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
