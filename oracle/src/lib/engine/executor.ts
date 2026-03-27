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

  // Key distinction: data sources with NO incoming connections are standalone entry
  // points (Phase 1). Data sources WITH incoming connections are reactive — they run
  // in Phase 2 like any other node, using upstream data to drive their fetch.
  const incomingCount = new Map<string, number>();
  for (const node of sorted) incomingCount.set(node.id, 0);
  for (const conn of strategy.connections) {
    incomingCount.set(conn.target_id, (incomingCount.get(conn.target_id) ?? 0) + 1);
  }

  const standaloneDataNodes = sorted.filter(
    (n) => n.category === "data" && (incomingCount.get(n.id) ?? 0) === 0
  );
  const downstreamNodes = sorted.filter(
    (n) => n.category !== "data" || (incomingCount.get(n.id) ?? 0) > 0
  );

  const result: ExecutionResult = { nodeOutputs: [], tradesPlaced: [], logs: [] };

  // Phase 1: Run standalone data sources — these create pipeline-triggering rivers
  const allRivers: { sourceNodeId: string; river: River }[] = [];

  for (const sourceNode of standaloneDataNodes) {
    try {
      const items = await runDataSource(sourceNode, {} as River);
      const maxItems = sourceNode.config.max_items ?? items.length;
      const capped = items.slice(0, maxItems);

      for (const item of capped) {
        allRivers.push({ sourceNodeId: sourceNode.id, river: { ...item } });
      }

      const latestItem = capped.length > 0 ? capped[capped.length - 1] : {};
      result.nodeOutputs.push({
        nodeId: sourceNode.id,
        outputs: { _item_count: capped.length, ...latestItem },
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

  // Build cross-source merge map from standalone sources
  const latestBySource: Record<string, River> = {};
  for (const { sourceNodeId, river: r } of allRivers) {
    latestBySource[sourceNodeId] = r;
  }

  // Phase 2: For each river, run downstream nodes in topological order.
  // This includes reactive data sources (data nodes with inputs).
  for (const { sourceNodeId, river: initialRiver } of allRivers) {
    const outputMap: Record<string, Record<string, any>> = {};
    outputMap["__source__"] = initialRiver;

    for (const [srcId, srcRiver] of Object.entries(latestBySource)) {
      if (srcId !== sourceNodeId) {
        outputMap[srcId] = srcRiver;
      }
    }

    for (const node of downstreamNodes) {
      if (outputMap[node.id]?._blocked) continue;

      const river = buildRiver(node.id, strategy.connections, outputMap, initialRiver);

      if (!isNodeReachable(node.id, strategy.connections, outputMap)) {
        result.nodeOutputs.push({ nodeId: node.id, outputs: {}, status: "blocked" });
        continue;
      }

      try {
        const outputs = await runNode(node, river);

        // Accumulate: store the node's outputs PLUS everything in its input river.
        // This ensures data flows through the entire chain — e.g., search_terms from
        // an AI Analyst survive through intermediate nodes to reach a reactive feed.
        const accumulated = { ...river, ...outputs };

        // Gate-like nodes: check _gate_result to block downstream
        const isGateNode = outputs._gate_result !== undefined;
        if (isGateNode && outputs._gate_result === false) {
          outputMap[node.id] = accumulated;
          result.nodeOutputs.push({ nodeId: node.id, outputs, status: "blocked" });
          markDownstreamBlocked(node.id, strategy.connections, downstreamNodes, outputMap, result);
          continue;
        }

        if (outputs._active_handle) {
          outputMap[node.id] = accumulated;
          result.nodeOutputs.push({ nodeId: node.id, outputs, status: "passed" });
        } else {
          outputMap[node.id] = accumulated;
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
  switch (node.category) {
    case "data": return await runReactiveDataSource(node, river);
    case "ai": return await runAINode(node, river);
    case "logic": return await runLogicNode(node, river);
    case "action": return await runActionNode(node, river);
    default: return {};
  }
}

/**
 * Run a data source reactively — upstream river data overrides static config.
 * This allows patterns like: AI Analyst → (search_terms) → Polymarket Feed
 */
async function runReactiveDataSource(node: StrategyNode, river: River): Promise<Record<string, any>> {
  // Override static config with upstream river values
  const dynamicNode = { ...node, config: { ...node.config } };

  // Generic: any river field matching a config key overrides it
  for (const [key, value] of Object.entries(river)) {
    if (key.startsWith("_") || value == null) continue;
    if (key in dynamicNode.config && typeof value === typeof dynamicNode.config[key]) {
      dynamicNode.config[key] = value;
    }
  }

  // Common aliases: upstream nodes can set search_terms/query to drive searches
  const searchTerms = river.search_terms ?? river.search_query ?? river.query ?? null;
  if (typeof searchTerms === "string" && searchTerms.trim()) {
    if (node.type === "polymarket_feed") dynamicNode.config.market_search = searchTerms;
    else if (node.type === "gemini_markets_feed") dynamicNode.config.event_search = searchTerms;
    else if (node.type === "news_monitor") dynamicNode.config.keywords = searchTerms;
    else if (node.type === "twitter_monitor") dynamicNode.config.keywords = searchTerms;
  }

  const items = await runDataSource(dynamicNode, river);
  const maxItems = dynamicNode.config.max_results ?? dynamicNode.config.max_items ?? items.length;
  const capped = items.slice(0, maxItems);

  if (capped.length === 0) return { _item_count: 0 };

  // Return all results — top item fields directly + full list as available_markets
  return {
    ...capped[0],
    available_markets: capped,
    available_market_count: capped.length,
    _item_count: capped.length,
  };
}
