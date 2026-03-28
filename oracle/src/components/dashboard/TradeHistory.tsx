"use client";

import { useEffect, useState } from "react";
import { SimulatedTrade } from "@/types";

interface Props {
  strategyId: string;
  pollInterval?: number;
}

export function TradeHistory({ strategyId, pollInterval = 0 }: Props) {
  const [trades, setTrades] = useState<SimulatedTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrades = () => {
      fetch(`/api/strategies/${strategyId}/trades`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setTrades(Array.isArray(data) ? data : []))
        .catch(() => setTrades([]))
        .finally(() => setLoading(false));
    };
    setLoading(true);
    fetchTrades();
    if (pollInterval > 0) {
      const id = setInterval(fetchTrades, pollInterval);
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

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center py-8">
        <p className="text-sm text-edge-text-2">No trades recorded yet</p>
        <p className="text-2xs text-edge-muted mt-1">Trades will appear when positions are opened.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="border-b border-edge-border/50">
          <tr>
            <th className="px-4 py-3 text-xs font-semibold text-edge-muted text-left">Platform</th>
            <th className="px-4 py-3 text-xs font-semibold text-edge-muted text-left">Market</th>
            <th className="px-4 py-3 text-xs font-semibold text-edge-muted text-left">Direction</th>
            <th className="px-4 py-3 text-xs font-semibold text-edge-muted text-right">Entry</th>
            <th className="px-4 py-3 text-xs font-semibold text-edge-muted text-right">Current</th>
            <th className="px-4 py-3 text-xs font-semibold text-edge-muted text-right">P&L</th>
            <th className="px-4 py-3 text-xs font-semibold text-edge-muted text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr
              key={trade.id}
              className="border-b border-edge-border hover:bg-white/[0.02] transition-colors"
            >
              <td className="px-4 py-3 text-sm text-edge-text capitalize">
                {trade.platform}
              </td>
              <td className="px-4 py-3 text-sm text-edge-text max-w-[140px] truncate">
                {trade.marketId}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex px-2.5 py-1 text-[11px] font-medium rounded-md border ${trade.direction === "YES"
                      ? "bg-accent-green/10 text-accent-green border-accent-green/20"
                      : "bg-accent-red/10 text-accent-red border-accent-red/20"
                    }`}
                >
                  {trade.direction}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-medium text-sm text-edge-text">
                {trade.entryPrice.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right font-medium text-sm text-edge-text">
                {trade.currentPrice?.toFixed(2) ?? "—"}
              </td>
              <td
                className={`px-4 py-3 text-right font-medium text-sm ${trade.pnl > 0
                    ? "text-accent-green"
                    : trade.pnl < 0
                      ? "text-accent-red"
                      : "text-edge-muted"
                  }`}
              >
                {trade.pnl > 0 ? "+" : ""}
                {trade.pnl.toFixed(2)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex px-2.5 py-1 text-[11px] font-medium rounded-md border ${trade.status === "open"
                      ? "bg-accent-blue/10 text-accent-blue border-accent-blue/20"
                      : trade.status === "closed"
                        ? "bg-white/5 text-edge-muted border-white/10"
                        : "bg-accent-amber/10 text-accent-amber border-accent-amber/20"
                    }`}
                >
                  {trade.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
