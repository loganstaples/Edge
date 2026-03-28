"use client";

import { useState } from "react";
import { TICK_COST_USDC, MIN_BALANCE_USDC } from "@/lib/payments/constants";

interface PaymentModalProps {
  isOpen: boolean;
  walletAddress: string | null;
  walletBalance: number;
  isConnected: boolean;
  isConnecting: boolean;
  pollingIntervalMs: number;
  onConnect: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PaymentModal({
  isOpen,
  walletAddress,
  walletBalance,
  isConnected,
  isConnecting,
  pollingIntervalMs,
  onConnect,
  onConfirm,
  onCancel,
}: PaymentModalProps) {
  if (!isOpen) return null;

  const ticksPerMinute = (60 * 1000) / pollingIntervalMs;
  const costPerMinute = ticksPerMinute * TICK_COST_USDC;
  const costPerHour = costPerMinute * 60;
  const hasEnoughBalance = walletBalance >= MIN_BALANCE_USDC;
  const estimatedRuntime = walletBalance > 0 ? (walletBalance / costPerMinute).toFixed(0) : "0";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl border border-edge-border overflow-hidden"
        style={{ background: "rgba(14, 14, 16, 0.95)" }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold text-white">Start Payment Stream</h2>
          <p className="text-sm text-edge-muted mt-1">
            Running this strategy requires a USDC payment stream on Solana.
          </p>
        </div>

        {/* Cost breakdown */}
        <div className="px-6 pb-4">
          <div className="rounded-xl border border-edge-border p-4 space-y-3" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-edge-muted">Cost per tick</span>
              <span className="text-white font-mono">{TICK_COST_USDC} USDC</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-edge-muted">Polling interval</span>
              <span className="text-white font-mono">{(pollingIntervalMs / 1000).toFixed(0)}s</span>
            </div>
            <div className="h-px bg-edge-border" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-edge-muted">Est. cost/minute</span>
              <span className="text-white font-mono">{costPerMinute.toFixed(4)} USDC</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-edge-muted">Est. cost/hour</span>
              <span className="text-white font-mono">{costPerHour.toFixed(4)} USDC</span>
            </div>
          </div>
        </div>

        {/* Wallet section */}
        <div className="px-6 pb-6">
          {!isConnected ? (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="w-full py-3 rounded-xl text-sm font-medium text-white transition-all duration-200"
              style={{
                background: "linear-gradient(135deg, #AB9FF2 0%, #7C3AED 100%)",
                opacity: isConnecting ? 0.6 : 1,
              }}
            >
              {isConnecting ? "Connecting..." : "Connect Phantom Wallet"}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-edge-border p-4" style={{ background: "rgba(255,255,255,0.02)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-edge-muted uppercase tracking-wider">Wallet</span>
                  <span className="text-xs text-accent-green font-mono">Connected</span>
                </div>
                <p className="text-sm text-white font-mono truncate">{walletAddress}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-sm text-edge-muted">USDC Balance</span>
                  <span className={`text-sm font-mono ${hasEnoughBalance ? "text-white" : "text-accent-red"}`}>
                    {walletBalance.toFixed(2)} USDC
                  </span>
                </div>
                {hasEnoughBalance && (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-edge-dim">Est. runtime</span>
                    <span className="text-xs text-edge-muted font-mono">{estimatedRuntime} min</span>
                  </div>
                )}
              </div>

              {!hasEnoughBalance && (
                <p className="text-xs text-accent-red text-center">
                  Minimum balance of {MIN_BALANCE_USDC} USDC required to start a stream.
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-edge-muted border border-edge-border hover:border-edge-border-2 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  disabled={!hasEnoughBalance}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: hasEnoughBalance
                      ? "linear-gradient(135deg, #00D26A 0%, #00B85C 100%)"
                      : "rgba(99, 99, 110, 0.3)",
                  }}
                >
                  Start Stream
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
