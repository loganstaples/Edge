"use client";

import { motion } from "framer-motion";
import { Strategy, StrategyPerformance } from "@/types";

interface Props {
  strategy: Strategy & { performance?: StrategyPerformance };
  onView: () => void;
  onClone: () => void;
}

export function PublicStrategyCard({ strategy, onView, onClone }: Props) {
  const perf = strategy.performance;
  const pnl = perf?.totalPnl ?? 0;
  const pnlPositive = pnl >= 0;
  const winRate =
    perf && perf.totalTrades > 0
      ? ((perf.winningTrades / perf.totalTrades) * 100).toFixed(1)
      : "—";

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
    >
      <div className="glass relative overflow-hidden rounded-lg p-5 flex flex-col h-full hover:border-white/[0.08] transition-colors cursor-pointer">
        {/* Gradient top edge */}
        <div className="gradient-top-edge" />

        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-accent-blue/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-medium text-white truncate">{strategy.name}</h3>
              <p className="text-2xs font-mono text-edge-muted">
                by {strategy.authorName || "Anonymous"}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-2xs font-mono uppercase tracking-wider rounded-sm border border-accent-blue/30 text-accent-blue shrink-0">
            Public
          </span>
        </div>

        {/* Description */}
        {strategy.description && (
          <p className="text-2xs text-edge-muted mb-3 line-clamp-2">{strategy.description}</p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-4 text-2xs text-edge-dim mb-4">
          <span className="font-mono">{strategy.nodes.length} nodes</span>
          <span>{new Date(strategy.createdAt).toLocaleDateString()}</span>
        </div>

        {/* Stats Grid — HELIX-style internal blocks */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-edge-bg rounded-md px-3 py-2 text-center">
            <p className="text-2xs text-edge-muted">P&L</p>
            <p className={`text-lg font-mono font-light ${pnlPositive ? "text-accent-green" : "text-accent-red"}`}>
              {pnl !== 0 ? `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}` : "—"}
            </p>
          </div>
          <div className="bg-edge-bg rounded-md px-3 py-2 text-center">
            <p className="text-2xs text-edge-muted">Win Rate</p>
            <p className="text-lg font-mono font-light text-white">
              {winRate}{winRate !== "—" && "%"}
            </p>
          </div>
          <div className="bg-edge-bg rounded-md px-3 py-2 text-center">
            <p className="text-2xs text-edge-muted">Sharpe</p>
            <p className="text-lg font-mono font-light text-white">
              {perf?.sharpeRatio?.toFixed(2) ?? "—"}
            </p>
          </div>
        </div>

        {/* Actions — pinned to bottom */}
        <div className="flex items-center gap-3 pt-3 border-t border-edge-border/50 mt-auto">
          <button
            onClick={(e) => { e.preventDefault(); onView(); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Preview
          </button>
          <button
            onClick={(e) => { e.preventDefault(); onClone(); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-edge-surface border border-edge-border text-sm text-edge-text hover:border-edge-border-2 hover:text-white transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
            </svg>
            Clone
          </button>
          <span className="text-2xs text-edge-dim font-mono ml-auto">
            {perf?.totalTrades ?? 0} trades
          </span>
        </div>
      </div>
    </motion.div>
  );
}
