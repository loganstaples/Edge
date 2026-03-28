"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { MarketplaceStrategy } from "@/lib/marketplace-data";

// ── Category color map ──────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Crypto: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  Politics: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  Economics: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
  Sports: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" },
  "Multi-Market": { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  Arbitrage: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
};

// ── Creator avatar ──────────────────────────────────────────────────────
function CreatorAvatar({ initials }: { initials: string }) {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-blue/60 to-accent-purple/60 flex items-center justify-center text-[11px] font-bold text-white uppercase shrink-0">
      {initials}
    </div>
  );
}

// ── Custom Recharts tooltip ─────────────────────────────────────────────
function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-edge-surface border border-edge-border rounded-lg px-3 py-1.5 shadow-xl">
      <p className="text-xs font-mono text-white">${payload[0].value.toFixed(2)}</p>
    </div>
  );
}

// ── Props ───────────────────────────────────────────────────────────────
interface Props {
  strategy: MarketplaceStrategy;
  onClose: () => void;
  onClone: () => void;
}

export function StrategyDetailModal({ strategy, onClose, onClone }: Props) {
  const catColor = CATEGORY_COLORS[strategy.category] ?? {
    bg: "bg-white/5",
    text: "text-edge-text-2",
    border: "border-white/10",
  };
  const returnPositive = strategy.totalReturn >= 0;

  // Escape key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Chart data
  const chartData = strategy.equityCurve.map((val, i) => ({
    day: i,
    value: val,
  }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-edge-surface border border-edge-border rounded-2xl shadow-2xl"
      >
        {/* Gradient top edge */}
        <div className="absolute top-0 left-0 right-0 h-px z-20 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-edge-surface/95 backdrop-blur-sm border-b border-edge-border">
          <div className="flex items-center gap-3">
            <CreatorAvatar initials={strategy.creatorAvatar} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white tracking-tight">
                  {strategy.name}
                </h2>
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded border ${catColor.bg} ${catColor.text} ${catColor.border}`}
                >
                  {strategy.category}
                </span>
                {strategy.nftVerified && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-accent-green/10 text-accent-green border border-accent-green/20">
                    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    On-Chain
                  </span>
                )}
              </div>
              <p className="text-2xs text-edge-muted font-mono">
                by {strategy.creator} · {strategy.publishedAgo} · {strategy.clones} clones
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-edge-muted hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* ── Description ──────────────────────────────────────── */}
          <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-2">Strategy Overview</h3>
            <p className="text-sm text-edge-text-2 leading-relaxed">
              {strategy.description}
            </p>
          </div>

          {/* ── Equity Curve ─────────────────────────────────────── */}
          <div className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white">Equity Curve</h3>
              <p
                className={`text-lg font-mono font-semibold ${
                  returnPositive ? "text-accent-green" : "text-accent-red"
                }`}
              >
                {returnPositive ? "+" : ""}
                {strategy.totalReturn.toFixed(1)}%
              </p>
            </div>
            <div className="h-48 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id={`grad-${strategy.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={returnPositive ? "#34d399" : "#f87171"}
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="100%"
                        stopColor={returnPositive ? "#34d399" : "#f87171"}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" hide />
                  <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={returnPositive ? "#34d399" : "#f87171"}
                    strokeWidth={2}
                    fill={`url(#grad-${strategy.id})`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Stats Grid ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: "Total Return", value: `${returnPositive ? "+" : ""}${strategy.totalReturn.toFixed(1)}%`, color: returnPositive ? "text-accent-green" : "text-accent-red" },
              { label: "Win Rate", value: `${strategy.winRate}%`, color: "text-white" },
              { label: "Total Trades", value: `${strategy.totalTrades}`, color: "text-white" },
              { label: "Avg Edge", value: `${strategy.avgEdge}%`, color: "text-white" },
              { label: "Sharpe Ratio", value: strategy.sharpeRatio.toFixed(2), color: "text-white" },
              { label: "Max Drawdown", value: `-${strategy.maxDrawdown}%`, color: "text-accent-red" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="glass rounded-xl px-4 py-3 text-center"
              >
                <p className="text-[10px] text-edge-dim uppercase tracking-wider mb-1">
                  {stat.label}
                </p>
                <p className={`text-xl font-mono font-semibold ${stat.color}`}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* ── Node Pipeline ────────────────────────────────────── */}
          <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-3">
              Strategy Pipeline
              <span className="text-edge-muted font-normal ml-2">
                {strategy.nodeCount} nodes
              </span>
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              {strategy.nodePipeline.map((node, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="px-2.5 py-1 text-2xs font-mono rounded-md bg-edge-bg border border-edge-border text-edge-text-2">
                    {node}
                  </span>
                  {i < strategy.nodePipeline.length - 1 && (
                    <svg className="w-3 h-3 text-edge-dim shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── NFT Verification (if applicable) ─────────────────── */}
          {strategy.nftVerified && (
            <div className="glass rounded-xl p-4 border-accent-green/20">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-accent-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                <h3 className="text-sm font-medium text-accent-green">NFT Verified Strategy</h3>
              </div>
              <div className="space-y-1.5 text-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-edge-muted">NFT Contract</span>
                  <code className="font-mono text-edge-text-2">
                    0x7a3f...e4b2
                  </code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-edge-muted">Storage</span>
                  <span className="flex items-center gap-1 text-accent-green font-medium">
                    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Encrypted on 0g Storage
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Clone CTA ────────────────────────────────────────── */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onClone}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-accent-blue text-white text-sm font-semibold hover:bg-accent-blue/80 transition-colors cursor-pointer shadow-lg shadow-accent-blue/25"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
              </svg>
              Clone Strategy
            </button>
            <button
              onClick={onClose}
              className="px-5 py-3 rounded-xl bg-edge-surface-2 border border-edge-border text-sm text-edge-text-2 hover:text-white hover:border-edge-border-2 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
