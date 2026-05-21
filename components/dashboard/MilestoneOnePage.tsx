"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { AddDriverZoneForm } from "@/components/driver-zones/AddDriverZoneForm";
import { ConversionResult } from "@/components/driver-zones/ConversionResult";
import { ConvertLocationsForm } from "@/components/driver-zones/ConvertLocationsForm";
import { DriverZonesTable } from "@/components/driver-zones/DriverZonesTable";
import { FuturePathsSection } from "@/components/driver-zones/FuturePathsSection";
import { StepIndicator } from "@/components/driver-zones/StepIndicator";
import { ZoneDetailCard } from "@/components/driver-zones/ZoneDetailCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteDriverZone, listDriverZones } from "@/lib/api";
import type { ConvertH3Response, DashboardStep, DriverZone } from "@/types";

const H3MapView = dynamic(() => import("@/components/map/H3MapView").then((m) => m.H3MapView), {
  ssr: false,
  loading: () => (
    <div className="h-28 rounded-xl bg-muted animate-pulse" />
  ),
});

export function MilestoneOnePage() {
  const [activeStep, setActiveStep] = useState<DashboardStep>(1);
  const [convertResolution, setConvertResolution] = useState("7");
  const [conversion, setConversion] = useState<ConvertH3Response | null>(null);
  const [conversionError, setConversionError] = useState("");
  const [zones, setZones] = useState<DriverZone[]>([]);
  const [viewZone, setViewZone] = useState<DriverZone | null>(null);
  const [editingZone, setEditingZone] = useState<DriverZone | null>(null);
  const [banner, setBanner] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const refreshZones = useCallback(async () => {
    try {
      const data = await listDriverZones();
      setZones(data);
      setViewZone((prev) => (prev ? data.find((z) => z.id === prev.id) ?? null : null));
    } catch (err) {
      setBanner({
        text: err instanceof Error ? err.message : "Failed to load zones",
        type: "error",
      });
    }
  }, []);

  useEffect(() => {
    refreshZones();
  }, [refreshZones]);

  function showMessage(text: string, type: "success" | "error" = "success") {
    setBanner({ text, type });
    setTimeout(() => setBanner(null), 4000);
  }

  async function handleDelete(zone: DriverZone) {
    if (!confirm(`Delete zone "${zone.zone_name}"?`)) return;
    try {
      await deleteDriverZone(zone.id);
      if (viewZone?.id === zone.id) setViewZone(null);
      if (editingZone?.id === zone.id) setEditingZone(null);
      await refreshZones();
      showMessage("Zone deleted.");
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Delete failed", "error");
    }
  }

  return (
    <>
      <StepIndicator activeStep={activeStep} onStepChange={setActiveStep} />

      {banner && (
        <div
          className={`mx-6 mb-4 rounded-xl border px-4 py-3 text-sm ${
            banner.type === "success"
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
          }`}
        >
          {banner.text}
        </div>
      )}

      <div className="px-6 pb-8 space-y-6">
        {(activeStep === 1 || activeStep === 3) && (
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <ConvertLocationsForm
                resolution={convertResolution}
                onResolutionChange={setConvertResolution}
                onConverted={(result) => {
                  setConversion(result);
                  setConvertResolution(String(result.resolution));
                  setConversionError("");
                  setActiveStep(2);
                }}
                onError={(msg) => {
                  setConversionError(msg);
                  setConversion(null);
                }}
              />
            </div>
            <ConversionResult result={conversion} error={conversionError} />
          </section>
        )}

        {conversion && (activeStep === 1 || activeStep === 3) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <H3MapView
                height={140}
                resolution={conversion.resolution}
                selectedCells={[]}
                conversion={conversion}
                interactive={false}
                zoom={5}
              />
            </CardContent>
          </Card>
        )}

        {(activeStep === 2 || activeStep === 3) && (
          <>
            <AddDriverZoneForm
              zones={zones}
              conversion={conversion}
              editingZone={editingZone}
              onSaved={refreshZones}
              onCancelEdit={() => setEditingZone(null)}
              onMessage={showMessage}
            />

            <DriverZonesTable
              zones={zones}
              onAdd={() => setActiveStep(2)}
              onView={(z) => {
                setViewZone(z);
                setActiveStep(3);
              }}
              onEdit={(z) => {
                setEditingZone(z);
                setActiveStep(2);
              }}
              onDelete={handleDelete}
            />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <ZoneDetailCard zone={viewZone} conversion={conversion} />
              {viewZone && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Zone Map View</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <H3MapView
                      height={280}
                      resolution={viewZone.resolution}
                      selectedCells={viewZone.h3_cells}
                      savedZones={zones}
                      conversion={conversion}
                      interactive
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}

        <FuturePathsSection />
      </div>
    </>
  );
}
