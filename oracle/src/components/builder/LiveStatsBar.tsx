"use client";

import { useMemo } from "react";

export interface LiveStats {
  totalPnl: number;
  balance: number;
  startingBalance: number;
  sharpeRatio: number;
  totalTrades: number;
  winRate: number;
  maxDrawdown: number;
  tickCount: number;
}

interface LiveStatsBarProps {
  stats: LiveStats;
  equityHistory: number[];
  isExecuting: boolean;
}

function formatMoney(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${v < 0 ? "-" : ""}$${(abs / 1000).toFixed(1)}k`;
  return `${v < 0 ? "-" : ""}$${abs.toFixed(2)}`;
}

function formatPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

/** Tiny inline SVG sparkline for equity curve */
function EquityChart({ data, isExecuting }: { data: number[]; isExecuting: boolean }) {
  const { path, areaPath, viewBox, min, max, lastY, pctChange: _pctChange } = useMemo(() => {
    if (data.length < 2) {
      return { path: "", areaPath: "", viewBox: "0 0 400 120", min: 0, max: 0, lastY: 60, pctChange: 0 };
    }

    const w = 400;
    const h = 120;
    const pad = 8;
    const mn = Math.min(...data);
    const mx = Math.max(...data);
    const range = mx - mn || 1;

    const points = data.map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (v - mn) / range) * (h - pad * 2);
      return { x, y };
    });

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx1 = prev.x + (curr.x - prev.x) * 0.4;
      const cpx2 = prev.x + (curr.x - prev.x) * 0.6;
      d += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    const last = points[points.length - 1];
    const areaD = `${d} L ${last.x} ${h} L ${points[0].x} ${h} Z`;

    const pct = data.length >= 2 ? ((data[data.length - 1] - data[0]) / data[0]) * 100 : 0;

    return { path: d, areaPath: areaD, viewBox: `0 0 ${w} ${h}`, min: mn, max: mx, lastY: last.y, pctChange: pct };
  }, [data]);

  const isPositive = data.length >= 2 && data[data.length - 1] >= data[0];
  const color = isPositive ? "#34d399" : "#f87171";

  return (
    <div className="relative w-full h-full">
      {/* Y-axis labels */}
      {data.length >= 2 && (
        <>
          <span className="absolute top-1 right-2 text-[9px] font-mono text-edge-muted/50">
            {formatMoney(max)}
          </span>
          <span className="absolute bottom-1 right-2 text-[9px] font-mono text-edge-muted/50">
            {formatMoney(min)}
          </span>
        </>
      )}

      {data.length < 2 ? (
        <div className="flex items-center justify-center h-full text-[11px] text-edge-muted/40">
          Waiting for data...
        </div>
      ) : (
        <svg viewBox={viewBox} className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.15" />
              <stop offset="100%" stopColor={color} stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {/* Area fill */}
          <path d={areaPath} fill="url(#equityFill)" />
          {/* Line */}
          <path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 4px ${color}80)` }}
          />
          {/* Current value dot */}
          {isExecuting && (
            <circle
              cx={8 + ((data.length - 1) / (data.length - 1)) * (400 - 16)}
              cy={lastY}
              r="4"
              fill={color}
              style={{ filter: `drop-shadow(0 0 6px ${color})` }}
            >
              <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
            </circle>
          )}
        </svg>
      )}
    </div>
  );
}

function StatItem({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] text-edge-muted/60 uppercase tracking-wider font-medium">{label}</span>
      <span className={`text-sm font-mono font-semibold tracking-tight ${color ?? "text-white"}`}>
        {value}
      </span>
      {sub && (
        <span className={`text-[9px] font-mono ${color ?? "text-edge-muted/50"}`}>{sub}</span>
      )}
    </div>
  );
}

export function LiveStatsBar({ stats, equityHistory, isExecuting }: LiveStatsBarProps) {
  const returnPct = stats.startingBalance > 0
    ? ((stats.balance - stats.startingBalance) / stats.startingBalance) * 100
    : 0;

  const pnlColor = stats.totalPnl >= 0 ? "text-accent-green" : "text-accent-red";

  return (
    <div className="flex gap-3 px-4 pt-3 pb-2 flex-shrink-0">
      {/* Stats card */}
      <div
        className="flex items-center gap-6 px-5 py-3.5 flex-shrink-0"
        style={{
          background: "rgba(10, 10, 12, 0.85)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.07)",
          borderRadius: "20px",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)",
          minWidth: "420px",
        }}
      >
        <StatItem
          label="Profit / Loss"
          value={`${stats.totalPnl >= 0 ? "+" : ""}${formatMoney(stats.totalPnl)}`}
          sub={formatPct(returnPct)}
          color={pnlColor}
        />

        <div className="w-px h-8 bg-white/[0.06]" />

        <StatItem
          label="Balance"
          value={formatMoney(stats.balance)}
        />

        <div className="w-px h-8 bg-white/[0.06]" />

        <StatItem
          label="Sharpe"
          value={stats.sharpeRatio.toFixed(2)}
          color={stats.sharpeRatio >= 1.5 ? "text-accent-green" : stats.sharpeRatio >= 0.5 ? "text-accent-amber" : "text-edge-muted"}
        />

        <div className="w-px h-8 bg-white/[0.06]" />

        <StatItem
          label="Win Rate"
          value={`${stats.winRate.toFixed(0)}%`}
          sub={`${stats.totalTrades} trades`}
        />

        <div className="w-px h-8 bg-white/[0.06]" />

        <StatItem
          label="Max DD"
          value={formatPct(-Math.abs(stats.maxDrawdown))}
          color="text-accent-red"
        />

        {/* Live indicator */}
        {isExecuting && (
          <>
            <div className="w-px h-8 bg-white/[0.06]" />
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green" />
              </span>
              <span className="text-[10px] font-medium text-accent-green uppercase tracking-wider">Live</span>
            </div>
          </>
        )}
      </div>

      {/* Equity chart card */}
      <div
        className="flex-1 min-w-0"
        style={{
          background: "rgba(10, 10, 12, 0.85)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.07)",
          borderRadius: "20px",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)",
          minHeight: "90px",
        }}
      >
        <div className="flex items-center justify-between px-4 pt-2.5">
          <span className="text-[9px] text-edge-muted/60 uppercase tracking-wider font-medium">Balance Over Time</span>
          {equityHistory.length >= 2 && (
            <span className={`text-[10px] font-mono font-medium ${
              equityHistory[equityHistory.length - 1] >= equityHistory[0] ? "text-accent-green" : "text-accent-red"
            }`}>
              {formatPct(
                ((equityHistory[equityHistory.length - 1] - equityHistory[0]) / equityHistory[0]) * 100
              )}
            </span>
          )}
        </div>
        <div className="px-2 pb-1.5" style={{ height: "calc(100% - 28px)" }}>
          <EquityChart data={equityHistory} isExecuting={isExecuting} />
        </div>
      </div>
    </div>
  );
}
