"use client";
import { useState, useCallback } from "react";
import type { Strategy, StrategyNode, StrategyConnection } from "@/types";
import type { Node, Edge } from "@xyflow/react";
import { NODE_TYPES } from "@/lib/strategy/node-types";
import { mintStrategyNft } from "@/lib/nft/mint";
import { deriveEncryptionKey, encryptStrategy, decryptStrategy } from "@/lib/encryption/strategy-cipher";

// Convert React Flow nodes/edges to our DB format
export function serializeNodes(nodes: Node[]): StrategyNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type!,
    category: getCategoryForType(n.type!),
    position: n.position,
    config: n.data?.config ?? {},
  }));
}

export function serializeEdges(edges: Edge[]): StrategyConnection[] {
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
    signMessage?: (message: Uint8Array) => Promise<{ signature: Uint8Array }>,
    encryptionKey?: CryptoKey | null,
  ): Promise<string> => {
    setIsSaving(true);
    try {
      const serializedNodes = serializeNodes(nodes);
      const serializedEdges = serializeEdges(edges);

      let strategyId: string;

      if (strategy?.id) {
        // Update existing — only send public metadata (name), not nodes
        await fetch(`/api/strategies/${strategy.id}`, {
          method: "PUT",
          headers: authHeaders(walletAddress),
          body: JSON.stringify({ name }),
        });
        strategyId = strategy.id;
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
        strategyId = data.id;
        // Load the full strategy after creating
        const fullRes = await fetch(`/api/strategies/${strategyId}`, {
          headers: authHeaders(walletAddress),
        });
        const full = await fullRes.json();
        setStrategy(full);
      }

      // Generate AI description (non-blocking — runs while encryption happens)
      const descriptionPromise = fetch(`/api/strategies/${strategyId}/generate-description`, {
        method: "POST",
        headers: authHeaders(walletAddress),
        body: JSON.stringify({ nodes: serializedNodes, connections: serializedEdges }),
      }).catch(() => {}); // Best-effort, don't block save

      // Encrypt and upload to 0G Storage
      const key = encryptionKey || (signMessage ? await deriveEncryptionKey(signMessage) : null);
      if (key && walletAddress) {
        try {
          const encrypted = await encryptStrategy(
            { nodes: serializedNodes, connections: serializedEdges },
            key
          );
          await fetch(`/api/strategies/${strategyId}/upload-encrypted`, {
            method: "POST",
            headers: authHeaders(walletAddress),
            body: JSON.stringify({ encryptedData: encrypted }),
          });
        } catch (err: any) {
          console.warn("Encryption/upload skipped:", err.message);
        }
      }

      return strategyId;
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
    strategyName: string,
    description: string,
    walletAdapter: {
      publicKey: { toBytes(): Uint8Array };
      signTransaction: <T>(tx: T) => Promise<T>;
      signAllTransactions?: <T>(txs: T[]) => Promise<T[]>;
    },
  ): Promise<string> => {
    setIsMinting(true);
    try {
      const result = await mintStrategyNft(strategyId, walletAddress, strategyName, description, walletAdapter);

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
    signMessage?: (message: Uint8Array) => Promise<{ signature: Uint8Array }>,
  ): Promise<{ nodes: Node[]; edges: Edge[]; name: string; status: string } | null> => {
    const res = await fetch(`/api/strategies/${id}`, {
      headers: authHeaders(walletAddress),
    });
    if (!res.ok) return null;
    const data: Strategy = await res.json();
    setStrategy(data);

    // If we have encrypted data and a signMessage function, decrypt client-side
    if (data.encryptedData && signMessage) {
      try {
        const key = await deriveEncryptionKey(signMessage);
        const decrypted = await decryptStrategy(data.encryptedData, key);
        return {
          nodes: deserializeNodes(decrypted.nodes),
          edges: deserializeEdges(decrypted.connections),
          name: data.name,
          status: data.status,
        };
      } catch (err: any) {
        console.warn("Decryption failed:", err.message);
        // Fall through to empty nodes
      }
    }

    // Non-owner or no encrypted data — use whatever the API returned
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
