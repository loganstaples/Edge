"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Strategy, StrategyPerformance } from "@/types";
import { PublicStrategyCard } from "./PublicStrategyCard";

type StrategyWithPerf = Strategy & { performance?: StrategyPerformance };
type SortKey = "sharpe" | "pnl" | "winRate" | "trades";

interface Props {
  onView: (strategy: StrategyWithPerf) => void;
  onClone: (strategy: StrategyWithPerf) => void;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "pnl", label: "P&L" },
  { key: "sharpe", label: "Sharpe" },
  { key: "winRate", label: "Win Rate" },
  { key: "trades", label: "Trades" },
];

function SortTabs({ active, onChange }: { active: SortKey; onChange: (k: SortKey) => void }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-edge-bg rounded-lg border border-edge-border">
      {SORT_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={`relative flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all cursor-pointer ${
            active === opt.key ? "text-white" : "text-edge-muted hover:text-edge-text-2"
          }`}
        >
          {active === opt.key && (
            <motion.div
              layoutId="sort-tab-bg"
              className="absolute inset-0 bg-edge-surface border border-edge-border rounded-md"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          <span className="relative z-10">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

export function StrategyLeaderboard({ onView, onClone }: Props) {
  const [strategies, setStrategies] = useState<StrategyWithPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>("pnl");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/marketplace")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setStrategies(Array.isArray(data) ? data : []))
      .catch(() => setStrategies([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = strategies;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.authorName?.toLowerCase().includes(q),
      );
    }

    list = [...list].sort((a, b) => {
      const ap = a.performance;
      const bp = b.performance;
      switch (sortBy) {
        case "sharpe":
          return (bp?.sharpeRatio ?? 0) - (ap?.sharpeRatio ?? 0);
        case "pnl":
          return (bp?.totalPnl ?? 0) - (ap?.totalPnl ?? 0);
        case "winRate": {
          const awr =
            ap && ap.totalTrades > 0 ? ap.winningTrades / ap.totalTrades : 0;
          const bwr =
            bp && bp.totalTrades > 0 ? bp.winningTrades / bp.totalTrades : 0;
          return bwr - awr;
        }
        case "trades":
          return (bp?.totalTrades ?? 0) - (ap?.totalTrades ?? 0);
        default:
          return 0;
      }
    });

    return list;
  }, [strategies, sortBy, search]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="bg-edge-surface border border-edge-border rounded-lg h-10 w-64 animate-pulse" />
          <div className="bg-edge-surface border border-edge-border rounded-lg h-10 w-48 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass rounded-lg h-64 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  if (strategies.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center justify-center py-16"
      >
        <div className="text-edge-dim mb-3">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
          </svg>
        </div>
        <p className="text-sm font-medium text-edge-text-2">No public strategies yet</p>
        <p className="text-2xs text-edge-muted mt-1 text-center max-w-xs">
          Be the first to publish a strategy to the marketplace.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <SortTabs active={sortBy} onChange={setSortBy} />
        <div className="relative w-full sm:w-72">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-edge-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search strategies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-edge-bg border border-edge-border rounded-lg text-sm text-edge-text placeholder:text-edge-dim focus:outline-none focus:border-edge-border-2 transition-colors"
          />
        </div>
      </div>

      {/* Grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${sortBy}-${search}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          {filtered.map((s) => (
            <PublicStrategyCard
              key={s.id}
              strategy={s}
              onView={() => onView(s)}
              onClone={() => onClone(s)}
            />
          ))}
        </motion.div>
      </AnimatePresence>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-sm font-medium text-edge-text-2">No strategies match your search</p>
          <p className="text-2xs text-edge-muted mt-1">Try a different search term.</p>
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="mt-4 px-4 py-2 rounded-lg bg-edge-surface border border-edge-border text-sm text-edge-text hover:text-white transition-colors"
            >
              Clear Search
            </button>
          )}
        </div>
      )}
    </div>
  );
}
