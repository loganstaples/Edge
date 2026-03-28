"use client";

import { useRef, useEffect } from "react";
import type { TickNarration } from "@/lib/engine/backtester";

interface TickEntry {
  tick: number;
  timestamp: string;
  narrations: TickNarration[];
  tradesThisTick: number;
}

interface Props {
  entries: TickEntry[];
  isStreaming: boolean;
}

export function ExecutionStepLog({ entries, isStreaming }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top when new entries arrive (newest first)
  useEffect(() => {
    if (scrollRef.current && isStreaming) {
      scrollRef.current.scrollTop = 0;
    }
  }, [entries.length, isStreaming]);

  if (entries.length === 0) {
    return (
      <div className="text-center text-edge-muted text-xs py-6">
        {isStreaming ? "Waiting for tick data..." : "No execution data."}
      </div>
    );
  }

  // Show newest first
  const reversed = [...entries].reverse();

  return (
    <div
      ref={scrollRef}
      className="overflow-y-auto max-h-[320px] space-y-0.5"
      style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}
    >
      {reversed.map((entry, i) => {
        // Pick the best narration (prefer one with a trade)
        const narr = pickBest(entry.narrations);
        const hasTrade = entry.tradesThisTick > 0;
        const gateBlocked = narr?.gateResult === false && !hasTrade;

        return (
          <div
            key={entry.tick}
            className="rounded-lg px-3 py-2.5 transition-all duration-200"
            style={{
              background: i % 2 === 0 ? "rgba(255, 255, 255, 0.02)" : "rgba(255, 255, 255, 0.035)",
              borderLeft: "3px solid",
              borderLeftColor: hasTrade
                ? "rgba(0, 210, 106, 0.7)"
                : gateBlocked
                  ? "rgba(251, 191, 36, 0.5)"
                  : "rgba(107, 114, 128, 0.3)",
            }}
          >
            {/* Header: timestamp + tick */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-edge-muted">
                {new Date(entry.timestamp).toLocaleString("en-US", {
                  year: "numeric", month: "2-digit", day: "2-digit",
                  hour: "2-digit", minute: "2-digit", second: "2-digit",
                })}
              </span>
              <span className="text-xs font-semibold text-edge-text">
                Tick {entry.tick + 1}
              </span>
              {/* Status dot */}
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: hasTrade ? "#00D26A" : gateBlocked ? "#FBbf24" : "#6b7280",
                  boxShadow: hasTrade ? "0 0 6px rgba(0, 210, 106, 0.5)" : "none",
                }}
              />
            </div>

            {narr ? (
              <div className="space-y-1 text-xs leading-relaxed text-edge-text-2">
                {/* News / Event */}
                {(narr.headline || narr.eventTitle) && (
                  <div>
                    <span className="text-edge-dim">{narr.headline ? "News" : "Market"}:</span>{" "}
                    <span className="text-edge-text">
                      {narr.headline ? `"${narr.headline}"` : narr.eventTitle}
                    </span>
                  </div>
                )}

                {/* AI + Sentiment line */}
                {(narr.sentimentScore != null || narr.aiEstimate != null) && (
                  <div className="flex items-center gap-3 flex-wrap">
                    {narr.sentimentScore != null && (
                      <span>
                        <span className="text-edge-dim">Sentiment:</span>{" "}
                        <span className={narr.sentimentScore > 0 ? "text-accent-green" : narr.sentimentScore < 0 ? "text-accent-red" : "text-edge-text"}>
                          {narr.sentimentScore > 0 ? "+" : ""}{narr.sentimentScore}
                        </span>
                      </span>
                    )}
                    {narr.aiEstimate != null && (
                      <span>
                        <span className="text-edge-dim">AI Estimate:</span>{" "}
                        <span className="text-accent-purple">
                          {(narr.aiEstimate * 100).toFixed(0)}%
                        </span>
                        {narr.aiConfidence && (
                          <span className="text-edge-dim"> ({narr.aiConfidence})</span>
                        )}
                      </span>
                    )}
                    {narr.aiDirection && (
                      <span>
                        <span className="text-edge-dim">Direction:</span>{" "}
                        <span className={
                          narr.aiDirection === "bullish" ? "text-accent-green"
                            : narr.aiDirection === "bearish" ? "text-accent-red"
                              : "text-edge-text"
                        }>
                          {narr.aiDirection.charAt(0).toUpperCase() + narr.aiDirection.slice(1)}
                        </span>
                      </span>
                    )}
                  </div>
                )}

                {/* Market + Edge line */}
                {(narr.marketPrice != null || narr.edgePct != null) && (
                  <div className="flex items-center gap-3 flex-wrap">
                    {narr.marketPrice != null && (
                      <span>
                        <span className="text-edge-dim">Market:</span>{" "}
                        <span className="text-edge-text">${narr.marketPrice.toFixed(2)}</span>
                      </span>
                    )}
                    {narr.edgePct != null && (
                      <span>
                        <span className="text-edge-dim">Edge:</span>{" "}
                        <span className={(narr.edgePct ?? 0) > 0 ? "text-accent-green" : "text-accent-red"}>
                          {(narr.edgePct ?? 0) > 0 ? "+" : ""}{narr.edgePct?.toFixed(1)}%
                        </span>
                      </span>
                    )}
                  </div>
                )}

                {/* Source quality line */}
                {(narr.sourceWeight != null || narr.timeDecay != null || narr.liquidityFactor != null) && (
                  <div className="flex items-center gap-3 text-edge-dim">
                    {narr.sourceWeight != null && <span>Source Quality: {narr.sourceWeight.toFixed(2)}</span>}
                    {narr.timeDecay != null && <span>Time Decay: {narr.timeDecay.toFixed(2)}</span>}
                    {narr.liquidityFactor != null && <span>Liquidity: {narr.liquidityFactor.toFixed(2)}</span>}
                  </div>
                )}

                {/* Gate + Action line */}
                <div className="flex items-center gap-3 flex-wrap">
                  {narr.gateResult != null && (
                    <span>
                      <span className="text-edge-dim">Gate:</span>{" "}
                      {narr.gateResult ? (
                        <span className="text-accent-green font-semibold">PASSED</span>
                      ) : (
                        <span className="text-amber-400">BLOCKED</span>
                      )}
                      {narr.gateDetails && (
                        <span className="text-edge-dim text-[10px]"> ({narr.gateDetails})</span>
                      )}
                    </span>
                  )}
                  {narr.tradeAction ? (
                    <span>
                      <span className="text-edge-dim">Action:</span>{" "}
                      <span className="text-accent-green font-semibold">
                        {narr.tradeAction} {narr.tradeAmount?.toFixed(0)} {narr.tradeDirection} @ ${narr.tradePrice?.toFixed(2)}
                      </span>
                      {narr.eventTitle && (
                        <span className="text-edge-text-2 ml-1.5">
                          on <span className="text-edge-text">{narr.eventTitle}</span>
                          {narr.platform && (
                            <span className="text-edge-dim text-[10px] ml-1">({narr.platform})</span>
                          )}
                        </span>
                      )}
                    </span>
                  ) : (
                    narr.gateResult === false && (
                      <span className="text-edge-dim">No trade</span>
                    )
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-edge-dim">
                No signal data — markets scanned: {entry.narrations.length === 0 ? "0" : entry.narrations.length}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function pickBest(narrations: TickNarration[]): TickNarration | null {
  if (narrations.length === 0) return null;
  // Prefer narration with a trade action
  const withTrade = narrations.find((n) => n.tradeAction);
  if (withTrade) return withTrade;
  // Then prefer highest absolute edge
  return narrations.reduce((best, n) =>
    Math.abs(n.edgePct ?? 0) > Math.abs(best.edgePct ?? 0) ? n : best
  );
}
