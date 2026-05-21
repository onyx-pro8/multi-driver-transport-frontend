"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { convertLocations } from "@/lib/api";
import type { ConvertH3Response } from "@/types";

const RESOLUTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

interface Props {
  resolution: string;
  onResolutionChange: (value: string) => void;
  onConverted: (result: ConvertH3Response) => void;
  onError: (message: string) => void;
}

export function ConvertLocationsForm({
  resolution,
  onResolutionChange,
  onConverted,
  onError,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [pickupLat, setPickupLat] = useState("37.7749");
  const [pickupLng, setPickupLng] = useState("-122.4194");
  const [dropoffLat, setDropoffLat] = useState("34.0522");
  const [dropoffLng, setDropoffLng] = useState("-118.2437");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    onError("");
    try {
      const result = await convertLocations({
        pickup_lat: Number(pickupLat),
        pickup_lng: Number(pickupLng),
        dropoff_lat: Number(dropoffLat),
        dropoff_lng: Number(dropoffLng),
        resolution: Number(resolution),
      });
      onConverted(result);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Conversion failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Convert Locations to H3 Cells</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Pickup Location</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Latitude</Label>
                  <Input value={pickupLat} onChange={(e) => setPickupLat(e.target.value)} required />
                </div>
                <div>
                  <Label>Longitude</Label>
                  <Input value={pickupLng} onChange={(e) => setPickupLng(e.target.value)} required />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Drop-off Location</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Latitude</Label>
                  <Input value={dropoffLat} onChange={(e) => setDropoffLat(e.target.value)} required />
                </div>
                <div>
                  <Label>Longitude</Label>
                  <Input value={dropoffLng} onChange={(e) => setDropoffLng(e.target.value)} required />
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-xs">
            <Label>H3 Resolution</Label>
            <Select
              value={resolution}
              onChange={(e) => onResolutionChange(e.target.value)}
            >
              {RESOLUTIONS.map((r) => (
                <option key={r} value={String(r)}>
                  {r}
                </option>
              ))}
            </Select>
          </div>

          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Convert to H3 Cells
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
