"use client";
import { useState, useCallback } from "react";
import type { Strategy, StrategyNode, StrategyConnection } from "@/types";
import type { Node, Edge } from "@xyflow/react";
import { NODE_TYPES } from "@/lib/strategy/node-types";
import { mintStrategyNft } from "@/lib/nft/mint";
import type { Transaction } from "@solana/web3.js";

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
  const [isMinting, setIsMinting] = useState(false);

  /** Headers helper: includes wallet address for ownership checks */
  const authHeaders = (walletAddress?: string | null): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (walletAddress) h["X-Wallet-Address"] = walletAddress;
    return h;
  };

  const save = useCallback(async (
    name: string,
    nodes: Node[],
    edges: Edge[],
    walletAddress?: string | null,
  ): Promise<string> => {
    setIsSaving(true);
    try {
      const serializedNodes = serializeNodes(nodes);
      const serializedEdges = serializeEdges(edges);

      if (strategy?.id) {
        // Update existing
        await fetch(`/api/strategies/${strategy.id}`, {
          method: "PUT",
          headers: authHeaders(walletAddress),
          body: JSON.stringify({
            name,
            nodes: serializedNodes,
            connections: serializedEdges,
          }),
        });
        return strategy.id;
      } else {
        // Create new — requires wallet
        if (!walletAddress) {
          throw new Error("Connect your wallet to save a strategy");
        }
        const res = await fetch("/api/strategies", {
          method: "POST",
          headers: authHeaders(walletAddress),
          body: JSON.stringify({
            name,
            nodes: serializedNodes,
            connections: serializedEdges,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to save strategy");
        }
        const data = await res.json();
        // Load the full strategy after creating
        const fullRes = await fetch(`/api/strategies/${data.id}`, {
          headers: authHeaders(walletAddress),
        });
        const full = await fullRes.json();
        setStrategy(full);
        return data.id;
      }
    } finally {
      setIsSaving(false);
    }
  }, [strategy]);

  /**
   * Mint an NFT for the strategy and record the mint address.
   * Called after saving a new strategy.
   */
  const mintNft = useCallback(async (
    strategyId: string,
    walletAddress: string,
    signAndSendTransaction: (tx: Transaction) => Promise<{ signature: string }>,
  ): Promise<string> => {
    setIsMinting(true);
    try {
      const result = await mintStrategyNft(walletAddress, signAndSendTransaction);

      // Store the NFT mint address on the strategy
      await fetch(`/api/strategies/${strategyId}`, {
        method: "PUT",
        headers: authHeaders(walletAddress),
        body: JSON.stringify({ nftMint: result.mintAddress }),
      });

      setStrategy((s) => s ? { ...s, nftMint: result.mintAddress } : s);
      return result.mintAddress;
    } finally {
      setIsMinting(false);
    }
  }, []);

  const load = useCallback(async (
    id: string,
    walletAddress?: string | null,
  ): Promise<{ nodes: Node[]; edges: Edge[]; name: string; status: string } | null> => {
    const res = await fetch(`/api/strategies/${id}`, {
      headers: authHeaders(walletAddress),
    });
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

  const deploy = useCallback(async (walletAddress?: string | null): Promise<void> => {
    if (!strategy?.id) return;
    await fetch(`/api/strategies/${strategy.id}/deploy`, {
      method: "POST",
      headers: authHeaders(walletAddress),
    });
    setStrategy((s) => s ? { ...s, status: "running" } : s);
  }, [strategy]);

  const pause = useCallback(async (walletAddress?: string | null): Promise<void> => {
    if (!strategy?.id) return;
    await fetch(`/api/strategies/${strategy.id}/pause`, {
      method: "POST",
      headers: authHeaders(walletAddress),
    });
    setStrategy((s) => s ? { ...s, status: "paused" } : s);
  }, [strategy]);

  const setPublic = useCallback(async (
    isPublic: boolean,
    walletAddress?: string | null,
  ): Promise<void> => {
    if (!strategy?.id) return;
    await fetch(`/api/strategies/${strategy.id}`, {
      method: "PUT",
      headers: authHeaders(walletAddress),
      body: JSON.stringify({ isPublic }),
    });
    setStrategy((s) => s ? { ...s, isPublic } : s);
  }, [strategy]);

  return {
    strategy,
    isSaving,
    isMinting,
    save,
    mintNft,
    load,
    deploy,
    pause,
    setPublic,
  };
}
