import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CURRENCIES, type Currency } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function normalizeCurrencyCode(code: string | null | undefined): Currency {
  if (!code) return "USD";
  const upper = code.trim().toUpperCase();
  return (CURRENCIES as readonly string[]).includes(upper) ? (upper as Currency) : "USD";
}

/** Locale-aware currency formatter. Falls back to `CODE 0.00` if Intl fails. */
export function formatCurrency(amount: number, currency: string | null | undefined): string {
  const code = normalizeCurrencyCode(currency);
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      // narrowSymbol keeps things compact for currencies like CAD ("$" vs
      // "CA$"), AUD, HKD — the ISO code is shown separately where ambiguity
      // matters (e.g. ZoneDetailCard).
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `${code} ${safe.toFixed(2)}`;
  }
}

/** Returns e.g. "EUR — Euro" using the host's CLDR data; falls back to the code. */
export function currencyLabel(code: Currency): string {
  try {
    const display = new Intl.DisplayNames(["en"], { type: "currency" }).of(code);
    return display ? `${code} — ${display}` : code;
  } catch {
    return code;
  }
}

export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function userInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
