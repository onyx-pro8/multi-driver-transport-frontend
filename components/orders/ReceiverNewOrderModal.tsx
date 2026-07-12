"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Order } from "@/types";
import { ReceiverNewOrderForm, RECEIVER_NEW_ORDER_FORM_ID } from "./ReceiverNewOrderForm";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (order: Order) => void;
  onMessage: (text: string, type?: "success" | "error") => void;
}

export function ReceiverNewOrderModal({ open, onClose, onCreated, onMessage }: Props) {
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setSubmitting(false);
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, submitting, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receiver-new-order-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Close"
        disabled={submitting}
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-gradient-to-r from-primary/8 via-primary/4 to-transparent px-5 py-4 sm:px-6">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Send className="h-4 w-4" />
              </div>
              <h2 id="receiver-new-order-title" className="text-lg font-semibold tracking-tight">
                New shipment request
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Choose a sender, describe your order, and submit. They will review before routes are
              connected.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Close"
            disabled={submitting}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <ReceiverNewOrderForm
            formId={RECEIVER_NEW_ORDER_FORM_ID}
            hideSubmitButton
            onSubmittingChange={setSubmitting}
            onCreated={(order) => {
              onCreated(order);
              onClose();
            }}
            onMessage={onMessage}
          />
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-muted/20 px-5 py-4 sm:px-6">
          <Button type="button" variant="outline" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={RECEIVER_NEW_ORDER_FORM_ID} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit shipment request"
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
