"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPricingConfig, updatePricingConfig } from "@/lib/api";
import type { PricingConfig } from "@/types";

export function PricingSettingsCard() {
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bookingFeePct, setBookingFeePct] = useState("");
  const [landSpeed, setLandSpeed] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPricingConfig();
      setConfig(data);
      setBookingFeePct((data.booking_fee_rate * 100).toFixed(2));
      setLandSpeed(String(data.land_speed_kmh));
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Failed to load pricing settings",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    const feePct = Number(bookingFeePct);
    const speed = Number(landSpeed);
    if (!Number.isFinite(feePct) || feePct < 0 || feePct > 100) {
      setMessage({ text: "Booking fee must be between 0 and 100%", type: "error" });
      return;
    }
    if (!Number.isFinite(speed) || speed <= 0) {
      setMessage({ text: "Land speed must be greater than 0 km/h", type: "error" });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updatePricingConfig({
        booking_fee_rate: feePct / 100,
        land_speed_kmh: speed,
      });
      setConfig(updated);
      setMessage({ text: "Pricing settings saved.", type: "success" });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Failed to save pricing settings",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <CardShell>
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading pricing settings…
        </div>
      </CardShell>
    );
  }

  return (
    <CardShell>
      <p className="text-sm text-muted-foreground">
        Global pricing defaults. Segment costs use{" "}
        <span className="font-medium text-foreground">
          {config?.units.weight ?? "lb"}, {config?.units.dimension ?? "in"},{" "}
          {config?.units.distance ?? "km"}, {config?.units.time ?? "hr"}
        </span>
        .
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="booking-fee">Booking fee (%)</Label>
          <Input
            id="booking-fee"
            inputMode="decimal"
            value={bookingFeePct}
            onChange={(e) => setBookingFeePct(e.target.value)}
            placeholder="2.00"
          />
          <p className="text-[11px] text-muted-foreground">
            Applied to each segment sub-total (base + travel + waiting).
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="land-speed">Land transit speed (km/h)</Label>
          <Input
            id="land-speed"
            inputMode="decimal"
            value={landSpeed}
            onChange={(e) => setLandSpeed(e.target.value)}
            placeholder="50"
          />
          <p className="text-[11px] text-muted-foreground">
            Used when a land zone has no departure/arrival schedule.
          </p>
        </div>
      </div>
      {message && (
        <p
          className={`text-xs ${
            message.type === "success" ? "text-emerald-600" : "text-destructive"
          }`}
        >
          {message.text}
        </p>
      )}
      <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save pricing settings
      </Button>
    </CardShell>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}
