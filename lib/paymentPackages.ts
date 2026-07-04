export const PAYMENT_PACKAGE_TYPES = ["cheque", "cash", "money_order", "other"] as const;
export type PaymentPackageType = (typeof PAYMENT_PACKAGE_TYPES)[number];

export const MAX_PAYMENT_PACKAGES = 3;

export interface PaymentPackageEntry {
  payment_type: PaymentPackageType;
  description: string;
  weight_lbs: number;
  package_length: number;
  package_width: number;
  package_height: number;
}

export const PAYMENT_PACKAGE_TYPE_LABELS: Record<PaymentPackageType, string> = {
  cheque: "Cheque",
  cash: "Cash",
  money_order: "Money order",
  other: "Other",
};

export function defaultPaymentPackageEntry(
  type: PaymentPackageType = "cheque",
): PaymentPackageEntry {
  return {
    payment_type: type,
    description: type === "cash" ? "Cash payment" : "Payment cheque",
    weight_lbs: 0.5,
    package_length: 9,
    package_width: 4,
    package_height: 0.25,
  };
}

export function formatPaymentPackageDimensions(
  entry: Pick<PaymentPackageEntry, "package_length" | "package_width" | "package_height">,
): string {
  return `${entry.package_length} × ${entry.package_width} × ${entry.package_height} in`;
}

export interface PaymentPackageFormEntry {
  payment_type: PaymentPackageType;
  description: string;
  weight_lbs: string;
  package_length: string;
  package_width: string;
  package_height: string;
}

export function paymentPackageFormEntryFromOrder(
  entry: PaymentPackageEntry,
): PaymentPackageFormEntry {
  return {
    payment_type: entry.payment_type,
    description: entry.description,
    weight_lbs: String(entry.weight_lbs),
    package_length: String(entry.package_length),
    package_width: String(entry.package_width),
    package_height: String(entry.package_height),
  };
}

export function parsePaymentPackageFormEntries(
  entries: PaymentPackageFormEntry[],
): { ok: true; packages: PaymentPackageEntry[] } | { ok: false; message: string } {
  const packages: PaymentPackageEntry[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const weight = Number(entry.weight_lbs.trim());
    const length = Number(entry.package_length.trim());
    const width = Number(entry.package_width.trim());
    const height = Number(entry.package_height.trim());
    if (!Number.isFinite(weight) || weight <= 0) {
      return { ok: false, message: `Payment package ${i + 1}: enter a valid weight in lbs` };
    }
    if (!Number.isFinite(length) || length <= 0) {
      return { ok: false, message: `Payment package ${i + 1}: enter a valid length` };
    }
    if (!Number.isFinite(width) || width <= 0) {
      return { ok: false, message: `Payment package ${i + 1}: enter a valid width` };
    }
    if (!Number.isFinite(height) || height <= 0) {
      return { ok: false, message: `Payment package ${i + 1}: enter a valid height` };
    }
    packages.push({
      payment_type: entry.payment_type,
      description: entry.description.trim() || PAYMENT_PACKAGE_TYPE_LABELS[entry.payment_type],
      weight_lbs: weight,
      package_length: length,
      package_width: width,
      package_height: height,
    });
  }
  return { ok: true, packages };
}
