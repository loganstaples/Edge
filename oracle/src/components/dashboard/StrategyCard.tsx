"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Strategy, StrategyPerformance } from "@/types";

interface Props {
  strategy: Strategy & { performance?: StrategyPerformance };
}

const statusConfig: Record<
  string,
  { dotColor: string; pulse: boolean; label: string; badgeClass: string }
> = {
  running: {
    dotColor: "bg-emerald-500",
    pulse: false,
    label: "Running",
    badgeClass: "text-emerald-500 border-emerald-500/20",
  },
  paused: {
    dotColor: "bg-amber-500",
    pulse: false,
    label: "Paused",
    badgeClass: "text-amber-500 border-amber-500/20",
  },
  stopped: {
    dotColor: "bg-edge-muted",
    pulse: false,
    label: "Stopped",
    badgeClass: "text-edge-muted border-edge-border",
  },
  draft: {
    dotColor: "bg-edge-dim",
    pulse: false,
    label: "Draft",
    badgeClass: "text-edge-dim border-edge-border",
  },
};



export function StrategyCard({ strategy }: Props) {
  const perf = strategy.performance;
  const status = statusConfig[strategy.status] ?? statusConfig.draft;
  const pnl = perf?.totalPnl ?? 0;
  const pnlPositive = pnl >= 0;
  const decidedTrades = perf?.totalTrades ?? 0;
  const winRate =
    perf && decidedTrades > 0
      ? ((perf.winningTrades / decidedTrades) * 100).toFixed(1)
      : "--";
  const sharpe = perf?.sharpeRatio?.toFixed(2) ?? "--";

  const isStopped = strategy.status === "stopped" || strategy.status === "draft";

  return (
    <Link href={`/dashboard/strategy/${strategy.id}`} className="block h-full">
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15 }}
        className={isStopped ? "opacity-60 hover:opacity-100 transition-opacity" : ""}
      >
        <div className="glass relative overflow-hidden rounded-lg p-5 flex flex-col h-full hover:border-white/[0.08] transition-colors cursor-pointer">
          {/* Gradient top edge */}
          <div className="gradient-top-edge" />

          {/* Header: Name + Status Badge */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-medium text-white truncate">{strategy.name}</h3>
                <div className="flex items-center gap-2">
                  {strategy.nftMint && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-400 bg-violet-400/10 px-2 py-0.5 rounded-md">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      NFT
                    </span>
                  )}
                  <p className="text-xs font-medium text-edge-muted">
                    {strategy.authorName !== "anonymous" ? strategy.authorName : strategy.ownerWallet ? `${strategy.ownerWallet.slice(0, 4)}...${strategy.ownerWallet.slice(-4)}` : "anonymous"}
                  </p>
                </div>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border shrink-0 ${status.badgeClass}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dotColor}`} />
              {status.label}
            </span>
          </div>

          {/* Description */}
          {strategy.description && (
            <p className="text-sm text-edge-muted mb-6 flex-1 line-clamp-2 leading-relaxed">{strategy.description}</p>
          )}

          {/* Stats Grid */}
          <div className="flex items-center justify-between mb-6 pt-3 border-t border-edge-border/30">
            <div>
              <p className="text-xs font-medium text-edge-muted mb-1">Weekly P&L</p>
              <p className={`text-base font-semibold ${pnlPositive ? "text-emerald-400" : "text-rose-400"}`}>
                {pnlPositive ? "+" : ""}{pnl.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-edge-muted mb-1">Win Rate</p>
              <p className="text-base font-semibold text-white">
                {winRate}{winRate !== "--" && "%"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-edge-muted mb-1">Sharpe</p>
              <p className="text-base font-semibold text-white">{sharpe}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 pt-3 border-t border-edge-border/50 mt-auto">
            <span className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black text-sm font-medium">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              View Strategy
            </span>
            <span className="text-sm font-medium text-edge-dim">
              {perf?.totalTrades ?? 0} trades
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export { StrategyCard as StrategyRow };
