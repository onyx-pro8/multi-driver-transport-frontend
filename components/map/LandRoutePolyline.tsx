"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { LeafletEventHandlerFnMap, PathOptions } from "leaflet";
import { Polyline } from "react-leaflet";
import { computeLandRoute, type LatLng } from "@/lib/landRoute";

interface Props {
  from: LatLng;
  to: LatLng;
  pathOptions: PathOptions;
  eventHandlers?: LeafletEventHandlerFnMap;
  children?: ReactNode;
}

/**
 * Polyline for a land route that stays on land instead of cutting across sea.
 * Waits for the backend path (avoids flashing a harbour chord), then draws it.
 * Falls back to a straight line only when no land path can be computed.
 */
export function LandRoutePolyline({
  from,
  to,
  pathOptions,
  eventHandlers,
  children,
}: Props) {
  const straight: [number, number][] = [
    [from.lat, from.lng],
    [to.lat, to.lng],
  ];
  const [positions, setPositions] = useState<[number, number][] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPositions(null);
    computeLandRoute(from, to).then((route) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from.lat, from.lng, to.lat, to.lng]);

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

interface ChainProps {
  points: LatLng[];
  pathOptions: PathOptions;
  eventHandlers?: LeafletEventHandlerFnMap;
  children?: ReactNode;
}

/** Draw consecutive land legs for a multi-waypoint segment. */
export function LandRouteChainPolyline({
  points,
  pathOptions,
  eventHandlers,
  children,
}: ChainProps) {
  if (points.length < 2) return null;
  return (
    <>
      {points.slice(0, -1).map((p, i) => (
        <LandRoutePolyline
          key={`land-leg-${i}-${p.lat}-${p.lng}`}
          from={p}
          to={points[i + 1]}
          pathOptions={pathOptions}
          eventHandlers={i === 0 ? eventHandlers : undefined}
        >
          {i === 0 ? children : null}
        </LandRoutePolyline>
      ))}
    </>
  );
}
