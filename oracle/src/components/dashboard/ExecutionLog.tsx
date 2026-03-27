"use client";

import { useEffect, useState } from "react";
import { ExecutionLogEntry } from "@/types";

interface Props {
  strategyId: string;
}

export function ExecutionLog({ strategyId }: Props) {
  const [logs, setLogs] = useState<ExecutionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/strategies/${strategyId}/logs`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setLogs(Array.isArray(data) ? data : []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [strategyId]);

  if (loading) {
    return (
      <div className="animate-pulse text-edge-muted text-sm py-6 text-center">
        Loading execution log...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-edge-muted text-sm py-6 text-center">
        No execution logs yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-edge-muted uppercase tracking-widest">
            <th className="text-left py-2 px-3 text-[10px] font-semibold">
              Timestamp
            </th>
            <th className="text-left py-2 px-3 text-[10px] font-semibold">
              Trade
            </th>
            <th className="text-left py-2 px-3 text-[10px] font-semibold">
              Details
            </th>
            <th className="text-right py-2 px-3 text-[10px] font-semibold">
              P&L Delta
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Separator line */}
          <tr>
            <td colSpan={4} className="p-0">
              <div className="h-[1px] bg-white/[0.04]" />
            </td>
          </tr>
          {logs.map((log) => (
            <tr
              key={log.id}
              className="hover:bg-white/[0.02] transition-colors"
            >
              <td className="py-2 px-3 text-edge-text-2 font-mono whitespace-nowrap text-[10px]">
                {new Date(log.timestamp).toLocaleString()}
              </td>
              <td className="py-2 px-3">
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                    log.tradePlaced
                      ? "bg-accent-green/15 text-accent-green"
                      : "bg-white/[0.04] text-edge-muted"
                  }`}
                >
                  {log.tradePlaced ? "YES" : "NO"}
                </span>
              </td>
              <td className="py-2 px-3 text-edge-text-2 max-w-[200px] truncate text-[10px]">
                {log.tradeDetails
                  ? `${log.tradeDetails.direction ?? ""} ${log.tradeDetails.marketId ?? ""}`
                  : "—"}
              </td>
              <td
                className={`py-2 px-3 text-right font-mono font-medium text-[10px] ${
                  log.pnlDelta > 0
                    ? "text-accent-green"
                    : log.pnlDelta < 0
                      ? "text-accent-red"
                      : "text-edge-muted"
                }`}
              >
                {log.pnlDelta > 0 ? "+" : ""}
                {log.pnlDelta.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
