"use client";

import { cellToBoundary } from "h3-js";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import {
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import type {
  DriverZoneGraph,
  GraphEdge,
  GraphNode,
} from "@/types";

/**
 * Milestone 3 — geographic (on-map) rendering of the driver-zone graph.
 *
 *   - H3 hex cells of every in-scope zone are rendered as Leaflet polygons,
 *     coloured per transport participant.
 *   - Cells that appear in more than one zone (i.e. overlap regions) are
 *     repainted in amber on top of the per-transport fills so the transfer
 *     surface is visible at a glance.
 *   - The graph edges are drawn as polylines between the zones' centroids:
 *     solid amber for overlap, dashed sky for adjacency — same legend as
 *     the abstract view.
 *   - Each node is rendered as a circular marker at its primary_coordinate
 *     (cell centroid). Clicking selects the node; clicking an edge selects
 *     the edge.
 *
 * The component is intentionally read-only: it does not edit zones,
 * doesn't add cells, doesn't compute routes. It's a faithful map view of
 * the network structure from Milestone 1 + 2 + 3.
 */

const NODE_PALETTE = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#a855f7", // purple
  "#06b6d4", // cyan
  "#ef4444", // red
  "#14b8a6", // teal
  "#f97316", // orange
  "#84cc16", // lime
  "#ec4899", // pink
];

const ISOLATED_COLOR = "#64748b"; // slate-500
const OVERLAP_EDGE_COLOR = "#d97706";
const ADJACENT_EDGE_COLOR = "#0284c7";
const OVERLAP_CELL_COLOR = "#f59e0b";

interface GraphMapCanvasProps {
  graph: DriverZoneGraph;
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  onSelectNode?: (node: GraphNode) => void;
  onSelectEdge?: (edge: GraphEdge) => void;
  height?: number;
}

/**
 * Defensive accessor for `node.cells`. Older backend builds (or stale
 * cached responses) may not include the cells field — falling back to an
 * empty array keeps the map view usable instead of throwing
 * "cells is not iterable" at render time.
 */
function cellsOf(node: GraphNode): string[] {
  const raw = (node as { cells?: unknown }).cells;
  return Array.isArray(raw) ? (raw as string[]) : [];
}

/**
 * Fit the map to the supplied positions once per `sessionKey`. We avoid
 * re-fitting on every selection change so the user's pan/zoom isn't
 * reset when they click a node.
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
    if (!positions.length) return;
    if (lastKey.current === sessionKey) return;
    lastKey.current = sessionKey;
    try {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds.pad(0.2), { animate: false, maxZoom: 13 });
    } catch {
      /* map removed */
    }
  }, [map, positions, sessionKey]);
  return null;
}

