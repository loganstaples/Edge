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
        <span className="text-edge-dim">
          bal: {walletBalance.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
