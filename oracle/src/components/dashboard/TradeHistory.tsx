"use client";

import { useEffect, useState } from "react";
import { SimulatedTrade } from "@/types";

interface Props {
  strategyId: string;
}

export function TradeHistory({ strategyId }: Props) {
  const [trades, setTrades] = useState<SimulatedTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/strategies/${strategyId}/trades`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setTrades(Array.isArray(data) ? data : []))
      .catch(() => setTrades([]))
      .finally(() => setLoading(false));
  }, [strategyId]);

  if (loading) {
    return (
      <div className="animate-pulse text-edge-muted text-sm py-6 text-center">
        Loading trades...
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="text-edge-muted text-sm py-6 text-center">
        No trades recorded yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-edge-muted uppercase tracking-widest">
            <th className="text-left py-2 px-3 text-[10px] font-semibold">
              Platform
            </th>
            <th className="text-left py-2 px-3 text-[10px] font-semibold">
              Market
            </th>
            <th className="text-left py-2 px-3 text-[10px] font-semibold">
              Direction
            </th>
            <th className="text-right py-2 px-3 text-[10px] font-semibold">
              Entry
            </th>
            <th className="text-right py-2 px-3 text-[10px] font-semibold">
              Current
            </th>
            <th className="text-right py-2 px-3 text-[10px] font-semibold">
              P&L
            </th>
            <th className="text-left py-2 px-3 text-[10px] font-semibold">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Separator line */}
          <tr>
            <td colSpan={7} className="p-0">
              <div className="h-[1px] bg-white/[0.04]" />
            </td>
          </tr>
          {trades.map((trade) => (
            <tr
              key={trade.id}
              className="hover:bg-white/[0.02] transition-colors"
            >
              <td className="py-2 px-3 text-edge-text-2 capitalize text-[10px]">
                {trade.platform}
              </td>
              <td className="py-2 px-3 text-edge-text-2 font-mono max-w-[140px] truncate text-[10px]">
                {trade.marketId}
              </td>
              <td className="py-2 px-3">
                <span
                  className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                    trade.direction === "YES"
                      ? "bg-accent-green/15 text-accent-green"
                      : "bg-accent-red/15 text-accent-red"
                  }`}
                >
                  {trade.direction}
                </span>
              </td>
              <td className="py-2 px-3 text-right font-mono text-edge-text text-[10px]">
                {trade.entryPrice.toFixed(2)}
              </td>
              <td className="py-2 px-3 text-right font-mono text-edge-text text-[10px]">
                {trade.currentPrice?.toFixed(2) ?? "—"}
              </td>
              <td
                className={`py-2 px-3 text-right font-mono font-medium text-[10px] ${
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
              <td className="py-2 px-3">
                <span
                  className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                    trade.status === "open"
                      ? "bg-accent-blue/15 text-accent-blue"
                      : trade.status === "closed"
                        ? "bg-white/[0.04] text-edge-muted"
                        : "bg-accent-amber/15 text-accent-amber"
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
