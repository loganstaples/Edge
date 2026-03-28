"use client";

import { useEffect, useState } from "react";
import { ExecutionLogEntry } from "@/types";

interface Props {
  strategyId: string;
  pollInterval?: number;
}

export function ExecutionLog({ strategyId, pollInterval = 0 }: Props) {
  const [logs, setLogs] = useState<ExecutionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = () => {
      fetch(`/api/strategies/${strategyId}/logs`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setLogs(Array.isArray(data) ? data : []))
        .catch(() => setLogs([]))
        .finally(() => setLoading(false));
    };
    setLoading(true);
    fetchLogs();
    if (pollInterval > 0) {
      const id = setInterval(fetchLogs, pollInterval);
      return () => clearInterval(id);
    }
  }, [strategyId, pollInterval]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 rounded bg-white/[0.03] animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center py-8">
        <p className="text-sm text-edge-text-2">No execution logs yet</p>
        <p className="text-2xs text-edge-muted mt-1">Logs will appear when the strategy runs.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="border-b border-edge-border/50">
          <tr>
            <th className="px-4 py-3 text-xs font-semibold text-edge-muted text-left">Timestamp</th>
            <th className="px-4 py-3 text-xs font-semibold text-edge-muted text-left">Trade</th>
            <th className="px-4 py-3 text-xs font-semibold text-edge-muted text-left">Details</th>
            <th className="px-4 py-3 text-xs font-semibold text-edge-muted text-right">P&L Delta</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr
              key={log.id}
              className="border-b border-edge-border hover:bg-white/[0.02] transition-colors"
            >
              <td className="px-4 py-3 text-sm text-edge-text whitespace-nowrap">
                {new Date(log.timestamp).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border ${log.tradePlaced
                      ? "bg-accent-green/10 text-accent-green border-accent-green/20"
                      : "bg-white/5 text-edge-muted border-white/10"
                    }`}
                >
                  {log.tradePlaced ? "YES" : "NO"}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-edge-text max-w-[200px] truncate">
                {log.tradeDetails
                  ? `${log.tradeDetails.direction ?? ""} ${log.tradeDetails.marketId ?? ""}`
                  : "—"}
              </td>
              <td
                className={`px-4 py-3 text-right font-medium text-sm ${log.pnlDelta > 0
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