export function GraphMapCanvas({
  graph,
  selectedNodeId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  height = 560,
}: GraphMapCanvasProps) {
  // Deterministic transport → colour mapping. Ordering by transport_id
  // keeps colours stable across rebuilds / filters.
  const transportColor = useMemo(() => {
    const ids = Array.from(new Set(graph.nodes.map((n) => n.transport_id))).sort(
      (a, b) => a - b
    );
    const map = new Map<number, string>();
    ids.forEach((id, idx) => map.set(id, NODE_PALETTE[idx % NODE_PALETTE.length]));
    return map;
  }, [graph.nodes]);

  // Quick lookup of nodes by id for edge endpoints.
  const nodeById = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const node of graph.nodes) map.set(node.id, node);
    return map;
  }, [graph.nodes]);

  // Identify cells that appear in more than one zone (overlap regions).
  // These get painted on top in amber so the transfer surface is visible.
  const overlapCells = useMemo(() => {
    const owners = new Map<string, number>();
    for (const node of graph.nodes) {
      for (const cell of cellsOf(node)) {
        owners.set(cell, (owners.get(cell) ?? 0) + 1);
      }
    }
    const overlapSet = new Set<string>();
    owners.forEach((count, cell) => {
      if (count >= 2) overlapSet.add(cell);
    });
    return overlapSet;
  }, [graph.nodes]);

  // Build a stable session key so `FitBoundsOnce` re-fits only when the
  // *content* of the graph changes, not on every render.
  const sessionKey = useMemo(() => {
    return `${graph.nodes.length}:${graph.edges.length}:${graph.nodes
      .map((n) => n.id)
      .sort()
      .join(",")}`;
  }, [graph]);

  // Collect cell-boundary points so the initial fit covers every hexagon
  // (not just the centroids — that would clip the cells at the edge).
  const fitPositions = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    for (const node of graph.nodes) {
      const cells = cellsOf(node);
      // Sample at most 6 cells per zone for fit math — that's more than
      // enough to compute bounds for hundreds of zones cheaply.
      const sample = cells.slice(0, 6);
      for (const cell of sample) {
        try {
          const boundary = cellToBoundary(cell);
          for (const [lat, lng] of boundary) {
            pts.push([lat, lng]);
          }
        } catch {
          /* invalid cell — skip */
        }
      }
      if (cells.length === 0 && node.primary_coordinate) {
        pts.push([node.primary_coordinate.lat, node.primary_coordinate.lng]);
      }
    }
    return pts;
  }, [graph]);

  const defaultCenter: [number, number] =
    fitPositions[0] ?? [43.6532, -79.3832]; // Toronto fallback

  // Pre-compute hex polygons so React-Leaflet doesn't recompute them on
  // every selection change.
  const zonePolygons = useMemo(() => {
    return graph.nodes.flatMap((node) => {
      const baseColor = node.is_isolated
        ? ISOLATED_COLOR
        : transportColor.get(node.transport_id) ?? ISOLATED_COLOR;
      return cellsOf(node).map((cell) => {
        let boundary: [number, number][];
        try {
          boundary = cellToBoundary(cell) as [number, number][];
        } catch {
          return null;
        }
        const isOverlap = overlapCells.has(cell);
        return {
          key: `${node.id}:${cell}`,
          cell,
          boundary,
          color: baseColor,
          isOverlap,
          node,
        };
      });
    }).filter((p): p is NonNullable<typeof p> => p !== null);
  }, [graph.nodes, transportColor, overlapCells]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-border"
      style={{ height }}
    >
      <MapContainer
        center={defaultCenter}
        zoom={11}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBoundsOnce positions={fitPositions} sessionKey={sessionKey} />

        {/*
          Per-zone hex fills. Painted first so edges and node markers sit
          on top. Overlap cells are dimmed slightly so they read as "shared
          territory" rather than belonging to a single transport.
        */}
        {zonePolygons.map((p) => {
          const isSelectedZone =
            selectedNodeId === p.node.id ||
            (selectedEdgeId &&
              (graph.edges.find((e) => e.id === selectedEdgeId)?.source ===
                p.node.id ||
                graph.edges.find((e) => e.id === selectedEdgeId)?.target ===
                  p.node.id));
          return (
            <Polygon
              key={p.key}
              positions={p.boundary}
              pathOptions={{
                color: p.color,
                weight: isSelectedZone ? 2 : 1,
                opacity: p.isOverlap ? 0.5 : 0.75,
                fillColor: p.color,
                fillOpacity: p.isOverlap ? 0.18 : isSelectedZone ? 0.45 : 0.32,
                dashArray: p.node.is_isolated ? "4 4" : undefined,
              }}
              eventHandlers={{
                click: () => onSelectNode?.(p.node),
              }}
            />
          );
        })}

        {/*
          Repaint the overlap cells once in amber on top so the transfer
          surface is unmistakable regardless of which zone fill happened
          to render last.
        */}
        {Array.from(overlapCells).map((cell) => {
          let boundary: [number, number][];
          try {
            boundary = cellToBoundary(cell) as [number, number][];
          } catch {
            return null;
          }
          return (
            <Polygon
              key={`overlap:${cell}`}
              positions={boundary}
              pathOptions={{
                color: OVERLAP_CELL_COLOR,
                weight: 1.5,
                opacity: 0.9,
                fillColor: OVERLAP_CELL_COLOR,
                fillOpacity: 0.45,
              }}
              interactive={false}
            />
          );
        })}

        {/* Edges between zone centroids. */}
        {graph.edges.map((edge) => {
          const a = nodeById.get(edge.source);
          const b = nodeById.get(edge.target);
          if (!a?.primary_coordinate || !b?.primary_coordinate) return null;
          const positions: [number, number][] = [
            [a.primary_coordinate.lat, a.primary_coordinate.lng],
            [b.primary_coordinate.lat, b.primary_coordinate.lng],
          ];
          const isOverlap = edge.connection_type === "overlap";
          const isSelected =
            selectedEdgeId === edge.id ||
            (selectedNodeId &&
              (edge.source === selectedNodeId || edge.target === selectedNodeId));
          return (
            <Polyline
              key={edge.id}
              positions={positions}
              pathOptions={{
                color: isOverlap ? OVERLAP_EDGE_COLOR : ADJACENT_EDGE_COLOR,
                weight: isSelected ? 5 : 3,
                opacity: isSelected ? 1 : 0.85,
                dashArray: isOverlap ? undefined : "10 6",
                lineCap: "round",
              }}
              eventHandlers={{
                click: () => onSelectEdge?.(edge),
              }}
            >
              <Tooltip
                sticky
                direction="top"
                offset={[0, -4]}
                className="graph-tooltip"
              >
                <div>
                  <div className="graph-tooltip-title">
                    {isOverlap ? "Overlap edge" : "Adjacent edge"}
                  </div>
                  <div className="graph-tooltip-sub">
                    {a.transport_name} ↔ {b.transport_name}
                  </div>
                  <div className="graph-tooltip-meta">
                    {a.zone_name} ↔ {b.zone_name}
                  </div>
                </div>
              </Tooltip>
            </Polyline>
          );
        })}

        {/* Node markers at each zone's primary coordinate. */}
        {graph.nodes.map((node) => {
          if (!node.primary_coordinate) return null;
          const baseColor = node.is_isolated
            ? ISOLATED_COLOR
            : transportColor.get(node.transport_id) ?? ISOLATED_COLOR;
          const isSelected = selectedNodeId === node.id;
          return (
            <CircleMarker
              key={node.id}
              center={[node.primary_coordinate.lat, node.primary_coordinate.lng]}
              radius={isSelected ? 12 : 9}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: node.is_isolated ? "#ffffff" : baseColor,
                fillOpacity: 1,
                opacity: 1,
                dashArray: node.is_isolated ? "3 3" : undefined,
              }}
              eventHandlers={{
                click: () => onSelectNode?.(node),
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -6]}
                sticky
                className="graph-tooltip"
              >
                <div>
                  <div className="graph-tooltip-title">
                    {node.transport_name || `Transport #${node.transport_id}`}
                  </div>
                  <div className="graph-tooltip-sub">{node.zone_name}</div>
                  <div className="graph-tooltip-meta">
                    {node.h3_cell_count} cell
                    {node.h3_cell_count === 1 ? "" : "s"} · {node.zone_type}
                    {node.transport_method ? ` · ${node.transport_method}` : ""}
                    {node.is_isolated ? " · isolated" : ""}
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Legend overlay (mirrors the abstract canvas). */}
      <div className="absolute bottom-3 left-3 z-[400] flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/95 backdrop-blur px-3 py-2 text-xs shadow-card">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0 w-6 rounded"
            style={{ borderTop: `3px solid ${OVERLAP_EDGE_COLOR}` }}
          />
          Overlap edge
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0 w-6 rounded"
            style={{ borderTop: `3px dashed ${ADJACENT_EDGE_COLOR}` }}
          />
          Adjacent edge
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-4 rounded-sm border border-amber-600"
            style={{ background: "rgba(245, 158, 11, 0.45)" }}
          />
          Overlap cells
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-slate-400 border-dashed bg-white" />
          Isolated zone
        </span>
      </div>

      {/* Transport colour key, top-right. Shows up to 8 transports — more
          than that and the page filter is the better tool anyway. */}
      <div className="absolute top-3 right-3 z-[400] max-w-[220px] rounded-xl border border-border bg-card/95 backdrop-blur px-3 py-2 text-xs shadow-card space-y-1">
        <p className="font-semibold text-foreground">Transports</p>
        {graph.nodes.length === 0 ? (
          <p className="text-muted-foreground">No transports in scope.</p>
        ) : (
          Array.from(transportColor.entries())
            .slice(0, 8)
            .map(([transportId, color]) => {
              const sample = graph.nodes.find((n) => n.transport_id === transportId);
              if (!sample) return null;
              return (
                <div key={transportId} className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{ background: color }}
                  />
                  <span className="truncate text-foreground">
                    {sample.transport_name || `Transport #${transportId}`}
                  </span>
                </div>
              );
            })
        )}
        {transportColor.size > 8 && (
          <p className="text-muted-foreground">
            +{transportColor.size - 8} more
          </p>
        )}
      </div>
    </div>
  );
}
