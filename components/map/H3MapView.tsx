"use client";

import { cellToBoundary, cellToLatLng, latLngToCell, isValidCell } from "h3-js";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { ConvertH3Response, DriverZone } from "@/types";

const ZONE_PALETTE = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

// h3-js v4 returns [lat, lng] by default — matches Leaflet's expected order.
function boundaryPositions(cell: string): [number, number][] {
  return cellToBoundary(cell).map(([lat, lng]) => [lat, lng] as [number, number]);
}

/**
 * Fits the map to the supplied positions ONCE per "session key" change.
 * Prevents the map from snapping back every time the user toggles a cell.
 */
function FitBoundsOnce({
  positions,
  sessionKey,
}: {
  positions: [number, number][];
  sessionKey: string;
}) {
  const map = useMap();
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    if (positions.length === 0) return;
    if (lastKey.current === sessionKey) return;
    lastKey.current = sessionKey;
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds.pad(0.25), { animate: true, maxZoom: 13 });
  }, [map, positions, sessionKey]);
  return null;
}

function MapClickHandler({
  resolution,
  selectedCells,
  onCellsChange,
}: {
  resolution: number;
  selectedCells: string[];
  onCellsChange: (cells: string[]) => void;
}) {
  useMapEvents({
    click(e) {
      const cell = latLngToCell(e.latlng.lat, e.latlng.lng, resolution);
      const next = new Set(selectedCells);
      if (next.has(cell)) next.delete(cell);
      else next.add(cell);
      onCellsChange(Array.from(next));
    },
  });
  return null;
}

const pickupIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#22c55e;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const dropoffIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export interface H3MapViewProps {
  height?: string | number;
  resolution: number;
  selectedCells: string[];
  onCellsChange?: (cells: string[]) => void;
  savedZones?: DriverZone[];
  conversion?: ConvertH3Response | null;
  interactive?: boolean;
  drawEnabled?: boolean;
  center?: [number, number];
  zoom?: number;
}

export function H3MapView({
  height = 360,
  resolution,
  selectedCells,
  onCellsChange,
  savedZones = [],
  conversion = null,
  interactive = true,
  drawEnabled = false,
  center,
  zoom = 10,
}: H3MapViewProps) {
  const defaultCenter = useMemo<[number, number]>(() => {
    if (center) return center;
    if (conversion) return [conversion.pickup_center.lat, conversion.pickup_center.lng];
    if (selectedCells[0]) {
      const [lat, lng] = cellToLatLng(selectedCells[0]);
      return [lat, lng];
    }
    return [37.7749, -122.4194];
  }, [center, conversion, selectedCells]);

  // Bounds are computed from "anchor" geometry only — pickup/drop-off cells and
  // saved zones — so the map doesn't reflow every time the user picks a cell.
  const fitPositions = useMemo(() => {
    const pts: [number, number][] = [];
    savedZones.forEach((z) => {
      z.h3_cells.slice(0, 50).forEach((c) => {
        if (isValidCell(c)) pts.push(...boundaryPositions(c));
      });
    });
    if (conversion) {
      pts.push([conversion.pickup_center.lat, conversion.pickup_center.lng]);
      pts.push([conversion.dropoff_center.lat, conversion.dropoff_center.lng]);
    }
    if (pts.length === 0 && selectedCells.length > 0) {
      const first = selectedCells.find((c) => isValidCell(c));
      if (first) pts.push(...boundaryPositions(first));
    }
    return pts;
  }, [savedZones, conversion, selectedCells]);

  const sessionKey = useMemo(
    () => `${conversion?.pickup_h3 ?? "_"}|${savedZones.map((z) => z.id).join(",")}`,
    [conversion?.pickup_h3, savedZones]
  );

  const selectedSet = useMemo(() => new Set(selectedCells), [selectedCells]);

  return (
    <div style={{ height }} className="relative w-full rounded-xl overflow-hidden">
      {drawEnabled && (
        <div className="absolute top-3 left-3 z-[1000] rounded-lg bg-card/95 border border-border px-3 py-2 text-xs shadow-card max-w-[220px]">
          <p className="font-semibold mb-1">How to draw</p>
          <p className="text-muted-foreground">Click hex cells to select/deselect. Pan and zoom to explore.</p>
        </div>
      )}
      {selectedCells.length > 0 && drawEnabled && (
        <div className="absolute top-3 right-3 z-[1000] rounded-full bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold shadow-card">
          Selected Cells: {selectedCells.length}
        </div>
      )}

      <MapContainer
        center={defaultCenter}
        zoom={zoom}
        scrollWheelZoom={interactive}
        dragging={interactive}
        doubleClickZoom={interactive}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {fitPositions.length > 0 && (
          <FitBoundsOnce positions={fitPositions} sessionKey={sessionKey} />
        )}

        {drawEnabled && onCellsChange && (
          <MapClickHandler
            resolution={resolution}
            selectedCells={selectedCells}
            onCellsChange={onCellsChange}
          />
        )}

        {savedZones.map((zone, zoneIdx) => {
          const color = ZONE_PALETTE[zoneIdx % ZONE_PALETTE.length];
          return zone.h3_cells.map((cell) => {
            if (!isValidCell(cell)) return null;
            const inSelection = selectedSet.has(cell);
            if (inSelection && drawEnabled) return null;
            return (
              <Polygon
                key={`zone-${zone.id}-${cell}`}
                positions={boundaryPositions(cell)}
                pathOptions={{
                  color,
                  weight: 1.5,
                  fillColor: color,
                  fillOpacity: 0.28,
                }}
              />
            );
          });
        })}

        {selectedCells.map((cell) => {
          if (!isValidCell(cell)) return null;
          return (
            <Polygon
              key={`sel-${cell}`}
              positions={boundaryPositions(cell)}
              pathOptions={{
                color: "#2563eb",
                weight: 2,
                fillColor: "#3b82f6",
                fillOpacity: 0.45,
              }}
            />
          );
        })}

        {conversion && (
          <>
            <Marker position={[conversion.pickup_center.lat, conversion.pickup_center.lng]} icon={pickupIcon} />
            <Marker position={[conversion.dropoff_center.lat, conversion.dropoff_center.lng]} icon={dropoffIcon} />
            <Polyline
              positions={[
                [conversion.pickup_center.lat, conversion.pickup_center.lng],
                [conversion.dropoff_center.lat, conversion.dropoff_center.lng],
              ]}
              pathOptions={{ color: "#2563eb", dashArray: "8 8", weight: 2, opacity: 0.7 }}
            />
            <Polygon
              positions={boundaryPositions(conversion.pickup_h3)}
              pathOptions={{ color: "#22c55e", weight: 2, fillColor: "#22c55e", fillOpacity: 0.35 }}
            />
            <Polygon
              positions={boundaryPositions(conversion.dropoff_h3)}
              pathOptions={{ color: "#ef4444", weight: 2, fillColor: "#ef4444", fillOpacity: 0.35 }}
            />
          </>
        )}
      </MapContainer>
    </div>
  );
}
