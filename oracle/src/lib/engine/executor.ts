// src/lib/engine/executor.ts
import type { Strategy, StrategyNode, StrategyConnection } from "@/types";
import { runDataSource } from "./node-runners/data-sources";
import { runAINode } from "./node-runners/ai-nodes";
import { runLogicNode } from "./node-runners/logic-nodes";
import { runActionNode } from "./node-runners/action-nodes";

export interface NodeOutput {
  nodeId: string;
  outputs: Record<string, any>;
  status: "passed" | "blocked" | "warning";
  error?: string;
}

export interface TradeInstruction {
  platform: "gemini" | "polymarket";
  marketId: string;
  direction: "YES" | "NO";
  amount: number;
  signal: string;
  price?: number;
}

export interface ExecutionResult {
  nodeOutputs: NodeOutput[];
  tradesPlaced: TradeInstruction[];
  logs: string[];
}

/** River = flat object of all accumulated data flowing through the graph */
export type River = Record<string, any>;

export async function executeStrategy(strategy: Strategy): Promise<ExecutionResult> {
  const sorted = topologicalSort(strategy.nodes, strategy.connections);
  const sourceNodes = sorted.filter((n) => n.category === "data");
  const downstreamNodes = sorted.filter((n) => n.category !== "data");

  const result: ExecutionResult = { nodeOutputs: [], tradesPlaced: [], logs: [] };

  // Phase 1: Run all data source nodes, collect emitted items
  const allRivers: { sourceNodeId: string; river: River }[] = [];

  for (const sourceNode of sourceNodes) {
    try {
      const items = await runDataSource(sourceNode, {} as River);
      // items is an array of river objects (fan-out)
      const maxItems = sourceNode.config.max_items ?? items.length;
      const capped = items.slice(0, maxItems);

      for (const item of capped) {
        allRivers.push({ sourceNodeId: sourceNode.id, river: { ...item } });
      }

      result.nodeOutputs.push({
        nodeId: sourceNode.id,
        outputs: { _item_count: capped.length },
        status: capped.length > 0 ? "passed" : "warning",
      });
    } catch (error) {
      result.nodeOutputs.push({
        nodeId: sourceNode.id,
        outputs: {},
        status: "warning",
        error: String(error),
      });
    }
  }

  // Phase 2: For each river, run downstream nodes in topological order
  for (const { river: initialRiver } of allRivers) {
    const outputMap: Record<string, Record<string, any>> = {};
    // Seed the output map with the initial river under a virtual source key
    outputMap["__source__"] = initialRiver;

    for (const node of downstreamNodes) {
      const river = buildRiver(node.id, strategy.connections, outputMap, initialRiver);

      // Check if this node is reachable (not on a blocked Split branch)
      if (!isNodeReachable(node.id, strategy.connections, outputMap)) {
        result.nodeOutputs.push({ nodeId: node.id, outputs: {}, status: "blocked" });
        continue;
      }

      try {
        const outputs = await runNode(node, river);

        // Gate-like nodes: check _gate_result to block downstream
        const isGateNode = outputs._gate_result !== undefined;
        if (isGateNode && outputs._gate_result === false) {
          outputMap[node.id] = outputs;
          result.nodeOutputs.push({ nodeId: node.id, outputs, status: "blocked" });
          markDownstreamBlocked(node.id, strategy.connections, downstreamNodes, outputMap, result);
          break; // Stop this river
        }

        // Router nodes: set active handle for downstream routing
        if (outputs._active_handle) {
          outputMap[node.id] = outputs;
          result.nodeOutputs.push({ nodeId: node.id, outputs, status: "passed" });
        } else {
          outputMap[node.id] = outputs;
          // Collect trades from action nodes
          if (node.category === "action" && (outputs.trade_confirmation || outputs.ta_trade_confirmation)) {
            result.tradesPlaced.push(outputs.trade_confirmation || outputs.ta_trade_confirmation);
          }
          result.nodeOutputs.push({ nodeId: node.id, outputs, status: "passed" });
        }
      } catch (error) {
        result.nodeOutputs.push({
          nodeId: node.id,
          outputs: {},
          status: "warning",
          error: String(error),
        });
      }
    }
  }

  return result;
}

