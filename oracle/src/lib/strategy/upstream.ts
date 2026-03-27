import { NODE_TYPES } from "./node-types";
import type { Edge, Node } from "@xyflow/react";

export function getUpstreamFields(
  nodeId: string,
  nodes: Node[],
  edges: Edge[]
): string[] {
  const visited = new Set<string>();
  const fields = new Set<string>();

  function walk(currentId: string) {
    if (visited.has(currentId)) return;
    visited.add(currentId);

    const incomingEdges = edges.filter((e) => e.target === currentId);
    for (const edge of incomingEdges) {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (!sourceNode || !sourceNode.type) continue;

      const def = NODE_TYPES[sourceNode.type];
      if (def) {
        for (const key of def.outputKeys) {
          fields.add(key);
        }
      }

      walk(sourceNode.id);
    }
  }

  walk(nodeId);
  return Array.from(fields).sort();
}
