"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { LeafletEventHandlerFnMap, PathOptions } from "leaflet";
import { Polyline } from "react-leaflet";
import { computeSeaRoute, type LatLng } from "@/lib/seaRoute";

interface Props {
  departure: LatLng;
  arrival: LatLng;
  pathOptions: PathOptions;
  eventHandlers?: LeafletEventHandlerFnMap;
  children?: ReactNode;
}

/**
 * Polyline for a sea route that follows water instead of cutting across land.
 * Renders nothing until the backend resolves the maritime path (avoids a
 * flash of the wrong straight-over-land line), then draws it. Falls back to a
 * straight line only when no marine route can be computed.
 */
export function SeaRoutePolyline({
  departure,
  arrival,
  pathOptions,
  eventHandlers,
  children,
}: Props) {
  const straight: [number, number][] = [
    [departure.lat, departure.lng],
    [arrival.lat, arrival.lng],
  ];
  const [positions, setPositions] = useState<[number, number][] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPositions(null);
    computeSeaRoute(departure, arrival).then((route) => {
      if (cancelled) return;
      if (route && route.length >= 2) {
        setPositions(route);
      } else {
        setPositions(straight);
      }
    });
    return () => {
      cancelled = true;
    };
    // straight is derived from departure/arrival each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departure.lat, departure.lng, arrival.lat, arrival.lng]);

  if (!positions) return null;

  return (
    <Polyline
      positions={positions}
      pathOptions={pathOptions}
      eventHandlers={eventHandlers}
    >
      {children}
    </Polyline>
  );
}
