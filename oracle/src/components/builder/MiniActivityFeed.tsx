"use client";

import { useState, useEffect, useRef } from "react";
import type { ExecutionLogEntry } from "@/types";

interface MiniActivityFeedProps {
  logs: ExecutionLogEntry[];
  isExecuting: boolean;
  totalPnl: number;
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

const EVENT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  trade: { bg: "bg-accent-green/20", text: "text-accent-green", label: "TRADE" },
  pass: { bg: "bg-accent-green/20", text: "text-accent-green", label: "PASS" },
  data: { bg: "bg-accent-blue/20", text: "text-accent-blue", label: "DATA" },
  ai: { bg: "bg-accent-purple/20", text: "text-accent-purple", label: "AI" },
  calc: { bg: "bg-accent-purple/20", text: "text-accent-purple", label: "CALC" },
  block: { bg: "bg-edge-dim/20", text: "text-edge-muted", label: "BLOCK" },
  warn: { bg: "bg-accent-amber/20", text: "text-accent-amber", label: "WARN" },
};

function getEventType(log: ExecutionLogEntry): string {
  if (log.tradePlaced) return "trade";
  // Check node logs for blocks
  const statuses = log.nodeLogs?._nodeStatuses as Record<string, string> | undefined;
  if (statuses) {
    const hasBlock = Object.values(statuses).some((s) => s === "blocked");
    if (hasBlock) return "block";
  }
  return "pass";
}

function getDescription(log: ExecutionLogEntry): string {
  if (log.tradePlaced && log.tradeDetails) {
    const d = log.tradeDetails;
    return `${d.direction} on ${d.platform} @ $${d.price?.toFixed(2) ?? "—"}`;
  }
  const statuses = log.nodeLogs?._nodeStatuses as Record<string, string> | undefined;
  if (statuses) {
    const passCount = Object.values(statuses).filter((s) => s === "passed").length;
    const blockCount = Object.values(statuses).filter((s) => s === "blocked").length;
    if (blockCount > 0) return `Gate blocked (${passCount} passed, ${blockCount} blocked)`;
    return `${passCount} nodes executed`;
  }
  return "Tick completed";
}

export function MiniActivityFeed({ logs, isExecuting, totalPnl }: MiniActivityFeedProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [logs.length]);

  const latestLog = logs[0];
  const tradeCount = logs.filter((l) => l.tradePlaced).length;

  return (
    <div className="border-t border-edge-border bg-edge-surface-2 flex-shrink-0">
      {/* Header / collapsed view */}
      <button
        onClick={() => setIsExpanded((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-edge-surface transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold text-edge-muted uppercase tracking-wider">
            Activity
          </span>
          {isExecuting && (
            <span className="flex items-center gap-1.5 text-[10px] text-accent-green">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-green" />
              </span>
              Live
            </span>
          )}
          {/* Inline last event when collapsed */}
          {!isExpanded && latestLog && (
            <span className="text-[10px] text-edge-text-2 truncate max-w-[400px]">
              {formatTime(latestLog.timestamp)} — {getDescription(latestLog)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {tradeCount > 0 && (
            <span className="text-[10px] text-edge-text-2">
              {tradeCount} trade{tradeCount !== 1 ? "s" : ""}
            </span>
          )}
          <span className={`text-[10px] font-mono ${totalPnl >= 0 ? "text-accent-green" : "text-accent-red"}`}>
            P&L: {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}
          </span>
          <svg
            className={`w-3.5 h-3.5 text-edge-text-2 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded log list */}
      {isExpanded && (
        <div ref={listRef} className="max-h-[200px] overflow-y-auto border-t border-edge-border">
          {logs.length === 0 ? (
            <div className="px-4 py-4 text-center text-[11px] text-edge-text-2">
              No activity yet. Deploy a strategy to begin.
            </div>
          ) : (
            <div className="divide-y divide-edge-border">
              {logs.map((log) => {
                const eventType = getEventType(log);
                const style = EVENT_STYLES[eventType] ?? EVENT_STYLES.pass;
                return (
                  <div key={log.id} className="px-4 py-1.5 flex items-center gap-3 text-[10px]">
                    <span className="text-edge-dim w-16 flex-shrink-0 font-mono">
                      {formatTime(log.timestamp)}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                    <span className="text-edge-text-2 flex-1 truncate">
                      {getDescription(log)}
                    </span>
                    {log.tradePlaced && log.tradeDetails?.amount && (
                      <span className="text-accent-green font-mono flex-shrink-0">
                        ${log.tradeDetails.amount}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
