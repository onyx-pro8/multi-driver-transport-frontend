"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Eye,
  Hexagon,
  Info,
  Layers,
  Link2,
  Loader2,
  Map as MapIcon,
  Network,
  Plane,
  RefreshCw,
  Share2,
  Shapes,
  Workflow,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import {
  getDriverZoneGraph,
  invalidateCache,
  rebuildDriverZoneGraph,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCellCoords } from "@/lib/geo";
import type {
  ConnectionType,
  DriverZoneGraph,
  GraphComponent,
  GraphEdge,
  GraphNode,
} from "@/types";
import { GraphCanvas } from "./GraphCanvas";

// Leaflet pulls window/document at module load, so the map view must be
// dynamically imported with SSR disabled — same pattern used by the
// zone-connections page for `H3MapView`.
const GraphMapCanvas = dynamic(
  () => import("./GraphMapCanvas").then((m) => m.GraphMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="h-[560px] rounded-xl bg-muted animate-pulse flex items-center justify-center text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  }
);

type GraphViewMode = "map" | "abstract";

type EdgeFilter = "all" | ConnectionType;

const CONNECTION_BADGE: Record<
  ConnectionType,
  { label: string; className: string; icon: typeof Link2 }
> = {
  overlap: {
    label: "Overlap",
    className:
      "bg-amber-500/15 text-amber-700 dark:text-amber-200 border border-amber-500/30",
    icon: Layers,
  },
  adjacent: {
    label: "Adjacent",
    className:
      "bg-sky-500/15 text-sky-700 dark:text-sky-200 border border-sky-500/30",
    icon: Link2,
  },
  hub: {
    label: "Hub transfer",
    className:
      "bg-violet-500/15 text-violet-700 dark:text-violet-200 border border-violet-500/30",
    icon: Plane,
  },
};

export function DriverZoneGraphPage() {
  const { user } = useAuth();
  const canRebuild = user?.role === "admin" || user?.role === "driver";

  const [graph, setGraph] = useState<DriverZoneGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [recalcing, setRecalcing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [componentFilter, setComponentFilter] = useState<string>("all");
  const [edgeFilter, setEdgeFilter] = useState<EdgeFilter>("all");
  const [showIsolated, setShowIsolated] = useState(true);
  // Default to the geographic view — it shows the actual zone hexagons,
  // the graph edges between them, and the overlap surface, which is what
  // most operators want to see first. Abstract view is a click away.
  const [viewMode, setViewMode] = useState<GraphViewMode>("map");

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const detailRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(
    async (opts: { bypassCache?: boolean } = {}) => {
      setLoading(true);
      setError(null);
      try {
        if (opts.bypassCache) invalidateCache("/api/driver-zone-graph");
        const data = await getDriverZoneGraph();
        setGraph(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load graph");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedNodeId && !selectedEdgeId) return;
    const node = detailRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedNodeId, selectedEdgeId]);

  function showMessage(text: string) {
    setSuccess(text);
    setTimeout(() => setSuccess(null), 4000);
  }

  async function handleRebuild() {
    setRebuilding(true);
    setError(null);
    try {
      const data = await rebuildDriverZoneGraph();
      setGraph(data);
      showMessage(
        `Graph rebuilt — ${data.summary.total_nodes} node${
          data.summary.total_nodes === 1 ? "" : "s"
        } · ${data.summary.total_edges} edge${
          data.summary.total_edges === 1 ? "" : "s"
        }.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rebuild failed");
    } finally {
      setRebuilding(false);
    }
  }

  async function handleRecalcAndRebuild() {
    setRecalcing(true);
    setError(null);
    try {
      const data = await rebuildDriverZoneGraph({ recalculate_connections: true });
      setGraph(data);
      showMessage(
        `Connections recalculated and graph rebuilt — ${data.summary.total_nodes} node${
          data.summary.total_nodes === 1 ? "" : "s"
        } · ${data.summary.total_edges} edge${
          data.summary.total_edges === 1 ? "" : "s"
        }.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recalculate failed");
    } finally {
      setRecalcing(false);
    }
  }

  function handleSelectNode(node: GraphNode) {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }

  function handleSelectEdge(edge: GraphEdge) {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }

  function clearSelection() {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }

  // ----- Derived ---------------------------------------------------------

  /**
   * The graph canvas, components panel, and isolated zones panel all
   * respect the same filters. We compute one filtered view that downstream
   * components share so the UI never disagrees on what's visible.
   */
  const filteredGraph = useMemo(() => {
    if (!graph) {
      return {
        nodes: [] as GraphNode[],
        edges: [] as GraphEdge[],
        components: [] as GraphComponent[],
        isolatedNodes: [] as GraphNode[],
        mutedNodeIds: new Set<string>(),
      };
    }

    let visibleNodes = graph.nodes;
    let visibleEdges = graph.edges;
    let visibleComponents = graph.components;

    if (componentFilter !== "all") {
      visibleComponents = graph.components.filter((c) => c.id === componentFilter);
      const nodeIdSet = new Set(visibleComponents.flatMap((c) => c.node_ids));
      const edgeIdSet = new Set(visibleComponents.flatMap((c) => c.edge_ids));
      visibleNodes = graph.nodes.filter((n) => nodeIdSet.has(n.id));
      visibleEdges = graph.edges.filter((e) => edgeIdSet.has(e.id));
    }

    if (!showIsolated) {
      visibleNodes = visibleNodes.filter((n) => !n.is_isolated);
    }

    if (edgeFilter !== "all") {
      visibleEdges = visibleEdges.filter((e) => e.connection_type === edgeFilter);
    }

    const isolatedNodes = visibleNodes.filter((n) => n.is_isolated);
    return {
      nodes: visibleNodes,
      edges: visibleEdges,
      components: visibleComponents,
      isolatedNodes,
      mutedNodeIds: new Set<string>(),
    };
  }, [graph, componentFilter, edgeFilter, showIsolated]);

  const selectedNode = useMemo(() => {
    if (!graph || !selectedNodeId) return null;
    return graph.nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [graph, selectedNodeId]);

  const selectedEdge = useMemo(() => {
    if (!graph || !selectedEdgeId) return null;
    return graph.edges.find((e) => e.id === selectedEdgeId) ?? null;
  }, [graph, selectedEdgeId]);

  const selectedNodeDegree = useMemo(() => {
    if (!graph || !selectedNode) return 0;
    let degree = 0;
    for (const edge of graph.edges) {
      if (edge.source === selectedNode.id || edge.target === selectedNode.id) {
        degree++;
      }
    }
    return degree;
  }, [graph, selectedNode]);

  const selectedEdgeEndpoints = useMemo(() => {
    if (!graph || !selectedEdge) return null;
    const a = graph.nodes.find((n) => n.id === selectedEdge.source) ?? null;
    const b = graph.nodes.find((n) => n.id === selectedEdge.target) ?? null;
    return { a, b };
  }, [graph, selectedEdge]);

  const summary = graph?.summary;

  return (
    <div className="px-6 pb-8 space-y-6">
      {(error || success) && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm flex items-start gap-2",
            error
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
              : "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200"
          )}
        >
          {error ? (
            <Info className="h-4 w-4 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mt-0.5" />
          )}
          <span>{error ?? success}</span>
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Network className="h-5 w-5" />
            </div>
            <div className="space-y-1 text-sm">
              <p className="font-medium text-foreground">Transport network graph</p>
              <p className="text-muted-foreground">
                See how transport zones connect so shipments can move from one
                transporter to another. Each zone is a{" "}
                <span className="text-foreground font-medium">node</span>; each
                handoff possibility between two zones is a{" "}
                <span className="text-foreground font-medium">line</span>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm border-t border-border pt-4">
            <LegendItem
              swatch={
                <span className="inline-block h-3 w-3 rounded-full bg-blue-500 ring-2 ring-white dark:ring-card" />
              }
              title="Nodes (dots)"
              description="One transport zone — where a transporter can pick up or hand off a package."
            />
            <LegendItem
              swatch={
                <span className="inline-block h-1 w-8 rounded bg-amber-600" />
              }
              title="Solid amber lines"
              description="Overlap — two zones share the same geographic cells. Transfer happens inside the shared area."
            />
            <LegendItem
              swatch={
                <span className="inline-block h-0 w-8 border-t-2 border-dashed border-sky-600" />
              }
              title="Dashed blue lines"
              description="Adjacent — zones touch at a border. Handoff happens at the boundary between cells."
            />
            <LegendItem
              swatch={
                <span className="inline-block h-3 w-3 rounded-sm bg-amber-500/60 border border-amber-600" />
              }
              title="Amber hexagons"
              description="Overlap regions on the map — cells covered by more than one zone."
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatTile
          icon={<Network className="h-5 w-5" />}
          label="Total Nodes"
          value={summary?.total_nodes ?? 0}
        />
        <StatTile
          icon={<Workflow className="h-5 w-5" />}
          label="Total Edges"
          value={summary?.total_edges ?? 0}
        />
        <StatTile
          icon={<Share2 className="h-5 w-5" />}
          label="Connected Components"
          value={summary?.connected_components ?? 0}
        />
        <StatTile
          icon={<CircleDashed className="h-5 w-5" />}
          label="Isolated Zones"
          value={summary?.isolated_zones ?? 0}
        />
        <StatTile
          icon={<Layers className="h-5 w-5" />}
          label="Overlap Edges"
          value={summary?.overlap_edges ?? 0}
        />
        <StatTile
          icon={<Link2 className="h-5 w-5" />}
          label="Adjacent Edges"
          value={summary?.adjacent_edges ?? 0}
        />
      </section>

      {/* Action bar */}
      <Card>
        <CardContent className="p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleRebuild}
              disabled={rebuilding || recalcing || !canRebuild}
              title={
                canRebuild
                  ? "Rebuild graph from current zones and zone connections"
                  : "Only admins and drivers can rebuild the graph"
              }
            >
              {rebuilding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Network className="h-4 w-4" />
              )}
              {rebuilding ? "Rebuilding…" : "Rebuild Graph"}
            </Button>
            <Button
              variant="outline"
              onClick={handleRecalcAndRebuild}
              disabled={rebuilding || recalcing || !canRebuild}
              title="Recalculate Milestone 2 zone connections, then rebuild the graph"
            >
              {recalcing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {recalcing ? "Recalculating…" : "Recalculate Connections & Rebuild Graph"}
            </Button>
            <Button
              variant="outline"
              onClick={() => refresh({ bypassCache: true })}
              disabled={loading || rebuilding || recalcing}
              title="Re-fetch the graph from the server (bypass cache)"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={componentFilter}
              onChange={(e) => setComponentFilter(e.target.value)}
              className="w-48"
            >
              <option value="all">All components</option>
              {graph?.components.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} ({c.zone_count} zone
                  {c.zone_count === 1 ? "" : "s"})
                </option>
              ))}
            </Select>
            <Select
              value={edgeFilter}
              onChange={(e) => setEdgeFilter(e.target.value as EdgeFilter)}
              className="w-40"
            >
              <option value="all">All edges</option>
              <option value="overlap">Overlap</option>
              <option value="adjacent">Adjacent</option>
              <option value="hub">Hub transfer</option>
            </Select>
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={showIsolated}
                onChange={(e) => setShowIsolated(e.target.checked)}
              />
              Show isolated zones
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Graph canvas */}
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-4 w-4" /> Transport Network Graph
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {viewMode === "map"
                ? "Zone hexagons on the map · graph edges link zone centroids · overlap cells highlighted in amber."
                : "Abstract node-link layout · drag to pan · scroll to zoom."}
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "map"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Render the graph on the map with zone hexagons"
            >
              <MapIcon className="h-3.5 w-3.5" />
              Map view
            </button>
            <button
              type="button"
              onClick={() => setViewMode("abstract")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "abstract"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Schematic node-link view"
            >
              <Share2 className="h-3.5 w-3.5" />
              Abstract view
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && !graph ? (
            <div className="h-[560px] rounded-xl bg-muted animate-pulse flex items-center justify-center text-sm text-muted-foreground">
              Loading graph…
            </div>
          ) : graph && graph.nodes.length === 0 ? (
            <EmptyState canRebuild={canRebuild} />
          ) : viewMode === "map" ? (
            <GraphMapCanvas
              graph={{
                ...graph!,
                nodes: filteredGraph.nodes,
                edges: filteredGraph.edges,
                components: filteredGraph.components,
                isolated_nodes: filteredGraph.isolatedNodes,
              }}
              selectedNodeId={selectedNodeId}
              selectedEdgeId={selectedEdgeId}
              onSelectNode={handleSelectNode}
              onSelectEdge={handleSelectEdge}
              height={560}
            />
          ) : (
            <GraphCanvas
              nodes={filteredGraph.nodes}
              edges={filteredGraph.edges}
              selectedNodeId={selectedNodeId}
              selectedEdgeId={selectedEdgeId}
              onSelectNode={handleSelectNode}
              onSelectEdge={handleSelectEdge}
              height={560}
            />
          )}
        </CardContent>
      </Card>

      {/* Selection details */}
      {(selectedNode || selectedEdge) && (
        <div ref={detailRef}>
          {selectedNode && (
            <NodeDetailCard
              node={selectedNode}
              degree={selectedNodeDegree}
              onClose={clearSelection}
            />
          )}
          {selectedEdge && selectedEdgeEndpoints && (
            <EdgeDetailCard
              edge={selectedEdge}
              endpointA={selectedEdgeEndpoints.a}
              endpointB={selectedEdgeEndpoints.b}
              onClose={clearSelection}
            />
          )}
        </div>
      )}

      {/* Components panel */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4" /> Connected Components (
              {filteredGraph.components.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              A component is a group of zones connected through overlap or
              adjacency. Isolated zones form their own single-node components.
            </p>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {filteredGraph.components.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No components match the current filters.
            </div>
          ) : (
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-3 pr-4 font-medium">Component</th>
                  <th className="py-3 pr-4 font-medium">Members</th>
                  <th className="py-3 pr-4 font-medium text-right">Zones</th>
                  <th className="py-3 pr-4 font-medium text-right">Transports</th>
                  <th className="py-3 pr-4 font-medium text-right">Connections</th>
                  <th className="py-3 pr-4 font-medium">Transport Methods</th>
                  <th className="py-3 pr-4 font-medium">Overlap</th>
                  <th className="py-3 pr-4 font-medium">Adjacency</th>
                  <th className="py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredGraph.components.map((c) => {
                  const isSingleton = c.zone_count <= 1;
                  const memberNodes = (graph?.nodes ?? []).filter((n) =>
                    c.node_ids.includes(n.id)
                  );
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-border/70 last:border-0 hover:bg-muted/50 align-top"
                    >
                      <td className="py-3 pr-4 font-mono text-xs">
                        {c.id}
                        {isSingleton && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/20 px-2 py-0.5 text-[10px] font-medium">
                            <CircleDashed className="h-2.5 w-2.5" />
                            Isolated
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1.5 max-w-[420px]">
                          {memberNodes.map((n) => (
                            <button
                              type="button"
                              key={n.id}
                              onClick={() => {
                                setSelectedNodeId(n.id);
                                setSelectedEdgeId(null);
                              }}
                              title="Inspect this zone node"
                              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-xs font-medium hover:bg-primary/15"
                            >
                              <span className="font-semibold">
                                {n.transport_name || `Transport #${n.transport_id}`}
                              </span>
                              <span className="text-primary/70">·</span>
                              <span className="text-foreground/80">
                                {n.zone_name}
                              </span>
                            </button>
                          ))}
                          {memberNodes.length === 0 && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-right font-mono">{c.zone_count}</td>
                      <td className="py-3 pr-4 text-right font-mono">
                        {c.transport_count}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono">
                        {c.connection_count}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {c.transport_methods.length === 0
                          ? "—"
                          : c.transport_methods.join(", ")}
                      </td>
                      <td className="py-3 pr-4">
                        <YesNoBadge value={c.has_overlap} />
                      </td>
                      <td className="py-3 pr-4">
                        <YesNoBadge value={c.has_adjacency} />
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setComponentFilter(c.id);
                            setSelectedNodeId(null);
                            setSelectedEdgeId(null);
                          }}
                          title="Focus this component in the graph"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="hidden xl:inline">View</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Isolated zones panel */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <CircleDashed className="h-4 w-4" /> Isolated Transport Zone Nodes (
            {graph?.isolated_nodes.length ?? 0})
          </CardTitle>
          <p className="hidden md:block text-xs text-muted-foreground">
            Zones with no overlap or adjacency to any other zone.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {!graph || graph.isolated_nodes.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No isolated zones — every zone has at least one connection.
            </div>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-3 pr-4 font-medium">Transport</th>
                  <th className="py-3 pr-4 font-medium">Zone Name</th>
                  <th className="py-3 pr-4 font-medium">Transport Method</th>
                  <th className="py-3 pr-4 font-medium text-right">Cell Count</th>
                  <th className="py-3 pr-4 font-medium">Zone Type</th>
                  <th className="py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {graph.isolated_nodes.map((n) => (
                  <tr
                    key={n.id}
                    className="border-b border-border/70 last:border-0 hover:bg-muted/50"
                  >
                    <td className="py-3 pr-4 font-medium">{n.transport_name}</td>
                    <td className="py-3 pr-4">{n.zone_name}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {n.transport_method ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono">{n.h3_cell_count}</td>
                    <td className="py-3 pr-4 capitalize">{n.zone_type}</td>
                    <td className="py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedNodeId(n.id);
                          setSelectedEdgeId(null);
                        }}
                        title="Inspect this zone node"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="hidden xl:inline">View</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LegendItem({
  swatch,
  title,
  description,
}: {
  swatch: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        {swatch}
        <p className="font-medium text-foreground text-xs">{title}</p>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            {icon}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold tracking-tight">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function YesNoBadge({ value }: { value: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        value
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
          : "bg-muted text-muted-foreground border border-border"
      )}
    >
      {value ? "Yes" : "No"}
    </span>
  );
}

function EmptyState({ canRebuild }: { canRebuild: boolean }) {
  return (
    <div className="py-12 text-center space-y-3">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
        <Network className="h-6 w-6" />
      </div>
      <div>
        <p className="font-medium">The transport network is empty.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Create transport zones and recalculate connections, then{" "}
          {canRebuild
            ? "rebuild the graph"
            : "ask an admin or driver to rebuild the graph"}
          .
        </p>
      </div>
      <div className="flex items-center justify-center gap-2">
        <Link href="/driver-zones">
          <Button variant="outline" size="sm">
            <Shapes className="h-4 w-4" />
            Go to Transport Zones
          </Button>
        </Link>
        <Link href="/zone-connections">
          <Button variant="outline" size="sm">
            <Workflow className="h-4 w-4" />
            Zone Connections
          </Button>
        </Link>
      </div>
    </div>
  );
}

interface NodeDetailCardProps {
  node: GraphNode;
  degree: number;
  onClose: () => void;
}

function NodeDetailCard({ node, degree, onClose }: NodeDetailCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-4 w-4" /> Transport Zone Node
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Each node represents one transport participant zone.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            <span className="font-medium text-foreground">{node.transport_name}</span>
            <span className="mx-2">·</span>
            <span>{node.zone_name}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/map-view?zone=${node.zone_id}`}>
            <Button variant="outline" size="sm" title="View zone on the map">
              <MapIcon className="h-4 w-4" />
              View on Map
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {(node.transport_method === "air" || node.transport_method === "sea") &&
          node.departure_hub &&
          node.arrival_hub && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">
                  Departure {node.transport_method === "air" ? "airport" : "port"}
                </p>
                <p className="font-medium">{node.departure_hub.name || "—"}</p>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  {node.departure_hub.lat.toFixed(4)}, {node.departure_hub.lng.toFixed(4)}
                </p>
                {node.departure_time && (
                  <p className="text-xs text-muted-foreground mt-1">Departs {node.departure_time}</p>
                )}
              </div>
              <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
                <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-1">
                  Arrival {node.transport_method === "air" ? "airport" : "port"}
                </p>
                <p className="font-medium">{node.arrival_hub.name || "—"}</p>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  {node.arrival_hub.lat.toFixed(4)}, {node.arrival_hub.lng.toFixed(4)}
                </p>
                {node.arrival_time && (
                  <p className="text-xs text-muted-foreground mt-1">Arrives {node.arrival_time}</p>
                )}
              </div>
            </div>
          )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <Field label="Transport Name" value={node.transport_name} />
          <Field label="Zone Name" value={node.zone_name} />
          <Field
            label="Transport Method"
            value={node.transport_method ?? "—"}
          />
          <Field label="Zone Type" value={<span className="capitalize">{node.zone_type}</span>} />
          <Field label="H3 Cell Count" value={node.h3_cell_count} />
          <Field
            label="Primary Coordinate"
            value={
              node.primary_coordinate
                ? `${node.primary_coordinate.lat.toFixed(4)}, ${node.primary_coordinate.lng.toFixed(4)}`
                : "—"
            }
          />
          <Field label="Component ID" value={<code className="font-mono text-xs">{node.component_id}</code>} />
          <Field label="Node Degree" value={`${degree} connection${degree === 1 ? "" : "s"}`} />
          <Field
            label="Is Isolated"
            value={<YesNoBadge value={node.is_isolated} />}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface EdgeDetailCardProps {
  edge: GraphEdge;
  endpointA: GraphNode | null;
  endpointB: GraphNode | null;
  onClose: () => void;
}

function EdgeDetailCard({ edge, endpointA, endpointB, onClose }: EdgeDetailCardProps) {
  const badge = CONNECTION_BADGE[edge.connection_type];
  const Badge = badge.icon;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-4 w-4" /> Zone Connection Edge
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Each edge represents a connection between two transport zones.
          </p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground">
              {endpointA?.transport_name ?? "—"}
            </span>
            <span>·</span>
            <span>{endpointA?.zone_name ?? "—"}</span>
            <ArrowRight className="h-3 w-3" />
            <span className="font-medium text-foreground">
              {endpointB?.transport_name ?? "—"}
            </span>
            <span>·</span>
            <span>{endpointB?.zone_name ?? "—"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
              badge.className
            )}
          >
            <Badge className="h-3 w-3" />
            {badge.label}
          </span>
          <Link
            href={`/zone-connections?connection=${edge.id.replace(/^edge_/, "")}`}
          >
            <Button variant="outline" size="sm" title="View on the zone-connections map">
              <MapIcon className="h-4 w-4" />
              View on Map
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <EndpointCard
            color="#3b82f6"
            label="Zone A"
            node={endpointA}
            transportMethod={edge.transport_method_a}
          />
          <EndpointCard
            color="#22c55e"
            label="Zone B"
            node={endpointB}
            transportMethod={edge.transport_method_b}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <Field
            label="Connection Type"
            value={
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                  badge.className
                )}
              >
                <Badge className="h-3 w-3" />
                {badge.label}
              </span>
            }
          />
          <Field label="Transfer Cells" value={edge.transfer_cells.length} />
          <Field label="Adjacent Cell Pairs" value={edge.adjacent_cell_pairs.length} />
          <Field label="Transport Method A" value={edge.transport_method_a ?? "—"} />
          <Field label="Transport Method B" value={edge.transport_method_b ?? "—"} />
          <Field label="Weight" value={edge.weight} />
        </div>

        {edge.transfer_cells.length > 0 && (
          <CellChipList
            title={
              edge.connection_type === "overlap"
                ? "Overlap (transfer) cells"
                : "Representative cells"
            }
            cells={edge.transfer_cells}
          />
        )}

        {edge.adjacent_cell_pairs.length > 0 && (
          <PairChipList pairs={edge.adjacent_cell_pairs} />
        )}
      </CardContent>
    </Card>
  );
}

function EndpointCard({
  color,
  label,
  node,
  transportMethod,
}: {
  color: string;
  label: string;
  node: GraphNode | null;
  transportMethod: string | null;
}) {
  if (!node) {
    return (
      <div className="rounded-xl border border-border p-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
          {label}
        </div>
        <p className="mt-2 italic">Endpoint not in scope</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border p-3 space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
        {label}
      </div>
      <p className="font-semibold">{node.transport_name}</p>
      <p className="text-sm text-muted-foreground">{node.zone_name}</p>
      <p className="text-xs text-muted-foreground">
        {node.h3_cell_count} cells · {node.zone_type}
        {transportMethod ? ` · ${transportMethod}` : ""}
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function CellChipList({ title, cells }: { title: string; cells: string[] }) {
  const visible = cells.slice(0, 12);
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">
        {title} ({cells.length})
      </p>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((cell) => (
          <span
            key={cell}
            className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 px-2.5 py-1 text-xs font-mono"
          >
            <Hexagon className="inline-block h-3 w-3 mr-1 align-text-bottom" />
            {formatCellCoords(cell)}
          </span>
        ))}
        {cells.length > visible.length && (
          <span className="text-xs text-muted-foreground self-center">
            +{cells.length - visible.length} more
          </span>
        )}
      </div>
    </div>
  );
}

function PairChipList({
  pairs,
}: {
  pairs: { from_cell: string; to_cell: string }[];
}) {
  const visible = pairs.slice(0, 10);
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">
        Adjacent cell pairs ({pairs.length})
      </p>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((p, idx) => (
          <span
            key={`${p.from_cell}-${p.to_cell}-${idx}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 px-2.5 py-1 text-xs font-mono"
          >
            {formatCellCoords(p.from_cell)}
            <ArrowRight className="h-3 w-3" />
            {formatCellCoords(p.to_cell)}
          </span>
        ))}
        {pairs.length > visible.length && (
          <span className="text-xs text-muted-foreground self-center">
            +{pairs.length - visible.length} more
          </span>
        )}
      </div>
    </div>
  );
}
