"use client";

import { useState, useCallback, useRef } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { TickNarrationBanner } from "./TickNarrationBanner";
import { ExecutionStepLog } from "./ExecutionStepLog";
import { BacktestSummaryCard } from "./BacktestSummaryCard";
import type { TickNarration } from "@/lib/engine/backtester";

interface BacktestTrade {
  tick: number;
  timestamp: string;
  marketId: string;
  eventTitle: string;
  platform: string;
  direction: "YES" | "NO";
  entryPrice: number;
  exitPrice: number;
  amount: number;
  pnl: number;
  status: "closed" | "open";
  exitReason?: string;
}

interface BacktestTick {
  tick: number;
  timestamp: string;
  equity: number;
  drawdown: number;
  tradesThisTick: number;
  marketsScanned: number;
  narrations?: TickNarration[];
  activeNodeIds?: string[];
  nodeOutputs?: Record<string, Record<string, any>>;
}

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

interface BacktestResult {
  strategyId: string;
  strategyName: string;
  config: { ticks: number; startingCapital: number; period: string };
  ticks: BacktestTick[];
  trades: BacktestTrade[];
  marketsUsed: { id: string; title: string; platform: string }[];
  metrics: BacktestMetrics;
}

interface Props {
  strategyId: string;
  nodes?: any[];
  connections?: any[];
  /** Called to highlight a node on the canvas during backtest (null = clear) */
  onNodeHighlight?: (nodeId: string | null) => void;
}

type Tab = "equity" | "trades" | "markets" | "log";
type Period = "1d" | "1w" | "2w" | "1m";
type Speed = "slow" | "normal" | "fast";

const SPEED_LABELS: Record<Speed, string> = {
  slow: "Slow (2s)",
  normal: "Normal",
  fast: "Fast",
};

const PERIOD_LABELS: Record<Period, string> = {
  "1d": "24 hours",
  "1w": "1 week",
  "2w": "2 weeks",
  "1m": "1 month",
};

function makeEmptyResult(strategyId: string, ticks: number, period: string, startingCapital: number): BacktestResult {
  return {
    strategyId,
    strategyName: "",
    config: { ticks, startingCapital, period },
    ticks: [],
    trades: [],
    marketsUsed: [],
    metrics: {
      totalReturn: 0, totalReturnPct: 0, totalTrades: 0,
      winningTrades: 0, losingTrades: 0, winRate: 0,
      sharpeRatio: 0, maxDrawdown: 0, maxDrawdownPct: 0,
      avgTradeReturn: 0, profitFactor: 0, finalEquity: startingCapital,
    },
  };
}

