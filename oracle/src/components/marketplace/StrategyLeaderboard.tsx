"use client";

import { useEffect, useState, useMemo } from "react";
import { Strategy, StrategyPerformance } from "@/types";
import { PublicStrategyCard } from "./PublicStrategyCard";

type StrategyWithPerf = Strategy & { performance?: StrategyPerformance };
type SortKey = "sharpe" | "pnl" | "winRate" | "trades";

interface Props {
  onView: (strategy: StrategyWithPerf) => void;
  onClone: (strategy: StrategyWithPerf) => void;
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

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "pnl", label: "P&L" },
    { key: "sharpe", label: "Sharpe" },
    { key: "winRate", label: "Win Rate" },
    { key: "trades", label: "Trades" },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-edge-surface-2 animate-shimmer rounded-lg h-32"
          />
        ))}
      </div>
    );
  }

  if (strategies.length === 0) {
    return (
      <div className="text-center py-20 border border-dashed border-edge-border rounded-lg">
        <p className="text-edge-muted">
          No public strategies yet. Be the first to publish.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Search */}
        <input
          type="text"
          placeholder="Search strategies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 text-sm bg-edge-surface border border-edge-border rounded-md px-3 py-1.5 text-edge-text placeholder:text-edge-dim focus:outline-none focus:border-accent-blue/40 transition-colors"
        />

        {/* Sort */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-edge-muted mr-1">Sort:</span>
          {sortOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                sortBy === opt.key
                  ? "bg-accent-blue/10 text-accent-blue font-medium"
                  : "text-edge-muted hover:text-edge-text-2"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((s) => (
          <PublicStrategyCard
            key={s.id}
            strategy={s}
            onView={() => onView(s)}
            onClone={() => onClone(s)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10 text-edge-muted text-sm">
          No strategies match your search.
        </div>
      )}
    </div>
  );
}
