"use client";

import { FormEvent, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AddressSearchInput } from "@/components/ui/AddressSearchInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PAYMENT_METHOD_OPTIONS, isPffPaymentMethod } from "@/lib/paymentFlow";
import { createReceiverOrder, listSenders } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Order, SenderSummary } from "@/types";
import {
  PackageListFields,
  packageFormEntryFromOrder,
  parsePackageFormEntries,
  type PackageFormEntry,
} from "@/components/orders/PackageListFields";
import { PaymentPackageFields } from "@/components/orders/PaymentPackageFields";
import {
  defaultPaymentPackageEntry,
  paymentPackageFormEntryFromOrder,
  parsePaymentPackageFormEntries,
  type PaymentPackageFormEntry,
} from "@/lib/paymentPackages";
import { defaultOrderPackageEntry } from "@/lib/pricing";

export const RECEIVER_NEW_ORDER_FORM_ID = "receiver-new-order-form";

interface Props {
  onCreated: (order: Order) => void;
  onMessage: (text: string, type?: "success" | "error") => void;
  formId?: string;
  hideSubmitButton?: boolean;
  onSubmittingChange?: (submitting: boolean) => void;
}

function senderDisplayLabel(sender: SenderSummary): string {
  return `${sender.full_name} · ${sender.email}`;
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-muted/15 p-4 sm:p-5 space-y-4">
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function ReceiverNewOrderForm({
  onCreated,
  onMessage,
  formId = RECEIVER_NEW_ORDER_FORM_ID,
  hideSubmitButton = false,
  onSubmittingChange,
}: Props) {
  const { user } = useAuth();
  const [senderInput, setSenderInput] = useState("");
  const [selectedSender, setSelectedSender] = useState<SenderSummary | null>(null);
  const [senders, setSenders] = useState<SenderSummary[]>([]);
  const [sendersLoading, setSendersLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const senderContainerRef = useRef<HTMLDivElement | null>(null);
  const skipNextSearch = useRef(false);
  const [deliveryAddress, setDeliveryAddress] = useState(() => user?.address ?? "");
  const [deliveryLat, setDeliveryLat] = useState(() =>
    user?.lat != null ? String(user.lat) : ""
  );
  const [deliveryLng, setDeliveryLng] = useState(() =>
    user?.lng != null ? String(user.lng) : ""
  );
  const [receiverBillingAddress, setReceiverBillingAddress] = useState(() => user?.address ?? "");
  const [notes, setNotes] = useState("");
  const [packageDescription, setPackageDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [packages, setPackages] = useState<PackageFormEntry[]>([
    packageFormEntryFromOrder(defaultOrderPackageEntry()),
  ]);
  const [paymentPackages, setPaymentPackages] = useState<PaymentPackageFormEntry[]>([
    paymentPackageFormEntryFromOrder(defaultPaymentPackageEntry()),
  ]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    onSubmittingChange?.(submitting);
  }, [submitting, onSubmittingChange]);

  useEffect(() => {
    if (user?.address) {
      setReceiverBillingAddress(user.address);
      setDeliveryAddress(user.address);
    }
    if (user?.lat != null && user?.lng != null) {
      setDeliveryLat(String(user.lat));
      setDeliveryLng(String(user.lng));
    }
  }, [user?.address, user?.lat, user?.lng]);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }

    const q = senderInput.trim();
    if (q.length < 2) {
      setSenders([]);
      setSendersLoading(false);
      return;
    }
    if (selectedSender && q === senderDisplayLabel(selectedSender)) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setSendersLoading(true);
      listSenders(q)
        .then((data) => {
          if (!cancelled) {
            setSenders(data);
            setDropdownOpen(true);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            onMessage(err instanceof Error ? err.message : "Failed to search senders", "error");
            setSenders([]);
          }
        })
        .finally(() => {
          if (!cancelled) setSendersLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [senderInput, selectedSender, onMessage]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!senderContainerRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function handleSenderInputChange(value: string) {
    setSenderInput(value);
    if (selectedSender && value !== senderDisplayLabel(selectedSender)) {
      setSelectedSender(null);
    }
    if (value.trim().length >= 2) {
      setDropdownOpen(true);
    } else {
      setSenders([]);
      setDropdownOpen(false);
    }
  }

  function handleSelectSender(sender: SenderSummary) {
    setSelectedSender(sender);
    skipNextSearch.current = true;
    setSenderInput(senderDisplayLabel(sender));
    setSenders([]);
    setDropdownOpen(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedSender) {
      onMessage("Search and select a sender to ship with.", "error");
      return;
    }
    const dLat = Number(deliveryLat);
    const dLng = Number(deliveryLng);
    if (!deliveryAddress.trim() || !Number.isFinite(dLat) || !Number.isFinite(dLng)) {
      onMessage("Enter a ship-to address with valid coordinates.", "error");
      return;
    }

    const parsedPackages = parsePackageFormEntries(packages);
    if (!parsedPackages.ok) {
      onMessage(parsedPackages.message, "error");
      return;
    }

    const isPff = isPffPaymentMethod(paymentMethod);
    let parsedPaymentPackages: import("@/lib/paymentPackages").PaymentPackageEntry[] | undefined;
    if (isPff) {
      const paymentResult = parsePaymentPackageFormEntries(paymentPackages);
      if (!paymentResult.ok) {
        onMessage(paymentResult.message, "error");
        return;
      }
      parsedPaymentPackages = paymentResult.packages;
    }

    setSubmitting(true);
    try {
      const order = await createReceiverOrder({
        sender_user_id: selectedSender.id,
        destination_address: deliveryAddress.trim(),
        destination_lat: dLat,
        destination_lng: dLng,
        receiver_billing_address: receiverBillingAddress.trim() || undefined,
        notes: notes.trim() || undefined,
        payment_method: paymentMethod || undefined,
        package_description: packageDescription.trim() || undefined,
        packages: parsedPackages.packages,
        payment_packages: parsedPaymentPackages,
      });
      onMessage("Shipment request submitted.", "success");
      onCreated(order);
      setSelectedSender(null);
      setSenderInput("");
      setSenders([]);
      setNotes("");
      setPackageDescription("");
      setPackages([packageFormEntryFromOrder(defaultOrderPackageEntry())]);
      setPaymentPackages([paymentPackageFormEntryFromOrder(defaultPaymentPackageEntry())]);
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Failed to submit shipment request", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-5">
      <FormSection
        title="Sender"
        description="Search by name or email. Pickup uses the sender's address on file."
      >
        <div ref={senderContainerRef} className="relative">
          <Label htmlFor="sender-search">Search sender</Label>
          <Input
            id="sender-search"
            placeholder="Type name or email (min. 2 characters)…"
            value={senderInput}
            onChange={(e) => handleSenderInputChange(e.target.value)}
            onFocus={() => {
              if (senderInput.trim().length >= 2 && !selectedSender) {
                setDropdownOpen(true);
              }
            }}
            autoComplete="off"
          />

          {dropdownOpen && senderInput.trim().length >= 2 && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-background shadow-lg">
              {sendersLoading ? (
                <p className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                </p>
              ) : senders.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">No senders match your search.</p>
              ) : (
                <ul className="max-h-48 divide-y divide-border overflow-y-auto">
                  {senders.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectSender(s)}
                        className={cn(
                          "w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50",
                          selectedSender?.id === s.id && "bg-primary/10"
                        )}
                      >
                        <p className="font-medium">{s.full_name}</p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </FormSection>

      <FormSection title="Delivery" description="Where the shipment should be delivered.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Ship-to address</Label>
            <AddressSearchInput
              value={deliveryAddress}
              onChange={(text) => {
                setDeliveryAddress(text);
                if (deliveryLat || deliveryLng) {
                  setDeliveryLat("");
                  setDeliveryLng("");
                }
              }}
              onPick={(place) => {
                setDeliveryAddress(place.label);
                setDeliveryLat(String(place.lat));
                setDeliveryLng(String(place.lng));
              }}
            />
          </div>
          <div>
            <Label>Delivery latitude</Label>
            <Input inputMode="decimal" value={deliveryLat} onChange={(e) => setDeliveryLat(e.target.value)} />
          </div>
          <div>
            <Label>Delivery longitude</Label>
            <Input inputMode="decimal" value={deliveryLng} onChange={(e) => setDeliveryLng(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Billing address (optional)</Label>
            <Input
              value={receiverBillingAddress}
              onChange={(e) => setReceiverBillingAddress(e.target.value)}
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Package & order details"
        description="Describe what you are ordering so the sender can review your request."
      >
        <PackageListFields packages={packages} onChange={setPackages} />

        <div>
          <Label>Order description</Label>
          <textarea
            className="mt-1 flex min-h-[88px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            value={packageDescription}
            onChange={(e) => setPackageDescription(e.target.value)}
            placeholder="What are you ordering? Include product details the sender needs to review."
          />
        </div>

        <div>
          <Label>Notes (optional)</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Delivery instructions, timing, etc."
          />
        </div>
      </FormSection>

      <FormSection
        title="Payment"
        description="Choose how payment is handled for this shipment."
      >
        <div>
          <Label>Payment method</Label>
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {PAYMENT_METHOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose PFF (Advanced Payment) if a transporter delivers payment to the producer before
            goods ship.
          </p>
        </div>

        {isPffPaymentMethod(paymentMethod) ? (
          <PaymentPackageFields packages={paymentPackages} onChange={setPaymentPackages} />
        ) : null}
      </FormSection>

      {!hideSubmitButton ? (
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Submit shipment request
        </Button>
      ) : null}
    </form>
  );
}
