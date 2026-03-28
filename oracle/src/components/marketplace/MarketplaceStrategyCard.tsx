"use client";

import { motion } from "framer-motion";
import { Sparkline } from "@/components/Sparkline";
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

// ── Creator avatar (deterministic gradient) ─────────────────────────────
function CreatorAvatar({ initials }: { initials: string }) {
  return (
    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent-blue/60 to-accent-purple/60 flex items-center justify-center text-[9px] font-bold text-white uppercase shrink-0">
      {initials}
    </div>
  );
}

// ── NFT Verified badge ──────────────────────────────────────────────────
function NftBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-accent-green/10 text-accent-green border border-accent-green/20">
      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      On-Chain
    </span>
  );
}

// ── Props ───────────────────────────────────────────────────────────────
interface Props {
  strategy: MarketplaceStrategy;
  index: number;
  onView: () => void;
  onClone: () => void;
}

export function MarketplaceStrategyCard({ strategy, index, onView, onClone }: Props) {
  const catColor = CATEGORY_COLORS[strategy.category] ?? {
    bg: "bg-white/5",
    text: "text-edge-text-2",
    border: "border-white/10",
  };
  const returnPositive = strategy.totalReturn >= 0;
  const sparkColor = returnPositive ? "#34d399" : "#f87171";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      whileHover={{ y: -3 }}
    >
      <div
        onClick={onView}
        className="glass relative overflow-hidden rounded-xl p-5 flex flex-col h-full hover:border-white/[0.1] transition-all duration-200 cursor-pointer group"
      >
        {/* Gradient top edge */}
        <div className="gradient-top-edge" />

        {/* ── Row 1: Name + Category + NFT ──────────────────────── */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-white truncate tracking-tight">
              {strategy.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <CreatorAvatar initials={strategy.creatorAvatar} />
              <span className="text-2xs font-mono text-edge-muted truncate">
                {strategy.creator}
              </span>
              <span className="text-edge-dim text-2xs">·</span>
              <span className="text-2xs text-edge-dim">{strategy.publishedAgo}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {strategy.nftVerified && <NftBadge />}
            <span
              className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded border ${catColor.bg} ${catColor.text} ${catColor.border}`}
            >
              {strategy.category}
            </span>
          </div>
        </div>

        {/* ── Description ───────────────────────────────────────── */}
        <p className="text-2xs text-edge-muted leading-relaxed mb-3 line-clamp-2">
          {strategy.description}
        </p>

        {/* ── Hero metric: Total Return + Sparkline ─────────────── */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-2xs text-edge-muted uppercase tracking-wider mb-0.5">Total Return</p>
            <p
              className={`text-2xl font-mono font-semibold tracking-tight ${
                returnPositive ? "text-accent-green" : "text-accent-red"
              }`}
            >
              {returnPositive ? "+" : ""}
              {strategy.totalReturn.toFixed(1)}%
            </p>
          </div>
          <div className={returnPositive ? "sparkline-svg" : "sparkline-svg-red"}>
            <Sparkline
              data={strategy.equityCurve}
              width={100}
              height={32}
              color={sparkColor}
            />
          </div>
        </div>

        {/* ── Stats grid ────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-edge-bg/80 rounded-lg px-2.5 py-2 text-center">
            <p className="text-[10px] text-edge-dim uppercase tracking-wider">Win Rate</p>
            <p className="text-sm font-mono font-medium text-white mt-0.5">
              {strategy.winRate}%
            </p>
          </div>
          <div className="bg-edge-bg/80 rounded-lg px-2.5 py-2 text-center">
            <p className="text-[10px] text-edge-dim uppercase tracking-wider">Trades</p>
            <p className="text-sm font-mono font-medium text-white mt-0.5">
              {strategy.totalTrades}
            </p>
          </div>
          <div className="bg-edge-bg/80 rounded-lg px-2.5 py-2 text-center">
            <p className="text-[10px] text-edge-dim uppercase tracking-wider">Avg Edge</p>
            <p className="text-sm font-mono font-medium text-white mt-0.5">
              {strategy.avgEdge}%
            </p>
          </div>
        </div>

        {/* ── Footer: meta + clone ──────────────────────────────── */}
        <div className="flex items-center justify-between pt-3 border-t border-edge-border/50 mt-auto">
          <div className="flex items-center gap-3 text-2xs text-edge-dim">
            <span className="flex items-center gap-1 font-mono">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" />
              </svg>
              {strategy.nodeCount} nodes
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
              </svg>
              {strategy.clones} clones
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClone();
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent-blue text-white text-xs font-medium hover:bg-accent-blue/80 transition-colors cursor-pointer shadow-lg shadow-accent-blue/20 hover:shadow-accent-blue/30"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
            </svg>
            Clone
          </button>
        </div>
      </div>
    </motion.div>
  );
}
