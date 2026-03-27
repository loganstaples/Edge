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
        <thead>
          <tr>
            <th className="px-4 py-3 text-2xs font-mono font-normal uppercase tracking-wider text-edge-muted text-left">Platform</th>
            <th className="px-4 py-3 text-2xs font-mono font-normal uppercase tracking-wider text-edge-muted text-left">Market</th>
            <th className="px-4 py-3 text-2xs font-mono font-normal uppercase tracking-wider text-edge-muted text-left">Direction</th>
            <th className="px-4 py-3 text-2xs font-mono font-normal uppercase tracking-wider text-edge-muted text-right">Entry</th>
            <th className="px-4 py-3 text-2xs font-mono font-normal uppercase tracking-wider text-edge-muted text-right">Current</th>
            <th className="px-4 py-3 text-2xs font-mono font-normal uppercase tracking-wider text-edge-muted text-right">P&L</th>
            <th className="px-4 py-3 text-2xs font-mono font-normal uppercase tracking-wider text-edge-muted text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr
              key={trade.id}
              className="border-b border-edge-border hover:bg-white/[0.02] transition-colors"
            >
              <td className="px-4 py-3 text-sm text-edge-text-2 capitalize">
                {trade.platform}
              </td>
              <td className="px-4 py-3 text-sm text-edge-text-2 font-mono max-w-[140px] truncate">
                {trade.marketId}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex px-2 py-0.5 text-2xs font-mono uppercase tracking-wider rounded-sm border ${
                    trade.direction === "YES"
                      ? "border-accent-green/30 text-accent-green"
                      : "border-accent-red/30 text-accent-red"
                  }`}
                >
                  {trade.direction}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-mono text-sm text-edge-text-2">
                {trade.entryPrice.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-sm text-edge-text-2">
                {trade.currentPrice?.toFixed(2) ?? "—"}
              </td>
              <td
                className={`px-4 py-3 text-right font-mono text-sm ${
                  trade.pnl > 0
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
                  className={`inline-flex px-2 py-0.5 text-2xs font-mono uppercase tracking-wider rounded-sm ${
                    trade.status === "open"
                      ? "border border-accent-blue/30 text-accent-blue"
                      : trade.status === "closed"
                        ? "bg-white/[0.06] text-edge-muted"
                        : "border border-accent-amber/30 text-accent-amber"
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
