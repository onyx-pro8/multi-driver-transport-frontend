export const PACKAGE_TYPES = [
  "letter",
  "extra_small",
  "small",
  "medium_small",
  "medium",
  "medium_large",
  "large",
  "extra_large",
] as const;

export type PackageType = (typeof PACKAGE_TYPES)[number];

export const PACKAGE_TYPE_LABELS: Record<PackageType, string> = {
  letter: "Letter",
  extra_small: "Extra Small",
  small: "Small",
  medium_small: "Medium-small",
  medium: "Medium",
  medium_large: "Medium-large",
  large: "Large",
  extra_large: "Extra Large",
};

export const PACKAGE_FACTORS: Record<PackageType, number> = {
  letter: 0.01,
  extra_small: 0.01,
  small: 0.02,
  medium_small: 0.022,
  medium: 0.05,
  medium_large: 0.09,
  large: 0.2,
  extra_large: 0.6,
};

export function packageFactorForType(type: PackageType): number {
  return PACKAGE_FACTORS[type];
}

export const PRICING_UNITS = {
  weight: "lb",
  dimension: "in",
  distance: "km",
  time: "hr",
} as const;

export const DEFAULT_BOOKING_FEE_RATE = 0.02;

export const DEFAULT_LAND_SPEED_KMH = 50;

/** Format booking fee rate (0.02) as a display percent string. */
export function formatBookingFeePercent(rate: number): string {
  const pct = rate * 100;
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2)}%`;
}
