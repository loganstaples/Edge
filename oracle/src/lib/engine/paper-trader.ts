import type { TradeInstruction } from "./executor";
import {
  insertSimulatedTrade,
  getSimulatedTrades,
  updateSimulatedTrade,
  upsertStrategyPerformance,
} from "@/lib/db/queries";
import { fetchGeminiTicker } from "@/lib/data/gemini";
import { fetchPolymarketMidpoint } from "@/lib/data/polymarket";

export async function processTrades(strategyId: string, trades: TradeInstruction[]): Promise<void> {
  for (const trade of trades) {
    let entryPrice = 0.5;
    try {
      if (trade.platform === "gemini") {
        const ticker = await fetchGeminiTicker(trade.marketId);
        if (ticker) entryPrice = parseFloat(ticker.bid || ticker.close || "0.5");
      } else if (trade.platform === "polymarket") {
        const midpoint = await fetchPolymarketMidpoint(trade.marketId);
        if (midpoint != null) entryPrice = midpoint;
      }
    } catch {
      // Use fallback price
    }
    insertSimulatedTrade({
      strategyId,
      platform: trade.platform,
      marketId: trade.marketId,
      direction: trade.direction,
      entryPrice,
      amount: trade.amount,
    });
  }
}

export async function updateOpenTrades(strategyId: string): Promise<void> {
  const trades = getSimulatedTrades(strategyId).filter((t) => t.status === "open");
  for (const trade of trades) {
    let currentPrice: number | null = null;
    try {
      if (trade.platform === "gemini") {
        const ticker = await fetchGeminiTicker(trade.marketId);
        if (ticker) currentPrice = parseFloat(ticker.bid || ticker.close || "0");
      } else if (trade.platform === "polymarket") {
        currentPrice = await fetchPolymarketMidpoint(trade.marketId);
      }
    } catch {
      continue;
    }
    if (currentPrice == null) continue;
    const pnl = trade.direction === "YES"
      ? (currentPrice - trade.entryPrice) * trade.amount
      : (trade.entryPrice - currentPrice) * trade.amount;
    updateSimulatedTrade(trade.id, { currentPrice, pnl });
  }
}

export function computePerformanceMetrics(strategyId: string): void {
  const trades = getSimulatedTrades(strategyId);
  const closedTrades = trades.filter((t) => t.status === "closed");
  const totalTrades = trades.length;
  const winningTrades = closedTrades.filter((t) => t.pnl > 0).length;
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);

  // Simple Sharpe approximation
  const returns = closedTrades.map((t) => t.pnl / (t.amount || 1));
  let sharpeRatio = 0;
  if (returns.length >= 2) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
    const std = Math.sqrt(variance);
    sharpeRatio = std === 0 ? 0 : mean / std;
  }

  // Max drawdown
  let maxDrawdown = 0;
  let peak = 0;
  let cumPnl = 0;
  for (const trade of trades) {
    cumPnl += trade.pnl;
    if (cumPnl > peak) peak = cumPnl;
    const drawdown = peak - cumPnl;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  upsertStrategyPerformance(strategyId, {
    totalTrades,
    winningTrades,
    totalPnl: parseFloat(totalPnl.toFixed(4)),
    sharpeRatio: parseFloat(sharpeRatio.toFixed(4)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(4)),
  });
}
