"use client";

import {
  MAX_PAYMENT_PACKAGES,
  PAYMENT_PACKAGE_TYPE_LABELS,
  PAYMENT_PACKAGE_TYPES,
  defaultPaymentPackageEntry,
  paymentPackageFormEntryFromOrder,
  type PaymentPackageFormEntry,
} from "@/lib/paymentPackages";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Props {
  packages: PaymentPackageFormEntry[];
  onChange: (packages: PaymentPackageFormEntry[]) => void;
}

export function PaymentPackageFields({ packages, onChange }: Props) {
  function updateAt(index: number, patch: Partial<PaymentPackageFormEntry>) {
    onChange(packages.map((pkg, i) => (i === index ? { ...pkg, ...patch } : pkg)));
  }

  function addPackage() {
    if (packages.length >= MAX_PAYMENT_PACKAGES) return;
    onChange([...packages, paymentPackageFormEntryFromOrder(defaultPaymentPackageEntry())]);
  }

  function removeAt(index: number) {
    if (packages.length <= 1) return;
    onChange(packages.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3 rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
      <div>
        <p className="text-sm font-medium">Payment package (PFF)</p>
        <p className="text-xs text-muted-foreground mt-1">
          Cheque or cash collected at your address first, then delivered to the producer before
          goods ship.
        </p>
      </div>

      {packages.map((pkg, index) => (
        <div
          key={index}
          className="grid gap-3 sm:grid-cols-2 rounded-md border border-border/60 bg-background/80 p-3"
        >
          <div className="sm:col-span-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Payment package {index + 1}</p>
            {packages.length > 1 ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => removeAt(index)}>
                Remove
              </Button>
            ) : null}
          </div>
          <div>
            <Label>Payment type</Label>
            <Select
              value={pkg.payment_type}
              onChange={(e) =>
                updateAt(index, {
                  payment_type: e.target.value as PaymentPackageFormEntry["payment_type"],
                })
              }
            >
              {PAYMENT_PACKAGE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PAYMENT_PACKAGE_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Description</Label>
            <Input
              value={pkg.description}
              onChange={(e) => updateAt(index, { description: e.target.value })}
              placeholder="e.g. Cheque for order total"
            />
          </div>
          <div>
            <Label>Weight (lb)</Label>
            <Input
              inputMode="decimal"
              value={pkg.weight_lbs}
              onChange={(e) => updateAt(index, { weight_lbs: e.target.value })}
            />
          </div>
          <div>
            <Label>Length (in)</Label>
            <Input
              inputMode="decimal"
              value={pkg.package_length}
              onChange={(e) => updateAt(index, { package_length: e.target.value })}
            />
          </div>
          <div>
            <Label>Width (in)</Label>
            <Input
              inputMode="decimal"
              value={pkg.package_width}
              onChange={(e) => updateAt(index, { package_width: e.target.value })}
            />
          </div>
          <div>
            <Label>Height (in)</Label>
            <Input
              inputMode="decimal"
              value={pkg.package_height}
              onChange={(e) => updateAt(index, { package_height: e.target.value })}
            />
          </div>
        </div>
      ))}

      {packages.length < MAX_PAYMENT_PACKAGES ? (
        <Button type="button" size="sm" variant="outline" onClick={addPackage}>
          Add payment package
        </Button>
      ) : null}
    </div>
  );
}
