"use client";

import dynamic from "next/dynamic";
import { Loader2, MapPin, PenLine } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getResolution, isValidCell } from "h3-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createDriverZone, updateDriverZone } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CellInputMode, ConvertH3Response, DriverZone } from "@/types";

const H3MapView = dynamic(() => import("@/components/map/H3MapView").then((m) => m.H3MapView), {
  ssr: false,
  loading: () => (
    <div className="h-[360px] rounded-xl bg-muted animate-pulse flex items-center justify-center text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

const RESOLUTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

interface Props {
  zones: DriverZone[];
  conversion: ConvertH3Response | null;
  editingZone: DriverZone | null;
  onSaved: () => void;
  onCancelEdit: () => void;
  onMessage: (text: string, type?: "success" | "error") => void;
}

function parseManualCells(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function AddDriverZoneForm({
  zones,
  conversion,
  editingZone,
  onSaved,
  onCancelEdit,
  onMessage,
}: Props) {
  const [driverName, setDriverName] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [resolution, setResolution] = useState("7");
  const [mode, setMode] = useState<CellInputMode>("draw");
  const [selectedCells, setSelectedCells] = useState<string[]>([]);
  const [manualText, setManualText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingZone) {
      setDriverName(editingZone.driver_name);
      setZoneName(editingZone.zone_name);
      setResolution(String(editingZone.resolution));
      setSelectedCells(editingZone.h3_cells);
      setManualText(editingZone.h3_cells.join("\n"));
    }
  }, [editingZone]);

  // Align zone resolution with the latest conversion (don't override while editing).
  useEffect(() => {
    if (editingZone || !conversion) return;
    setResolution(String(conversion.resolution));
  }, [conversion?.resolution, editingZone]);

  // Keep manual textarea in sync with cells picked on the map so users can
  // switch between modes without losing their selection.
  useEffect(() => {
    if (mode !== "manual") {
      setManualText(selectedCells.join("\n"));
    }
  }, [selectedCells, mode]);

  const resolutionNum = Number(resolution);

  // In manual mode, derive selectedCells from the textarea (filtered by current resolution).
  useEffect(() => {
    if (mode === "manual") {
      const parsed = parseManualCells(manualText);
      const valid = parsed.filter(
        (c) => isValidCell(c) && getResolution(c) === resolutionNum
      );
      setSelectedCells(valid);
    }
  }, [manualText, mode, resolutionNum]);

  // Drop stale cells whenever the user changes resolution — backend would
  // otherwise reject the save with a resolution-mismatch error.
  useEffect(() => {
    setSelectedCells((prev) => {
      const filtered = prev.filter(
        (c) => isValidCell(c) && getResolution(c) === resolutionNum
      );
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [resolutionNum]);

  const invalidManual = useMemo(() => {
    if (mode !== "manual") return [];
    return parseManualCells(manualText).filter(
      (c) => !isValidCell(c) || getResolution(c) !== resolutionNum
    );
  }, [manualText, mode, resolutionNum]);

  const clearForm = useCallback(() => {
    setDriverName("");
    setZoneName("");
    setSelectedCells([]);
    setManualText("");
  }, []);

  const handleCancel = useCallback(() => {
    clearForm();
    onCancelEdit();
  }, [clearForm, onCancelEdit]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!driverName.trim()) {
      onMessage("Driver name is required.", "error");
      return;
    }
    const finalZoneName = zoneName.trim() || `${driverName.trim()} Zone`;
    if (selectedCells.length === 0) {
      onMessage("Select at least one H3 cell.", "error");
      return;
    }

    setSaving(true);
    try {
      if (editingZone) {
        await updateDriverZone(editingZone.id, {
          driver_name: driverName.trim(),
          zone_name: finalZoneName,
          resolution: resolutionNum,
          h3_cells: selectedCells,
        });
        onMessage("Driver zone updated.", "success");
      } else {
        await createDriverZone({
          driver_name: driverName.trim(),
          zone_name: finalZoneName,
          resolution: resolutionNum,
          h3_cells: selectedCells,
        });
        onMessage("Driver zone saved.", "success");
      }
      clearForm();
      onCancelEdit();
      onSaved();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : "Failed to save zone", "error");
    } finally {
      setSaving(false);
    }
  }

  function clearSelection() {
    setSelectedCells([]);
    setManualText("");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{editingZone ? "Edit Driver Zone" : "Add Driver Zone"}</CardTitle>
        {editingZone && (
          <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
            Cancel edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label>Driver Name</Label>
              <Input
                placeholder="e.g. Driver A"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Zone Name (Optional)</Label>
              <Input
                placeholder="e.g. Downtown SF Zone"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
              />
            </div>
            <div>
              <Label>H3 Resolution</Label>
              <Select value={resolution} onChange={(e) => setResolution(e.target.value)}>
                {RESOLUTIONS.map((r) => (
                  <option key={r} value={String(r)}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label>Add Cells By</Label>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant={mode === "draw" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setMode("draw")}
                >
                  <PenLine className="h-4 w-4" />
                  Draw on Map
                </Button>
                <Button
                  type="button"
                  variant={mode === "manual" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setMode("manual")}
                >
                  <MapPin className="h-4 w-4" />
                  Enter H3 Cells
                </Button>
              </div>
            </div>

            {mode === "manual" && (
              <div>
                <Label>H3 Cell IDs (comma or newline separated)</Label>
                <textarea
                  className={cn(
                    "mt-1 flex min-h-[120px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-mono shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  )}
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="87283473fffffff&#10;87283475fffffff"
                />
                {invalidManual.length > 0 && (
                  <p className="text-xs text-danger mt-1">
                    {invalidManual.length} cell ID(s) are invalid or don&apos;t match resolution {resolutionNum}
                  </p>
                )}
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              Selected cells: <span className="font-semibold text-foreground">{selectedCells.length}</span>
            </p>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button" variant="danger" onClick={clearSelection}>
                Clear Selection
              </Button>
              <Button type="button" variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingZone ? "Update Zone" : "Save Zone"}
              </Button>
            </div>
          </div>

          <div className="min-h-[360px]">
            <H3MapView
              height={360}
              resolution={resolutionNum}
              selectedCells={selectedCells}
              onCellsChange={mode === "draw" ? setSelectedCells : undefined}
              savedZones={zones.filter((z) => z.id !== editingZone?.id)}
              conversion={conversion}
              drawEnabled={mode === "draw"}
              interactive
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
