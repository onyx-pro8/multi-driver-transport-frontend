"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Building2, MapPin, Send, Truck, Inbox } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AddressSearchInput } from "@/components/ui/AddressSearchInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Role = "driver" | "sender" | "receiver";

const ROLE_OPTIONS: { value: Role; label: string; description: string; icon: typeof Truck }[] = [
  {
    value: "driver",
    label: "Driver",
    description: "I deliver shipments and define coverage zones.",
    icon: Truck,
  },
  {
    value: "sender",
    label: "Sender",
    description: "I create orders for delivery to a receiver.",
    icon: Send,
  },
  {
    value: "receiver",
    label: "Receiver",
    description: "I accept deliveries at my address.",
    icon: Inbox,
  },
];

export function RegisterForm() {
  const { register } = useAuth();
  const [role, setRole] = useState<Role>("sender");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!phone.trim()) {
      setError("Phone is required");
      return;
    }
    if (role === "driver" && !companyName.trim()) {
      setError("Company name is required for drivers");
      return;
    }
    if ((role === "sender" || role === "receiver") && !address.trim()) {
      setError("Address is required");
      return;
    }

    const latNum = lat.trim() ? Number(lat) : null;
    const lngNum = lng.trim() ? Number(lng) : null;
    if (lat.trim() && !Number.isFinite(latNum as number)) {
      setError("Latitude must be a number");
      return;
    }
    if (lng.trim() && !Number.isFinite(lngNum as number)) {
      setError("Longitude must be a number");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        full_name: fullName,
        role,
        phone,
        email,
        password,
        ...(role === "driver" ? { company_name: companyName.trim() } : {}),
        ...(role === "sender" || role === "receiver"
          ? {
              address: address.trim(),
              lat: latNum,
              lng: lngNum,
            }
          : {}),
      };
      await register(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  const showCompany = role === "driver";
  const showAddress = role === "sender" || role === "receiver";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      <div>
        <Label>I am a…</Label>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {ROLE_OPTIONS.map(({ value, label, description, icon: Icon }) => {
            const active = role === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setRole(value)}
                className={cn(
                  "text-left rounded-xl border px-3 py-3 transition-colors",
                  active
                    ? "border-primary bg-primary/5 text-primary shadow-sm"
                    : "border-border hover:bg-muted"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4" />
                  <span className="font-semibold text-sm">{label}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="full_name">Full name</Label>
        <Input
          id="full_name"
          autoComplete="name"
          placeholder="Jane Doe"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
      </div>

      {showCompany && (
        <div className="space-y-2">
          <Label htmlFor="company_name">
            <Building2 className="inline h-3.5 w-3.5 mr-1" />
            Company name
          </Label>
          <Input
            id="company_name"
            autoComplete="organization"
            placeholder="Acme Logistics"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="phone">Phone number</Label>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+1 555 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </div>

      {showAddress && (
        <>
          <div className="space-y-2">
            <Label htmlFor="address">
              <MapPin className="inline h-3.5 w-3.5 mr-1" />
              Address (search a shop, cafe, or place)
            </Label>
            <AddressSearchInput
              id="address"
              value={address}
              onChange={(text) => {
                setAddress(text);
                // Clear cached coordinates if the user keeps typing — the
                // next pick will overwrite them.
                if (lat || lng) {
                  setLat("");
                  setLng("");
                }
              }}
              onPick={(place) => {
                setAddress(place.label);
                setLat(String(place.lat));
                setLng(String(place.lng));
              }}
              required
            />
            <p className="text-xs text-muted-foreground">
              Try names like &quot;Starbucks&quot;, &quot;Joe&apos;s Pizza Brooklyn&quot;, or a
              full street address.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="lat">Latitude</Label>
              <Input
                id="lat"
                inputMode="decimal"
                placeholder="Auto-filled from search"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lng">Longitude</Label>
              <Input
                id="lng"
                inputMode="decimal"
                placeholder="Auto-filled from search"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
              />
            </div>
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="Min. 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm_password">Confirm password</Label>
        <Input
          id="confirm_password"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
