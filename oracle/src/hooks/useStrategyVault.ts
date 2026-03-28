"use client";

import { useState, useCallback, useRef } from "react";
import type { StrategyNode, StrategyConnection } from "@/types";
import { deriveEncryptionKey, decryptStrategy } from "@/lib/encryption/strategy-cipher";

export interface VaultEntry {
  nodes: StrategyNode[];
  connections: StrategyConnection[];
}

export function useStrategyVault() {
  const [entries, setEntries] = useState<Map<string, VaultEntry>>(new Map());
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const keyRef = useRef<CryptoKey | null>(null);

  /**
   * Unlock the vault: derive key, bulk-fetch encrypted data, decrypt all strategies.
   * Call once after wallet connects.
   */
  const unlock = useCallback(async (
    walletAddress: string,
    signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>,
  ) => {
    if (isUnlocked) return;
    setIsUnlocking(true);

    try {
      // 1. Derive decryption key (one Phantom signature prompt)
      const key = await deriveEncryptionKey(signMessage);
      keyRef.current = key;

      // 2. Bulk-fetch encrypted blobs
      const res = await fetch("/api/strategies/encrypted", {
        headers: { "X-Wallet-Address": walletAddress },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch encrypted strategies");
      }
      const { strategies } = await res.json() as {
        strategies: { id: string; encryptedData: string | null }[];
      };

      // 3. Decrypt each blob
      const map = new Map<string, VaultEntry>();
      for (const { id, encryptedData } of strategies) {
        if (!encryptedData) continue;
        try {
          const decrypted = await decryptStrategy(encryptedData, key);
          map.set(id, {
            nodes: decrypted.nodes,
            connections: decrypted.connections,
          });
        } catch {
          console.warn(`Failed to decrypt strategy ${id}`);
        }
      }

      setEntries(map);
      setIsUnlocked(true);
    } finally {
      setIsUnlocking(false);
    }
  }, [isUnlocked]);

  /** Update a single vault entry (after saving or creating a strategy). */
  const put = useCallback((id: string, nodes: StrategyNode[], connections: StrategyConnection[]) => {
    setEntries((prev) => {
      const next = new Map(prev);
      next.set(id, { nodes, connections });
      return next;
    });
  }, []);

  /** Get decrypted logic for a strategy. */
  const get = useCallback((id: string): VaultEntry | undefined => {
    return entries.get(id);
  }, [entries]);

  /** Get the session encryption key (for encrypting on save). */
  const getKey = useCallback((): CryptoKey | null => {
    return keyRef.current;
  }, []);

  /** Lock the vault (on disconnect). */
  const lock = useCallback(() => {
    setEntries(new Map());
    setIsUnlocked(false);
    keyRef.current = null;
  }, []);

  return {
    entries,
    isUnlocking,
    isUnlocked,
    unlock,
    put,
    get,
    getKey,
    lock,
  };
}
