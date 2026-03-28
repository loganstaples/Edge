"use client";

import { useEffect, useRef, useState } from "react";
import type { TickNarration } from "@/lib/engine/backtester";

interface Props {
  tick: number;
  totalTicks: number;
  narration: TickNarration | null;
}

export function TickNarrationBanner({ tick, totalTicks, narration }: Props) {
  const [pulse, setPulse] = useState(false);
  const prevTick = useRef(tick);

  useEffect(() => {
    if (tick !== prevTick.current) {
      prevTick.current = tick;
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      return () => clearTimeout(t);
    }
  }, [tick]);

  if (!narration) {
    return (
      <div
        className="rounded-xl px-4 py-3 flex items-center gap-3"
        style={{
          background: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <TickBadge tick={tick} totalTicks={totalTicks} />
        <span className="text-[13px] text-edge-muted font-mono">
          Scanning markets...
        </span>
      </div>
    );
  }

  const edgePositive = (narration.edgePct ?? 0) > 0;
  const gatePass = narration.gateResult === true;
  const gateBlock = narration.gateResult === false;
  const hasTrade = !!narration.tradeAction;

  return (
    <div
      className="rounded-xl px-4 py-3 transition-all duration-300"
      style={{
        background: "rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${pulse ? "rgba(34, 211, 238, 0.25)" : "rgba(255, 255, 255, 0.08)"}`,
        boxShadow: pulse ? "0 0 20px rgba(34, 211, 238, 0.08)" : "none",
      }}
    >
      <div className="flex items-center gap-2 flex-wrap text-[13px] font-mono leading-relaxed">
        <TickBadge tick={tick} totalTicks={totalTicks} />
        <Sep />

        {/* News headline */}
        {narration.headline && (
          <>
            <span className="text-edge-muted">News:</span>
            <span className="text-edge-text truncate max-w-[260px]" title={narration.headline}>
              &ldquo;{narration.headline}&rdquo;
            </span>
            <Sep />
          </>
        )}

        {/* Event title (if no headline) */}
        {!narration.headline && narration.eventTitle && (
          <>
            <span className="text-edge-muted">Market:</span>
            <span className="text-edge-text truncate max-w-[260px]" title={narration.eventTitle}>
              {narration.eventTitle}
            </span>
            <Sep />
          </>
        )}

        {/* Sentiment */}
        {narration.sentimentScore != null && (
          <>
            <span className="text-edge-muted">Sentiment:</span>
            <span className={narration.sentimentScore > 0 ? "text-accent-green" : narration.sentimentScore < 0 ? "text-accent-red" : "text-edge-text"}>
              {narration.sentimentScore > 0 ? "+" : ""}{narration.sentimentScore}
            </span>
            <Sep />
          </>
        )}

        {/* AI Estimate */}
        {narration.aiEstimate != null && (
          <>
            <span className="text-edge-muted">AI:</span>
            <span className="text-accent-purple">
              {(narration.aiEstimate * 100).toFixed(0)}%
            </span>
            {narration.aiConfidence && (
              <span className="text-edge-dim text-[11px]">
                ({narration.aiConfidence})
              </span>
            )}
            <Sep />
          </>
        )}

        {/* Market Price */}
        {narration.marketPrice != null && (
          <>
            <span className="text-edge-muted">Price:</span>
            <span className="text-edge-text">${narration.marketPrice.toFixed(2)}</span>
            <Sep />
          </>
        )}

        {/* Edge */}
        {narration.edgePct != null && (
          <>
            <span className="text-edge-muted">Edge:</span>
            <span className={edgePositive ? "text-accent-green" : "text-accent-red"}>
              {edgePositive ? "+" : ""}{narration.edgePct.toFixed(1)}%
            </span>
            <Sep />
          </>
        )}

        {/* Gate */}
        {narration.gateResult != null && (
          <>
            <span className="text-edge-muted">Gate:</span>
            {gatePass && <span className="text-accent-green font-semibold">PASSED</span>}
            {gateBlock && <span className="text-amber-400">BLOCKED</span>}
            <Sep />
          </>
        )}

        {/* Trade */}
        {hasTrade ? (
          <span className="text-accent-green font-semibold">
            {narration.tradeAction} {narration.tradeAmount?.toFixed(0)} {narration.tradeDirection} @ ${narration.tradePrice?.toFixed(2)}
          </span>
        ) : (
          narration.gateResult === false && (
            <span className="text-edge-dim">No trade</span>
          )
        )}
      </div>
    </div>
  );
}

function TickBadge({ tick, totalTicks }: { tick: number; totalTicks: number }) {
  const pct = ((tick + 1) / totalTicks) * 100;
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="relative w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-accent-cyan/60 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-accent-cyan font-semibold tabular-nums whitespace-nowrap">
        {tick + 1}/{totalTicks}
      </span>
    </div>
  );
}

function Sep() {
  return <span className="text-white/[0.12] select-none">|</span>;
}
