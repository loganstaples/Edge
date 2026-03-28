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
    dotColor: "bg-accent-green",
    pulse: true,
    label: "Running",
    badgeClass: "text-accent-green border-accent-green/30",
  },
  paused: {
    dotColor: "bg-accent-amber",
    pulse: false,
    label: "Paused",
    badgeClass: "text-accent-amber border-accent-amber/30",
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

function sparklinePath(id: string, positive: boolean): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash);
  const points: number[] = [];
  for (let i = 0; i < 10; i++) {
    const v = ((seed * (i + 1) * 7919) % 100) / 100;
    points.push(positive ? 48 - v * 36 : 12 + v * 44);
  }
  const step = 240 / (points.length - 1);
  return points
    .map((y, i) => (i === 0 ? `M0 ${y}` : `L ${i * step} ${y}`))
    .join(" ");
}

export function StrategyCard({ strategy }: Props) {
  const perf = strategy.performance;
  const status = statusConfig[strategy.status] ?? statusConfig.draft;
  const pnl = perf?.totalPnl ?? 0;
  const pnlPositive = pnl >= 0;
  const winRate =
    perf && perf.totalTrades > 0
      ? ((perf.winningTrades / perf.totalTrades) * 100).toFixed(1)
      : "--";
  const sharpe = perf?.sharpeRatio?.toFixed(2) ?? "--";

  const isStopped = strategy.status === "stopped" || strategy.status === "draft";
  const sparkline = sparklinePath(strategy.id, pnlPositive);
  const strokeColor = pnlPositive ? "#34d399" : "#f87171";
  const fillId = `fill-${strategy.id.replace(/[^a-zA-Z0-9]/g, "")}`;

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
                    <span className="inline-flex items-center gap-1 text-2xs font-mono text-violet-400">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      NFT
                    </span>
                  )}
                  <p className="text-2xs font-mono text-edge-muted">
                    {strategy.authorName !== "anonymous" ? strategy.authorName : strategy.ownerWallet ? `${strategy.ownerWallet.slice(0, 4)}...${strategy.ownerWallet.slice(-4)}` : "anonymous"}
                  </p>
                </div>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-2xs font-mono uppercase tracking-wider rounded-sm border shrink-0 ${status.badgeClass}`}>
              {status.pulse && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-green" />
                </span>
              )}
              {status.label}
            </span>
          </div>

          {/* Description */}
          {strategy.description && (
            <p className="text-2xs text-edge-muted mb-3 line-clamp-2">{strategy.description}</p>
          )}

          {/* Sparkline */}
          <div className="h-14 w-full mb-4 rounded-md overflow-hidden bg-edge-bg/50">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 240 56">
              {isStopped ? (
                <path d="M0 28 L 240 28" fill="none" stroke="#3a3f55" strokeWidth={1} strokeDasharray="4 4" />
              ) : (
                <>
                  <defs>
                    <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={strokeColor} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <path d={`${sparkline} L 240 56 L 0 56 Z`} fill={`url(#${fillId})`} />
                  <path
                    d={sparkline}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={1.5}
                    className={pnlPositive ? "sparkline-svg" : "sparkline-svg-red"}
                  />
                </>
              )}
            </svg>
          </div>

          {/* Stats Grid — HELIX-style internal blocks */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-edge-bg rounded-md px-3 py-2 text-center">
              <p className="text-2xs text-edge-muted">P&L</p>
              <p className={`text-lg font-mono font-light ${pnlPositive ? "text-accent-green" : "text-accent-red"}`}>
                {pnlPositive ? "+" : ""}${pnl.toFixed(2)}
              </p>
            </div>
            <div className="bg-edge-bg rounded-md px-3 py-2 text-center">
              <p className="text-2xs text-edge-muted">Win Rate</p>
              <p className="text-lg font-mono font-light text-white">
                {winRate}{winRate !== "--" && "%"}
              </p>
            </div>
            <div className="bg-edge-bg rounded-md px-3 py-2 text-center">
              <p className="text-2xs text-edge-muted">Sharpe</p>
              <p className="text-lg font-mono font-light text-white">{sharpe}</p>
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
            <span className="text-2xs text-edge-dim font-mono">
              {perf?.totalTrades ?? 0} trades
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export { StrategyCard as StrategyRow };
