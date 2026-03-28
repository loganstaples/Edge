"use client";

import type { StreamInfo } from "@/hooks/usePaymentStream";

interface StreamIndicatorProps {
  stream: StreamInfo | null;
  walletBalance: number;
}

export function StreamIndicator({ stream, walletBalance }: StreamIndicatorProps) {
  if (!stream || stream.status === "stopped") return null;

  const isPaused = stream.status === "paused";

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-edge-border" style={{ background: "rgba(255,255,255,0.03)" }}>
      {/* Streaming dot */}
      <span className="relative flex h-2 w-2">
        {!isPaused && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-40" />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${isPaused ? "bg-accent-amber" : "bg-accent-green"}`} />
      </span>

      <div className="flex items-center gap-3 text-xs font-mono">
        <span className="text-edge-muted">
          {isPaused ? "Paused" : "Streaming"}
        </span>
        <span className="text-white">
          {stream.totalStreamed.toFixed(4)} USDC
        </span>
        {stream.totalOnChain > 0 && (
          <span className="text-accent-green" title={stream.lastTxSignature ? `Latest tx: ${stream.lastTxSignature}` : undefined}>
            {stream.totalOnChain.toFixed(4)} on-chain
          </span>
        )}
        <span className="text-edge-dim">
          bal: {walletBalance.toFixed(2)}
        </span>
        {stream.lastTxSignature && (
          <a
            href={`https://explorer.solana.com/tx/${stream.lastTxSignature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-cyan hover:text-accent-cyan/80 transition-colors"
            title="View latest transaction on Solana Explorer"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
