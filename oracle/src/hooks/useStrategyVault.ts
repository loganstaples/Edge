"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import type { StrategyNode, StrategyConnection } from "@/types";
import { deriveEncryptionKey, decryptStrategy } from "@/lib/encryption/strategy-cipher";

export interface VaultEntry {
  nodes: StrategyNode[];
  connections: StrategyConnection[];
}

interface VaultContextValue {
  entries: Map<string, VaultEntry>;
  isUnlocking: boolean;
  isUnlocked: boolean;
  unlock: (
    walletAddress: string,
    signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>,
  ) => Promise<void>;
  put: (id: string, nodes: StrategyNode[], connections: StrategyConnection[]) => void;
  get: (id: string) => VaultEntry | undefined;
  getKey: () => CryptoKey | null;
  lock: () => void;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function StrategyVaultProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<Map<string, VaultEntry>>(new Map());
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const keyRef = useRef<CryptoKey | null>(null);
  const unlockPromiseRef = useRef<Promise<void> | null>(null);

  const unlock = useCallback(async (
    walletAddress: string,
    signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>,
  ) => {
    if (isUnlocked || keyRef.current) return;

    // Prevent concurrent unlock attempts (multiple components calling unlock)
    if (unlockPromiseRef.current) {
      return unlockPromiseRef.current;
    }

    const promise = (async () => {
      setIsUnlocking(true);
      try {
        const key = await deriveEncryptionKey(signMessage);
        keyRef.current = key;

        const res = await fetch("/api/strategies/encrypted", {
          headers: { "X-Wallet-Address": walletAddress },
        });
        if (!res.ok) {
          throw new Error("Failed to fetch encrypted strategies");
        }
        const { strategies } = await res.json() as {
          strategies: { id: string; encryptedData: string | null }[];
        };

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
        unlockPromiseRef.current = null;
      }
    })();

    unlockPromiseRef.current = promise;
    return promise;
  }, [isUnlocked]);

  const put = useCallback((id: string, nodes: StrategyNode[], connections: StrategyConnection[]) => {
    setEntries((prev) => {
      const next = new Map(prev);
      next.set(id, { nodes, connections });
      return next;
    });
  }, []);

  const get = useCallback((id: string): VaultEntry | undefined => {
    return entries.get(id);
  }, [entries]);

  const getKey = useCallback((): CryptoKey | null => {
    return keyRef.current;
  }, []);

  const lock = useCallback(() => {
    setEntries(new Map());
    setIsUnlocked(false);
    keyRef.current = null;
    unlockPromiseRef.current = null;
  }, []);

  return (
    <VaultContext.Provider value={{ entries, isUnlocking, isUnlocked, unlock, put, get, getKey, lock }}>
      {children}
    </VaultContext.Provider>
  );
}

export function useStrategyVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) {
    throw new Error("useStrategyVault must be used within <StrategyVaultProvider>");
  }
  return ctx;
}