/**
 * Build the river for a node by merging all upstream outputs.
 */
function buildRiver(
  nodeId: string,
  connections: StrategyConnection[],
  outputMap: Record<string, Record<string, any>>,
  initialRiver: River
): River {
  const river: River = { ...initialRiver };

  // Find all connections targeting this node
  const incoming = connections.filter((c) => c.target_id === nodeId);

  for (const conn of incoming) {
    const sourceOutputs = outputMap[conn.source_id];
    if (sourceOutputs) {
      // For merge nodes, handle collision prefixing
      Object.entries(sourceOutputs).forEach(([key, value]) => {
        if (key.startsWith("_")) return; // Skip internal meta keys for collision check
        if (key in river && river[key] !== value) {
          // Collision: prefix with source node id, keep first value unprefixed
          river[`${conn.source_id}.${key}`] = value;
        } else {
          river[key] = value;
        }
      });
      // Always copy meta keys
      Object.entries(sourceOutputs).forEach(([key, value]) => {
        if (key.startsWith("_")) river[key] = value;
      });
    }
  }

  return river;
}

/**
 * Check if a node is reachable (not on a blocked Split branch).
 */
function isNodeReachable(
  nodeId: string,
  connections: StrategyConnection[],
  outputMap: Record<string, Record<string, any>>
): boolean {
  const incoming = connections.filter((c) => c.target_id === nodeId);
  if (incoming.length === 0) return true;

  for (const conn of incoming) {
    const sourceOutputs = outputMap[conn.source_id];
    if (!sourceOutputs) continue;

    // If source is a split node, check if this connection is on the active handle
    if (sourceOutputs._active_handle) {
      if (conn.source_handle !== sourceOutputs._active_handle) {
        return false; // This connection is on the inactive branch
      }
    }
  }

  return true;
}

/**
 * Mark all downstream nodes from a blocked gate as blocked.
 */
function markDownstreamBlocked(
  blockedNodeId: string,
  connections: StrategyConnection[],
  downstreamNodes: StrategyNode[],
  outputMap: Record<string, Record<string, any>>,
  result: ExecutionResult
) {
  const downstreamIds = new Set<string>();
  const queue = [blockedNodeId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    const outgoing = connections.filter((c) => c.source_id === id);
    for (const conn of outgoing) {
      if (!downstreamIds.has(conn.target_id)) {
        downstreamIds.add(conn.target_id);
        queue.push(conn.target_id);
      }
    }
  }

  for (const node of downstreamNodes) {
    if (downstreamIds.has(node.id) && !outputMap[node.id]) {
      outputMap[node.id] = { _blocked: true };
      result.nodeOutputs.push({ nodeId: node.id, outputs: {}, status: "blocked" });
    }
  }
}

function topologicalSort(nodes: StrategyNode[], connections: StrategyConnection[]): StrategyNode[] {
  const inDegree: Record<string, number> = {};
  const adjacency: Record<string, string[]> = {};
  const nodeMap: Record<string, StrategyNode> = {};

  for (const node of nodes) {
    inDegree[node.id] = 0;
    adjacency[node.id] = [];
    nodeMap[node.id] = node;
  }

  for (const conn of connections) {
    if (adjacency[conn.source_id]) {
      adjacency[conn.source_id].push(conn.target_id);
    }
    inDegree[conn.target_id] = (inDegree[conn.target_id] || 0) + 1;
  }

  const queue = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);
  const sorted: StrategyNode[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(nodeMap[id]);
    for (const neighbor of adjacency[id]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== nodes.length) {
    throw new Error("Strategy graph contains a cycle — execution aborted");
  }

  return sorted;
}

async function runNode(node: StrategyNode, river: River): Promise<Record<string, any>> {
  // Data source nodes are handled in Phase 1 — they should never appear here
  switch (node.category) {
    case "ai": return await runAINode(node, river);
    case "logic": return await runLogicNode(node, river);
    case "action": return await runActionNode(node, river);
    default: return {};
  }
}