export function BacktestPanel({ strategyId, nodes: propNodes, connections: propConnections, onNodeHighlight }: Props) {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("equity");
  const [period, setPeriod] = useState<Period>("1w");
  const [ticks, setTicks] = useState(60);
  const [speed, setSpeed] = useState<Speed>("normal");
  const [streamPhase, setStreamPhase] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentNarration, setCurrentNarration] = useState<TickNarration | null>(null);
  const [currentTick, setCurrentTick] = useState(0);
  const [totalTicks, setTotalTicks] = useState(0);
  const [backtestDone, setBacktestDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const runBacktest = useCallback(async () => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setLoading(true);
    setError(null);
    setStreamPhase("Connecting...");
    setProgress(0);
    setCurrentNarration(null);
    setCurrentTick(0);
    setTotalTicks(ticks);
    setBacktestDone(false);
    setResult(makeEmptyResult(strategyId, ticks, period, 1000));
    setTab("equity");

    try {
      const res = await fetch(`/api/strategies/${strategyId}/backtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticks,
          startingCapital: 1000,
          period,
          speed,
          ...(propNodes && propNodes.length > 0 ? { nodes: propNodes, connections: propConnections } : {}),
        }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Backtest failed");
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!;

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: any;
          try { event = JSON.parse(line); } catch { continue; }

          if (event.type === "setup") {
            setStreamPhase(event.message);
          } else if (event.type === "node_start") {
            // Highlight this node on the canvas — tracks real execution
            onNodeHighlight?.(event.nodeId);
          } else if (event.type === "tick") {
            setResult(event.data);
            setProgress((event.tick + 1) / event.totalTicks);
            setStreamPhase(`Tick ${event.tick + 1} / ${event.totalTicks}`);
            setCurrentTick(event.tick);
            setTotalTicks(event.totalTicks);
            // Clear highlight between ticks
            onNodeHighlight?.(null);
            // Extract narration from the latest tick
            const latestTick = event.data?.ticks?.[event.data.ticks.length - 1];
            if (latestTick?.narrations?.length > 0) {
              const narrs = latestTick.narrations as TickNarration[];
              const best = narrs.find((n: TickNarration) => n.tradeAction)
                ?? narrs.reduce((a: TickNarration, b: TickNarration) =>
                  Math.abs(b.edgePct ?? 0) > Math.abs(a.edgePct ?? 0) ? b : a);
              setCurrentNarration(best);
            } else {
              setCurrentNarration(null);
            }
          } else if (event.type === "done") {
            setResult(event.data);
            setProgress(1);
            setBacktestDone(true);
            onNodeHighlight?.(null);
          } else if (event.type === "error") {
            setResult(null);
            throw new Error(event.error);
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : String(e));
      if (!result?.ticks?.length) setResult(null);
    } finally {
      setLoading(false);
      setStreamPhase(null);
      abortRef.current = null;
    }
  }, [strategyId, ticks, period, speed, propNodes, propConnections, onNodeHighlight]);

  // --- Launch UI ---
  if (!result && !loading) {
    return (
      <div className="flex flex-col items-center gap-5 py-6">
        <p className="text-sm font-medium text-edge-muted mb-2">
          Backtest with real Polymarket & Gemini prices
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <ConfigSelect
            label="Period"
            value={period}
            onChange={(v) => setPeriod(v as Period)}
            options={[
              { value: "1d", label: "1 day" },
              { value: "1w", label: "1 week" },
              { value: "2w", label: "2 weeks" },
              { value: "1m", label: "1 month" },
            ]}
          />
          <ConfigSelect
            label="Ticks"
            value={String(ticks)}
            onChange={(v) => setTicks(Number(v))}
            options={[
              { value: "30", label: "30" },
              { value: "60", label: "60" },
              { value: "90", label: "90" },
              { value: "120", label: "120" },
            ]}
          />
        </div>

        {/* Speed control */}
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-edge-muted mr-2">Speed</span>
          {(["slow", "normal", "fast"] as Speed[]).map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${speed === s
                ? "bg-white/10 text-white"
                : "text-edge-muted hover:text-edge-text hover:bg-white/5"
                }`}
            >
              {SPEED_LABELS[s]}
            </button>
          ))}
        </div>

        <button
          onClick={runBacktest}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg text-black bg-white hover:bg-white/90 transition-all duration-200"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Run Backtest
        </button>
        {error && <p className="text-accent-red text-xs mt-1">{error}</p>}
      </div>
    );
  }

  if (!result) return null;

  const { metrics, ticks: tickData, trades, marketsUsed } = result;
  const isPositive = metrics.totalReturn >= 0;

  // Chart data
  const chartData = tickData.map((t) => ({
    label: new Date(t.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
    }),
    equity: t.equity,
  }));

  // Build execution log entries from tick data
  const logEntries = tickData
    .filter((t) => t.narrations && t.narrations.length > 0)
    .map((t) => ({
      tick: t.tick,
      timestamp: t.timestamp,
      narrations: t.narrations!,
      tradesThisTick: t.tradesThisTick,
    }));

  // Compute average edge at entry for trades that had narrations
  const edgesAtEntry: number[] = [];
  for (const t of tickData) {
    if (t.tradesThisTick > 0 && t.narrations) {
      for (const n of t.narrations) {
        if (n.tradeAction && n.edgePct != null) edgesAtEntry.push(n.edgePct);
      }
    }
  }
  const avgEntryEdge = edgesAtEntry.length > 0
    ? edgesAtEntry.reduce((a, b) => a + b, 0) / edgesAtEntry.length
    : null;

  return (
    <div className="space-y-4">
      {/* Summary card — shown when backtest is complete */}
      {backtestDone && !loading && (
        <BacktestSummaryCard
          metrics={metrics}
          trades={trades}
          totalTicks={result.config.ticks}
          startingCapital={result.config.startingCapital}
          avgEntryEdge={avgEntryEdge}
        />
      )}

      {/* Live narration banner — shown during streaming */}
      {loading && progress > 0 && (
        <TickNarrationBanner
          tick={currentTick}
          totalTicks={totalTicks}
          narration={currentNarration}
        />
      )}

      {/* Streaming progress bar */}
      {loading && (
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin shrink-0" />
          <span className="text-[10px] text-edge-muted whitespace-nowrap">
            {streamPhase || "Running..."}
          </span>
          <div className="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden">
            <div
              className="h-full rounded-full bg-accent-cyan/50 transition-all duration-300 ease-out"
              style={{ width: `${Math.max(progress * 100, 2)}%` }}
            />
          </div>
          <span className="text-[10px] text-edge-dim font-mono tabular-nums">
            {Math.round(progress * 100)}%
          </span>
        </div>
      )}

      {/* Period & markets badge */}
      {!backtestDone && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-edge-muted px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
            {PERIOD_LABELS[result.config.period as Period] ?? result.config.period} · {result.config.ticks} ticks
          </span>
          <span className="text-xs text-edge-muted px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
            {marketsUsed.length} real market{marketsUsed.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Metrics bar — only when not showing summary card */}
      {!backtestDone && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          <MetricCard
            label="Total Return"
            value={`${isPositive ? "+" : ""}$${metrics.totalReturn.toFixed(2)}`}
            sub={`${isPositive ? "+" : ""}${metrics.totalReturnPct.toFixed(1)}%`}
            color={isPositive ? "green" : "red"}
          />
          <MetricCard
            label="Win Rate"
            value={`${metrics.winRate.toFixed(1)}%`}
            sub={`${metrics.winningTrades}W / ${metrics.losingTrades}L`}
            color={metrics.winRate >= 50 ? "green" : metrics.totalTrades === 0 ? "blue" : "amber"}
          />
          <MetricCard
            label="Sharpe Ratio"
            value={metrics.sharpeRatio.toFixed(2)}
            sub={metrics.sharpeRatio > 1 ? "Good" : metrics.sharpeRatio > 0.5 ? "Fair" : "Poor"}
            color={metrics.sharpeRatio > 1 ? "green" : metrics.sharpeRatio > 0 ? "amber" : "red"}
          />
          <MetricCard
            label="Max Drawdown"
            value={`$${metrics.maxDrawdown.toFixed(2)}`}
            sub={`${metrics.maxDrawdownPct.toFixed(1)}%`}
            color={metrics.maxDrawdownPct < 10 ? "green" : metrics.maxDrawdownPct < 25 ? "amber" : "red"}
          />
          <MetricCard
            label="Total Trades"
            value={String(metrics.totalTrades)}
            sub={`Avg $${(metrics.avgTradeReturn ?? 0).toFixed(2)}`}
            color="blue"
          />
          <MetricCard
            label="Profit Factor"
            value={metrics.profitFactor == null ? "N/A" : metrics.profitFactor === Infinity ? "∞" : metrics.profitFactor.toFixed(2)}
            sub={metrics.profitFactor == null ? "—" : metrics.profitFactor > 1.5 ? "Strong" : metrics.profitFactor > 1 ? "Positive" : "Negative"}
            color={metrics.profitFactor == null ? "gray" : metrics.profitFactor > 1.5 ? "green" : metrics.profitFactor > 1 ? "amber" : "red"}
          />
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex items-center gap-1">
        <TabButton active={tab === "equity"} onClick={() => setTab("equity")}>
          Equity Curve
        </TabButton>
        <TabButton active={tab === "trades"} onClick={() => setTab("trades")}>
          Trades ({trades.length})
        </TabButton>
        <TabButton active={tab === "log"} onClick={() => setTab("log")}>
          Execution Log ({logEntries.length})
        </TabButton>
        <TabButton active={tab === "markets"} onClick={() => setTab("markets")}>
          Markets ({marketsUsed.length})
        </TabButton>
        <div className="flex-1" />
        {!loading && (
          <button
            onClick={() => { setResult(null); setError(null); setBacktestDone(false); setCurrentNarration(null); }}
            className="text-xs font-medium text-edge-muted hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-white/5"
          >
            New run
          </button>
        )}
      </div>

      {/* Tab content */}
      {tab === "equity" && (
        <div className="h-56">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-edge-muted text-xs gap-2">
              {loading && (
                <div className="w-3.5 h-3.5 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" />
              )}
              {loading ? "Waiting for simulation data..." : "No trades were triggered — strategy gates may have blocked all signals."}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`eqGrad-${strategyId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isPositive ? "#34d399" : "#f87171"} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={isPositive ? "#34d399" : "#f87171"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "#6b7280" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#6b7280" }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(14, 16, 24, 0.95)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px",
                    fontSize: "11px",
                    color: "#eaeaf0",
                  }}
                  formatter={(value: unknown) => [`$${Number(value).toFixed(2)}`, "Equity"]}
                />
                <ReferenceLine
                  y={result.config.startingCapital}
                  stroke="rgba(255,255,255,0.1)"
                  strokeDasharray="4 4"
                />
                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke={isPositive ? "#34d399" : "#f87171"}
                  strokeWidth={1.5}
                  fill={`url(#eqGrad-${strategyId})`}
                  isAnimationActive={!loading}
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {tab === "trades" && (
        <div className="overflow-x-auto max-h-56 overflow-y-auto">
          {trades.length === 0 ? (
            <div className="text-center text-edge-muted text-xs py-8">
              {loading ? "Waiting for trades..." : "No trades triggered."}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0e1018] border-b border-edge-border/50">
                <tr>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-edge-muted">Date</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-edge-muted">Market</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-edge-muted">Platform</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-edge-muted">Dir</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-edge-muted">Entry</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-edge-muted">Exit</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-edge-muted">P&L</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-edge-muted">Exit</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                    <td className="py-2.5 px-3 text-edge-text whitespace-nowrap text-xs">
                      {new Date(trade.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="py-2.5 px-3 text-edge-text max-w-[160px] truncate text-xs" title={trade.eventTitle}>
                      {trade.eventTitle}
                    </td>
                    <td className="py-2.5 px-3 text-edge-text capitalize text-xs">
                      {trade.platform}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium ${trade.direction === "YES" ? "bg-accent-green/10 text-accent-green border border-accent-green/20" : "bg-accent-red/10 text-accent-red border border-accent-red/20"}`}>
                        {trade.direction}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-edge-text text-xs">
                      {trade.entryPrice.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-edge-text text-xs">
                      {trade.exitPrice.toFixed(3)}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-medium text-xs ${trade.pnl > 0 ? "text-accent-green" : trade.pnl < 0 ? "text-accent-red" : "text-edge-muted"}`}>
                      {trade.pnl > 0 ? "+" : ""}{trade.pnl.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium border ${trade.exitReason?.includes("take-profit") ? "bg-accent-green/10 text-accent-green border-accent-green/20"
                        : trade.exitReason?.includes("stop-loss") ? "bg-accent-red/10 text-accent-red border-accent-red/20"
                          : trade.status === "open" ? "bg-accent-blue/10 text-accent-blue border-accent-blue/20"
                            : "bg-white/5 text-edge-muted border-white/10"
                        }`}>
                        {trade.exitReason || trade.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "log" && (
        <ExecutionStepLog entries={logEntries} isStreaming={loading} />
      )}

      {tab === "markets" && (
        <div className="overflow-y-auto max-h-56 space-y-1.5">
          {marketsUsed.length === 0 ? (
            <div className="text-center text-edge-muted text-xs py-8">
              {loading ? "Discovering markets..." : "No markets discovered."}
            </div>
          ) : (
            marketsUsed.map((m, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.03]"
              >
                <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase tracking-widest ${m.platform === "polymarket" ? "bg-accent-purple/15 text-accent-purple" : "bg-accent-blue/15 text-accent-blue"}`}>
                  {m.platform}
                </span>
                <span className="text-[11px] text-edge-text truncate flex-1" title={m.title}>
                  {m.title}
                </span>
                <span className="text-[9px] text-edge-dim font-mono shrink-0" title={m.id}>
                  {m.id.slice(0, 12)}...
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const colorMap: Record<string, { text: string; bg: string; glow: string }> = {
  green: { text: "text-accent-green", bg: "rgba(52, 211, 153, 0.08)", glow: "0 0 8px rgba(52, 211, 153, 0.15)" },
  red: { text: "text-accent-red", bg: "rgba(248, 113, 113, 0.08)", glow: "0 0 8px rgba(248, 113, 113, 0.15)" },
  amber: { text: "text-accent-amber", bg: "rgba(251, 191, 36, 0.08)", glow: "none" },
  blue: { text: "text-accent-blue", bg: "rgba(129, 140, 248, 0.08)", glow: "none" },
};

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const c = colorMap[color] ?? colorMap.blue;
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: c.bg, boxShadow: c.glow, border: "1px solid rgba(255,255,255,0.03)" }}>
      <div className="text-[9px] uppercase tracking-widest text-edge-muted font-semibold mb-1">{label}</div>
      <div className={`text-sm font-mono font-semibold ${c.text}`}>{value}</div>
      <div className="text-[9px] text-edge-dim mt-0.5">{sub}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-widest transition-all ${active ? "bg-white/[0.06] text-accent-cyan" : "text-edge-muted hover:text-edge-text hover:bg-white/[0.02]"}`}
      style={active ? { border: "1px solid rgba(34, 211, 238, 0.15)", boxShadow: "0 0 8px rgba(34, 211, 238, 0.06)" } : { border: "1px solid transparent" }}
    >
      {children}
    </button>
  );
}

function ConfigSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[9px] uppercase tracking-widest text-edge-muted font-semibold">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs bg-white/[0.04] border border-white/[0.06] rounded-md px-2 py-1 text-edge-text focus:outline-none focus:border-accent-cyan/40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
