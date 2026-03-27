"use client";
import { useState, useCallback } from "react";

export interface StreamInfo {
  id: string;
  flowRate: string;
  totalStreamed: number;
  status: "active" | "paused" | "stopped";
  startedAt: string;
}

/**
 * Manages a payment stream for a strategy.
 * Calls server-side APIs to create/pause/stop streams and
 * track costs per tick.
 */
export function usePaymentStream() {
  const [stream, setStream] = useState<StreamInfo | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const startStream = useCallback(async (strategyId: string, walletAddress: string, pollingIntervalMs: number) => {
    setIsStarting(true);
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
      setStream({
        id: data.id,
        flowRate: data.flowRate,
        totalStreamed: 0,
        status: "active",
        startedAt: data.startedAt,
      });
      return data;
    } finally {
      setIsStarting(false);
    }
  }, []);

  const pauseStream = useCallback(async () => {
    if (!stream) return;
    await fetch(`/api/payments/streams/${stream.id}/pause`, { method: "POST" });
    setStream((s) => s ? { ...s, status: "paused" } : null);
  }, [stream]);

  const resumeStream = useCallback(async () => {
    if (!stream) return;
    await fetch(`/api/payments/streams/${stream.id}/resume`, { method: "POST" });
    setStream((s) => s ? { ...s, status: "active" } : null);
  }, [stream]);

  const stopStream = useCallback(async () => {
    if (!stream) return;
    await fetch(`/api/payments/streams/${stream.id}/stop`, { method: "POST" });
    setStream((s) => s ? { ...s, status: "stopped" } : null);
    setStream(null);
  }, [stream]);

  const recordTick = useCallback(async (amount: number) => {
    if (!stream) return;
    await fetch(`/api/payments/streams/${stream.id}/tick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    setStream((s) => s ? { ...s, totalStreamed: s.totalStreamed + amount } : null);
  }, [stream]);

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
  };
}
