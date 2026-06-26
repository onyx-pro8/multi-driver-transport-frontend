export type ToastVariant = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

const AUTO_DISMISS_MS = 5000;
const MAX_TOASTS = 5;

let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();
const timers = new Map<number, number>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function removeToast(id: number): void {
  const timer = timers.get(id);
  if (timer != null) {
    clearTimeout(timer);
    timers.delete(id);
  }
  const next = toasts.filter((t) => t.id !== id);
  if (next.length !== toasts.length) {
    toasts = next;
    emit();
  }
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToastsSnapshot(): ToastItem[] {
  return toasts;
}

export function dismissToast(id: number): void {
  removeToast(id);
}

export function showToast(message: string, variant: ToastVariant = "info"): void {
  if (!message.trim()) return;

  const id = Date.now() + Math.floor(Math.random() * 1000);
  toasts = [...toasts.slice(-(MAX_TOASTS - 1)), { id, message, variant }];
  emit();

  if (typeof window !== "undefined") {
    const timer = window.setTimeout(() => removeToast(id), AUTO_DISMISS_MS);
    timers.set(id, timer);
  }
}
