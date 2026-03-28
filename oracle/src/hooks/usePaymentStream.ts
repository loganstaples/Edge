"use client";
import { useState, useCallback, useRef } from "react";
import { sendUsdcPayment } from "@/lib/payments/solana-transfer";

export interface StreamInfo {
  id: string;
  flowRate: string;
  totalStreamed: number;
  status: "active" | "paused" | "stopped";
  startedAt: string;
  /** Total USDC sent on-chain (confirmed) */
  totalOnChain: number;
  /** Latest Solana tx signature */
  lastTxSignature: string | null;
}

const BATCH_THRESHOLD_USDC = 0.005; // Send on-chain every 0.005 USDC accumulated

/**
 * Manages a payment stream for a strategy.
 * Tracks costs per tick in the DB, AND sends real USDC
 * transfers on Solana devnet in batches.
 */
export function usePaymentStream() {
  const [stream, setStream] = useState<StreamInfo | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const pendingAmountRef = useRef(0);
  const isSendingRef = useRef(false);
  const walletRef = useRef<{
    address: string;
    signAndSendTransaction: (tx: any) => Promise<{ signature: string }>;
  } | null>(null);

  const flushPayment = useCallback(async () => {
    if (isSendingRef.current || pendingAmountRef.current <= 0 || !walletRef.current) return;
    const amount = pendingAmountRef.current;
    pendingAmountRef.current = 0;
    isSendingRef.current = true;

    try {
      const result = await sendUsdcPayment(
        walletRef.current.signAndSendTransaction,
        walletRef.current.address,
        amount,
      );
      if (result.signature) {
        setStream((s) => s ? {
          ...s,
          totalOnChain: s.totalOnChain + amount,
          lastTxSignature: result.signature,
        } : null);
      }
    } catch {
      // Re-add to pending if failed
      pendingAmountRef.current += amount;
    } finally {
      isSendingRef.current = false;
    }
  }, []);

  const startStream = useCallback(async (
    strategyId: string,
    walletAddress: string,
    pollingIntervalMs: number,
    signAndSendTransaction?: (tx: any) => Promise<{ signature: string }>,
  ) => {
    setIsStarting(true);

    // Store wallet ref for on-chain payments
    if (signAndSendTransaction) {
      walletRef.current = { address: walletAddress, signAndSendTransaction };
    }

    try {
      const res = await fetch("/api/payments/streams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategyId, walletAddress, pollingIntervalMs }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start payment stream");
      }
      const data = await res.json();
      pendingAmountRef.current = 0;
      setStream({
        id: data.id,
        flowRate: data.flowRate,
        totalStreamed: 0,
        status: "active",
        startedAt: data.startedAt,
        totalOnChain: 0,
        lastTxSignature: null,
      });
      return data;
    } finally {
      setIsStarting(false);
    }
  }, []);

  const pauseStream = useCallback(async () => {
    if (!stream) return;
    // Flush any pending payment before pausing
    await flushPayment();
    await fetch(`/api/payments/streams/${stream.id}/pause`, { method: "POST" });
    setStream((s) => s ? { ...s, status: "paused" } : null);
  }, [stream, flushPayment]);

  const resumeStream = useCallback(async () => {
    if (!stream) return;
    await fetch(`/api/payments/streams/${stream.id}/resume`, { method: "POST" });
    setStream((s) => s ? { ...s, status: "active" } : null);
  }, [stream]);

  const stopStream = useCallback(async () => {
    if (!stream) return;
    // Flush final payment
    await flushPayment();
    await fetch(`/api/payments/streams/${stream.id}/stop`, { method: "POST" });
    setStream((s) => s ? { ...s, status: "stopped" } : null);
    walletRef.current = null;
    setStream(null);
  }, [stream, flushPayment]);

  const recordTick = useCallback(async (amount: number) => {
    if (!stream) return;
    // Record in server DB
    await fetch(`/api/payments/streams/${stream.id}/tick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    setStream((s) => s ? { ...s, totalStreamed: s.totalStreamed + amount } : null);

    // Accumulate for on-chain batch
    pendingAmountRef.current += amount;
    if (pendingAmountRef.current >= BATCH_THRESHOLD_USDC) {
      flushPayment();
    }
  }, [stream, flushPayment]);

  const loadStream = useCallback(async (strategyId: string) => {
    try {
      const res = await fetch(`/api/payments/streams?strategyId=${strategyId}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setStream({
            id: data.id,
            flowRate: data.flowRate,
            totalStreamed: data.totalStreamed,
            status: data.status,
            startedAt: data.startedAt,
            totalOnChain: 0,
            lastTxSignature: null,
          });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  return {
    stream,
    isStarting,
    startStream,
    pauseStream,
    resumeStream,
    stopStream,
    recordTick,
    loadStream,
    flushPayment,
  };
}
