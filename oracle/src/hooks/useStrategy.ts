"use client";
import { useState, useCallback } from "react";
import type { Strategy, StrategyNode, StrategyConnection } from "@/types";
import type { Node, Edge } from "@xyflow/react";
import { NODE_TYPES } from "@/lib/strategy/node-types";

// Convert React Flow nodes/edges to our DB format
function serializeNodes(nodes: Node[]): StrategyNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type!,
    category: getCategoryForType(n.type!),
    position: n.position,
    config: n.data?.config ?? {},
  }));
}

function serializeEdges(edges: Edge[]): StrategyConnection[] {
  return edges.map((e) => ({
    id: e.id,
    source_id: e.source,
    source_handle: e.sourceHandle ?? "",
    target_id: e.target,
    target_handle: e.targetHandle ?? "",
  }));
}

// Convert DB format back to React Flow
export function deserializeNodes(nodes: StrategyNode[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: { config: n.config },
  }));
}

export function deserializeEdges(connections: StrategyConnection[]): Edge[] {
  return connections.map((c) => ({
    id: c.id,
    source: c.source_id,
    target: c.target_id,
    sourceHandle: c.source_handle,
    targetHandle: c.target_handle,
    animated: true,
    style: { stroke: "#5a5f7a" },
  }));
}

function getCategoryForType(type: string): "data" | "ai" | "logic" | "action" {
  const def = NODE_TYPES[type];
  if (def) return def.category;
  return "action";
}

export function useStrategy() {
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = useCallback(async (
    name: string,
    nodes: Node[],
    edges: Edge[],
  ): Promise<string> => {
    setIsSaving(true);
    try {
      const serializedNodes = serializeNodes(nodes);
      const serializedEdges = serializeEdges(edges);

      if (strategy?.id) {
        // Update existing
        await fetch(`/api/strategies/${strategy.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            nodes: serializedNodes,
            connections: serializedEdges,
          }),
        });
        return strategy.id;
      } else {
        // Create new
        const res = await fetch("/api/strategies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            nodes: serializedNodes,
            connections: serializedEdges,
          }),
        });
        const data = await res.json();
        // Load the full strategy after creating
        const fullRes = await fetch(`/api/strategies/${data.id}`);
        const full = await fullRes.json();
        setStrategy(full);
        return data.id;
      }
    } finally {
      setIsSaving(false);
    }
  }, [strategy]);

  const load = useCallback(async (id: string): Promise<{ nodes: Node[]; edges: Edge[]; name: string; status: string } | null> => {
    const res = await fetch(`/api/strategies/${id}`);
    if (!res.ok) return null;
    const data: Strategy = await res.json();
    setStrategy(data);
    return {
      nodes: deserializeNodes(data.nodes),
      edges: deserializeEdges(data.connections),
      name: data.name,
      status: data.status,
    };
  }, []);

  const deploy = useCallback(async (): Promise<void> => {
    if (!strategy?.id) return;
    await fetch(`/api/strategies/${strategy.id}/deploy`, { method: "POST" });
    setStrategy((s) => s ? { ...s, status: "running" } : s);
  }, [strategy]);

  const pause = useCallback(async (): Promise<void> => {
    if (!strategy?.id) return;
    await fetch(`/api/strategies/${strategy.id}/pause`, { method: "POST" });
    setStrategy((s) => s ? { ...s, status: "paused" } : s);
  }, [strategy]);

  return { strategy, isSaving, save, load, deploy, pause };
}
