"use client";
import { useState, useCallback, useEffect, useRef, createContext, useContext } from "react";
import type { ReactNode } from "react";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";

export interface WalletState {
  address: string | null;
  balance: number;
  isConnecting: boolean;
  isConnected: boolean;
}

// USDC mint on Solana devnet
const USDC_MINT_DEVNET = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
// USDC mint on Solana mainnet-beta
const USDC_MINT_MAINNET = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

function getSolanaNetwork(): "devnet" | "mainnet-beta" {
  const rpc = typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "")
    : "";
  if (rpc.includes("mainnet")) return "mainnet-beta";
  return "devnet";
}

function getUsdcMint(): PublicKey {
  return getSolanaNetwork() === "mainnet-beta" ? USDC_MINT_MAINNET : USDC_MINT_DEVNET;
}

function getConnection(): Connection {
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(getSolanaNetwork());
  return new Connection(rpc, "confirmed");
}

interface PhantomProvider {
  isPhantom?: boolean;
  publicKey: { toBase58(): string; toString(): string } | null;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toBase58(): string } }>;
  disconnect(): Promise<void>;
  signAndSendTransaction(transaction: any, options?: any): Promise<{ signature: string }>;
  signTransaction(transaction: any): Promise<any>;
  signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>;
  on(event: string, callback: (...args: any[]) => void): void;
  off(event: string, callback: (...args: any[]) => void): void;
}

function getPhantom(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.solana?.isPhantom ? w.solana : (w.phantom?.solana?.isPhantom ? w.phantom.solana : null);
}

interface WalletContextValue extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signAndSendTransaction: (transaction: any) => Promise<{ signature: string }>;
  signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

/**
 * Shared wallet provider — wraps the app so every useWallet() consumer
 * sees the same connection state.
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    balance: 0,
    isConnecting: false,
    isConnected: false,
  });
  const balanceInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUsdcBalance = useCallback(async (ownerAddress: string): Promise<number> => {
    try {
      const connection = getConnection();
      const owner = new PublicKey(ownerAddress);
      const mint = getUsdcMint();
      const ata = await getAssociatedTokenAddress(mint, owner);
      const account = await getAccount(connection, ata);
      // USDC has 6 decimals
      return Number(account.amount) / 1e6;
    } catch {
      // Token account may not exist yet (0 balance)
      return 0;
    }
  }, []);

  const refreshBalance = useCallback(async (address: string) => {
    const balance = await fetchUsdcBalance(address);
    setWallet((w) => ({ ...w, balance }));
  }, [fetchUsdcBalance]);

  // Start polling balance when connected
  const startBalancePolling = useCallback((address: string) => {
    if (balanceInterval.current) clearInterval(balanceInterval.current);
    // Fetch immediately, then every 15s
    refreshBalance(address);
    balanceInterval.current = setInterval(() => refreshBalance(address), 15000);
  }, [refreshBalance]);

  const stopBalancePolling = useCallback(() => {
    if (balanceInterval.current) {
      clearInterval(balanceInterval.current);
      balanceInterval.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    const phantom = getPhantom();
    if (!phantom) {
      window.open("https://phantom.app/", "_blank");
      return;
    }

    setWallet((w) => ({ ...w, isConnecting: true }));

    try {
      const resp = await phantom.connect();
      const address = resp.publicKey.toBase58();
      const balance = await fetchUsdcBalance(address);

      setWallet({
        address,
        balance,
        isConnecting: false,
        isConnected: true,
      });

      startBalancePolling(address);
    } catch {
      setWallet((w) => ({ ...w, isConnecting: false }));
    }
  }, [fetchUsdcBalance, startBalancePolling]);

  const disconnect = useCallback(async () => {
    const phantom = getPhantom();
    if (phantom) {
      try { await phantom.disconnect(); } catch { /* ignore */ }
    }
    stopBalancePolling();
    setWallet({ address: null, balance: 0, isConnecting: false, isConnected: false });
  }, [stopBalancePolling]);

  // Auto-reconnect if Phantom is already authorized
  useEffect(() => {
    const phantom = getPhantom();
    if (!phantom) return;

    phantom.connect({ onlyIfTrusted: true })
      .then((resp) => {
        const address = resp.publicKey.toBase58();
        fetchUsdcBalance(address).then((balance) => {
          setWallet({ address, balance, isConnecting: false, isConnected: true });
          startBalancePolling(address);
        });
      })
      .catch(() => {
        // Not previously authorized, user needs to click connect
      });

    const handleDisconnect = () => {
      stopBalancePolling();
      setWallet({ address: null, balance: 0, isConnecting: false, isConnected: false });
    };

    phantom.on("disconnect", handleDisconnect);
    return () => {
      phantom.off("disconnect", handleDisconnect);
      stopBalancePolling();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signAndSendTransaction = useCallback(async (transaction: any): Promise<{ signature: string }> => {
    const phantom = getPhantom();
    if (!phantom) throw new Error("Phantom wallet not found");
    return phantom.signAndSendTransaction(transaction);
  }, []);

  const signMessage = useCallback(async (message: Uint8Array): Promise<{ signature: Uint8Array }> => {
    const phantom = getPhantom();
    if (!phantom) throw new Error("Phantom wallet not found");
    return phantom.signMessage(message);
  }, []);

  const value: WalletContextValue = {
    ...wallet,
    connect,
    disconnect,
    signAndSendTransaction,
    signMessage,
    refreshBalance: () => wallet.address ? refreshBalance(wallet.address) : Promise.resolve(),
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

/**
 * Shared wallet hook — all consumers see the same connection state.
 */
export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within <WalletProvider>");
  }
  return ctx;
}
