"use client";

import { cellToBoundary, cellToLatLng, latLngToCell, isValidCell } from "h3-js";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { formatCurrency } from "@/lib/utils";
import type { ConvertH3Response, DriverZone } from "@/types";

const TRANSPORT_LABEL: Record<string, string> = {
  land: "Land",
  air: "Air",
  sea: "Sea",
};

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

function GeofenceClickHandler({
  boundary,
  onBoundaryChange,
}: {
  boundary: { lat: number; lng: number }[];
  onBoundaryChange: (pts: { lat: number; lng: number }[]) => void;
}) {
  useMapEvents({
    click(e) {
      onBoundaryChange([
        ...boundary,
        { lat: e.latlng.lat, lng: e.latlng.lng },
      ]);
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
  geofenceEnabled?: boolean;
  boundary?: { lat: number; lng: number }[];
  onBoundaryChange?: (pts: { lat: number; lng: number }[]) => void;
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
  geofenceEnabled = false,
  boundary = [],
  onBoundaryChange,
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
    () =>
      `${conversion?.pickup_h3 ?? "_"}:${conversion?.dropoff_h3 ?? "_"}|${savedZones.map((z) => z.id).join(",")}`,
    [conversion?.pickup_h3, conversion?.dropoff_h3, savedZones]
  );

  const selectedSet = useMemo(() => new Set(selectedCells), [selectedCells]);

  return (
    <div style={{ height }} className="relative w-full rounded-xl overflow-hidden">
      {drawEnabled && !geofenceEnabled && (
        <div className="absolute top-3 left-3 z-[1000] rounded-lg bg-card/95 border border-border px-3 py-2 text-xs shadow-card max-w-[220px]">
          <p className="font-semibold mb-1">How to draw</p>
          <p className="text-muted-foreground">Click hex cells to select/deselect. Pan and zoom to explore.</p>
        </div>
      )}
      {geofenceEnabled && (
        <div className="absolute top-3 left-3 z-[1000] rounded-lg bg-card/95 border border-border px-3 py-2 text-xs shadow-card max-w-[260px]">
          <p className="font-semibold mb-1">Geofence boundary</p>
          <p className="text-muted-foreground">
            Click the map to place vertices. Need at least 3.
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-foreground">
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded-full border-2 border-white"
              style={{ background: "#f59e0b" }}
            />
            <span className="font-semibold">{boundary.length}</span>
            <span className="text-muted-foreground">
              point{boundary.length === 1 ? "" : "s"} placed
              {boundary.length >= 3 ? " · ready to save" : ""}
            </span>
          </p>
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

        {geofenceEnabled && onBoundaryChange && (
          <GeofenceClickHandler boundary={boundary} onBoundaryChange={onBoundaryChange} />
        )}

        {drawEnabled && !geofenceEnabled && onCellsChange && (
          <MapClickHandler
            resolution={resolution}
            selectedCells={selectedCells}
            onCellsChange={onCellsChange}
          />
        )}

        {boundary.length >= 2 && (
          <Polyline
            positions={boundary.map((p) => [p.lat, p.lng] as [number, number])}
            pathOptions={{ color: "#f59e0b", weight: 2, dashArray: "6 4" }}
          />
        )}
        {boundary.length >= 3 && (
          <Polygon
            positions={boundary.map((p) => [p.lat, p.lng] as [number, number])}
            pathOptions={{
              color: "#f59e0b",
              weight: 2,
              fillColor: "#f59e0b",
              fillOpacity: 0.2,
            }}
          />
        )}
        {/*
          Render a vertex dot at every clicked point so the user has immediate
          visual feedback (including the very first click, where no polyline or
          polygon exists yet). The first vertex is drawn a touch larger so it's
          obvious where the polygon will close back to.
        */}
        {boundary.map((p, idx) => (
          <CircleMarker
            key={`geofence-vertex-${idx}-${p.lat.toFixed(6)}-${p.lng.toFixed(6)}`}
            center={[p.lat, p.lng]}
            radius={idx === 0 ? 7 : 5}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: "#f59e0b",
              fillOpacity: 1,
              opacity: 1,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1}>
              <span className="text-xs">
                Point {idx + 1}
                {idx === 0 && boundary.length > 1 ? " (start)" : ""}
              </span>
            </Tooltip>
          </CircleMarker>
        ))}

        {savedZones.map((zone, zoneIdx) => {
          const color = ZONE_PALETTE[zoneIdx % ZONE_PALETTE.length];
          const isUnavailable = zone.available === false;
          const modeLabel = TRANSPORT_LABEL[zone.transport_mode] ?? zone.transport_mode;
          const rateLabel = formatCurrency(Number(zone.rate_cost ?? 0), zone.currency);
          const trustScore = zone.driver_trustworthiness ?? 0;
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
                  fillOpacity: isUnavailable ? 0.1 : 0.28,
                  opacity: isUnavailable ? 0.5 : 1,
                  dashArray: isUnavailable ? "4 4" : undefined,
                }}
              >
                {/*
                  `sticky` keeps the tooltip pinned near the cursor while moving
                  across a zone made of many H3 cells; `direction="top"` keeps it
                  from being hidden under the cursor on small hexes.
                */}
                <Tooltip direction="top" offset={[0, -4]} opacity={1} sticky>
                  <div className="text-xs leading-snug min-w-[180px]">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ background: color }}
                      />
                      <span className="font-semibold">{zone.zone_name}</span>
                    </div>
                    <div className="text-muted-foreground mb-1.5">
                      Driver: <span className="text-foreground">{zone.driver_name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                      <span className="text-muted-foreground">Rate</span>
                      <span className="font-medium text-right">{rateLabel}</span>
                      <span className="text-muted-foreground">Available</span>
                      <span
                        className={`font-medium text-right ${
                          zone.available ? "text-green-600" : "text-amber-600"
                        }`}
                      >
                        {zone.available ? "Yes" : "No"}
                      </span>
                      <span className="text-muted-foreground">Mode</span>
                      <span className="font-medium text-right">{modeLabel}</span>
                      <span className="text-muted-foreground">Trust forwarder</span>
                      <span className="font-medium text-right">
                        {zone.trust_payment_forwarder ? "Yes" : "No"}
                      </span>
                      <span className="text-muted-foreground">Trustworthiness</span>
                      <span className="font-medium text-right">{trustScore}</span>
                      <span className="text-muted-foreground">Cells · Res</span>
                      <span className="font-medium text-right">
                        {zone.cell_count} · r{zone.resolution}
                      </span>
                    </div>
                  </div>
                </Tooltip>
              </Polygon>
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
