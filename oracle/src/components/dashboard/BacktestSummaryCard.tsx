"use client";

interface BacktestMetrics {
  totalReturn: number;
  totalReturnPct: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  avgTradeReturn: number;
  profitFactor: number;
  finalEquity: number;
}

interface BacktestTrade {
  pnl: number;
}

interface Props {
  metrics: BacktestMetrics;
  trades: BacktestTrade[];
  totalTicks: number;
  startingCapital: number;
  /** Average edge at entry across all executed trades */
  avgEntryEdge: number | null;
}

function generateAssessment(metrics: BacktestMetrics, totalTicks: number): string {
  const { winRate, totalReturn, sharpeRatio, maxDrawdownPct, totalTrades } = metrics;
  if (totalTrades === 0) return "No trades were executed. Strategy gates may have filtered all signals.";
  const profitDesc = totalReturn > 0 ? "Profitable" : "Net loss";
  const riskDesc = maxDrawdownPct < 10 ? "low drawdown" : maxDrawdownPct < 25 ? "moderate drawdown" : "significant drawdown";
  const edgeDesc = winRate > 60 ? "consistent edge detection" : winRate > 45 ? "moderate edge detection" : "inconsistent edge signals";
  const disciplineDesc = sharpeRatio > 1 ? "disciplined risk management" : sharpeRatio > 0.3 ? "adequate risk control" : "high variance execution";
  return `Strategy showed ${edgeDesc} with ${disciplineDesc}. ${profitDesc} across ${totalTicks} ticks with ${riskDesc}.`;
}

export function BacktestSummaryCard({ metrics, trades, totalTicks, startingCapital, avgEntryEdge }: Props) {
  const isPositive = metrics.totalReturn >= 0;
  const bestTrade = trades.length > 0 ? Math.max(...trades.map((t) => t.pnl)) : 0;
  const worstTrade = trades.length > 0 ? Math.min(...trades.map((t) => t.pnl)) : 0;
  const assessment = generateAssessment(metrics, totalTicks);

  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{
        background: "rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.2)",
      }}
    >
      {/* Header: Backtest Complete */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-accent-cyan" style={{ boxShadow: "0 0 8px rgba(34, 211, 238, 0.5)" }} />
        <span className="text-[10px] uppercase tracking-widest text-accent-cyan font-semibold">
          Backtest Complete
        </span>
      </div>

      {/* Big P&L number */}
      <div className="text-center py-2">
        <div
          className="text-[32px] font-semibold font-mono tabular-nums leading-none"
          style={{ color: isPositive ? "#34d399" : "#f87171" }}
        >
          {isPositive ? "+" : ""}${metrics.totalReturn.toFixed(2)}
        </div>
        <div
          className="text-sm font-mono mt-1"
          style={{ color: isPositive ? "rgba(52, 211, 153, 0.7)" : "rgba(248, 113, 113, 0.7)" }}
        >
          {isPositive ? "+" : ""}{metrics.totalReturnPct.toFixed(1)}% return on ${startingCapital.toLocaleString()}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCell label="Total Ticks" value={String(totalTicks)} />
        <StatCell label="Total Trades" value={String(metrics.totalTrades)} />
        <StatCell
          label="Win Rate"
          value={`${metrics.winRate.toFixed(1)}%`}
          valueColor={metrics.winRate >= 50 ? "#34d399" : "#f87171"}
        />
        <StatCell
          label="Best Trade"
          value={`${bestTrade >= 0 ? "+" : ""}$${bestTrade.toFixed(2)}`}
          valueColor={bestTrade >= 0 ? "#34d399" : "#f87171"}
        />
        <StatCell
          label="Worst Trade"
          value={`${worstTrade >= 0 ? "+" : ""}$${worstTrade.toFixed(2)}`}
          valueColor={worstTrade >= 0 ? "#34d399" : "#f87171"}
        />
        <StatCell
          label="Avg Edge at Entry"
          value={avgEntryEdge != null ? `${avgEntryEdge > 0 ? "+" : ""}${avgEntryEdge.toFixed(1)}%` : "N/A"}
          valueColor={avgEntryEdge != null && avgEntryEdge > 0 ? "#34d399" : undefined}
        />
        <StatCell label="Sharpe Ratio" value={metrics.sharpeRatio.toFixed(2)} />
        <StatCell label="Max Drawdown" value={`${metrics.maxDrawdownPct.toFixed(1)}%`} />
        <StatCell
          label="Profit Factor"
          value={
            metrics.profitFactor === Infinity ? "INF"
              : metrics.profitFactor == null ? "N/A"
              : metrics.profitFactor.toFixed(2)
          }
        />
      </div>

      {/* AI Assessment */}
      <div
        className="rounded-lg px-3 py-2.5 text-[12px] text-edge-text-2 leading-relaxed"
        style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.04)" }}
      >
        <span className="text-edge-dim text-[10px] uppercase tracking-wider font-semibold mr-2">Assessment:</span>
        {assessment}
      </div>
    </div>
  );
}

function StatCell({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.03)" }}
    >
      <div className="text-[9px] uppercase tracking-widest text-edge-muted font-semibold mb-0.5">{label}</div>
      <div className="text-sm font-mono font-semibold" style={{ color: valueColor ?? "#eaeaf0" }}>{value}</div>
    </div>
  );
}
