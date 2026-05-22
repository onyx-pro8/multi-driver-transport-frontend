"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AddressSearchInput } from "@/components/ui/AddressSearchInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createOrder, listReceivers } from "@/lib/api";
import type { Order, ReceiverSummary } from "@/types";

interface Props {
  onCreated: (order: Order) => void;
  onMessage: (text: string, type?: "success" | "error") => void;
}

export function NewOrderForm({ onCreated, onMessage }: Props) {
  const { user } = useAuth();
  const [receivers, setReceivers] = useState<ReceiverSummary[]>([]);
  const [receiverId, setReceiverId] = useState<string>("");
  const [senderAddress, setSenderAddress] = useState("");
  const [senderLat, setSenderLat] = useState("");
  const [senderLng, setSenderLng] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const profilePrimed = useRef(false);

  // Prime defaults from the user's profile once it loads — but don't clobber
  // edits the user has made.
  useEffect(() => {
    if (profilePrimed.current || !user) return;
    profilePrimed.current = true;
    setSenderAddress(user.address ?? "");
    setSenderLat(user.lat != null ? String(user.lat) : "");
    setSenderLng(user.lng != null ? String(user.lng) : "");
  }, [user]);

  useEffect(() => {
    listReceivers()
      .then(setReceivers)
      .catch((err) =>
        onMessage(err instanceof Error ? err.message : "Failed to load receivers", "error")
      );
  }, [onMessage]);

  const selectedReceiver = useMemo(
    () => receivers.find((r) => String(r.id) === receiverId) ?? null,
    [receivers, receiverId]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!receiverId) {
      onMessage("Pick a receiver from the list.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const order = await createOrder({
        receiver_user_id: Number(receiverId),
        sender_address: senderAddress.trim() || undefined,
        sender_lat: senderLat.trim() ? Number(senderLat) : null,
        sender_lng: senderLng.trim() ? Number(senderLng) : null,
        notes: notes.trim() || undefined,
      });
      onCreated(order);
      setReceiverId("");
      setNotes("");
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Failed to create order", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Destination receiver</Label>
          <Select value={receiverId} onChange={(e) => setReceiverId(e.target.value)} required>
            <option value="" disabled>
              Select a receiver…
            </option>
            {receivers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.full_name} {r.phone ? `· ${r.phone}` : ""}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Receiver phone (auto)</Label>
          <Input value={selectedReceiver?.phone ?? ""} readOnly placeholder="Pick a receiver above" />
        </div>
        <div className="md:col-span-2">
          <Label>Receiver address (auto)</Label>
          <Input
            value={selectedReceiver?.address ?? ""}
            readOnly
            placeholder="Pick a receiver above"
          />
        </div>
        <div>
          <Label>Receiver latitude (auto)</Label>
          <Input
            value={selectedReceiver?.lat != null ? String(selectedReceiver.lat) : ""}
            readOnly
            placeholder="—"
          />
        </div>
        <div>
          <Label>Receiver longitude (auto)</Label>
          <Input
            value={selectedReceiver?.lng != null ? String(selectedReceiver.lng) : ""}
            readOnly
            placeholder="—"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label>Pickup address (search a shop, cafe, or place)</Label>
          <AddressSearchInput
            value={senderAddress}
            onChange={(text) => {
              setSenderAddress(text);
              if (senderLat || senderLng) {
                setSenderLat("");
                setSenderLng("");
              }
            }}
            onPick={(place) => {
              setSenderAddress(place.label);
              setSenderLat(String(place.lat));
              setSenderLng(String(place.lng));
            }}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Try names like &quot;Starbucks&quot;, a building name, or a full street address.
          </p>
        </div>
        <div>
          <Label>Sender latitude</Label>
          <Input
            inputMode="decimal"
            placeholder="Auto-filled from search"
            value={senderLat}
            onChange={(e) => setSenderLat(e.target.value)}
          />
        </div>
        <div>
          <Label>Sender longitude</Label>
          <Input
            inputMode="decimal"
            placeholder="Auto-filled from search"
            value={senderLng}
            onChange={(e) => setSenderLng(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label>Notes (optional)</Label>
        <textarea
          className="mt-1 flex min-h-[80px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Special instructions, package details, etc."
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Submit order
        </Button>
      </div>
    </form>
  );
}
