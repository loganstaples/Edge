"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/Header";
import { MarketplaceStrategyCard } from "@/components/marketplace/MarketplaceStrategyCard";
import { StrategyDetailModal } from "@/components/marketplace/StrategyDetailModal";
import {
  STRATEGIES,
  CATEGORIES,
  SORT_OPTIONS,
  type MarketplaceStrategy,
  type StrategyCategory,
  type SortOption,
} from "@/lib/marketplace-data";

// ============================================================================
// Category Filter Tabs
// ============================================================================

function CategoryTabs({
  active,
  onChange,
}: {
  active: StrategyCategory;
  onChange: (c: StrategyCategory) => void;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => onChange(cat)}
          className={`relative px-3 py-1.5 rounded-lg text-sm transition-all cursor-pointer ${
            active === cat
              ? "text-white bg-white/[0.08] border border-white/[0.12]"
              : "text-edge-muted hover:text-edge-text-2 border border-transparent hover:border-edge-border"
          }`}
        >
          {active === cat && (
            <motion.div
              layoutId="cat-tab-bg"
              className="absolute inset-0 bg-white/[0.06] border border-white/[0.1] rounded-lg"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          <span className="relative z-10">{cat}</span>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Sort Dropdown
// ============================================================================

function SortDropdown({
  value,
  onChange,
}: {
  value: SortOption;
  onChange: (s: SortOption) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="appearance-none pl-3 pr-8 py-2 bg-edge-bg border border-edge-border rounded-lg text-sm text-edge-text cursor-pointer hover:border-edge-border-2 transition-colors focus:outline-none focus:border-edge-border-2"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-edge-muted pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
      </svg>
    </div>
  );
}

// ============================================================================
// Main Marketplace Page
// ============================================================================

export default function MarketplacePage() {
  const router = useRouter();
  const [category, setCategory] = useState<StrategyCategory>("All");
  const [sortBy, setSortBy] = useState<SortOption>("top-performing");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<MarketplaceStrategy | null>(null);

  // ── Filter + Sort ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...STRATEGIES];

    // Category filter
    if (category !== "All") {
      list = list.filter((s) => s.category === category);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.creator.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q),
      );
    }

    // Sort
    switch (sortBy) {
      case "top-performing":
        list.sort((a, b) => b.totalReturn - a.totalReturn);
        break;
      case "most-cloned":
        list.sort((a, b) => b.clones - a.clones);
        break;
      case "newest":
        // Approximate from publishedAgo — for seed data, lower index = more recent
        break;
      case "highest-win-rate":
        list.sort((a, b) => b.winRate - a.winRate);
        break;
    }

    return list;
  }, [category, sortBy, search]);

  // ── Clone handler ─────────────────────────────────────────────────────
  function handleClone(strategy: MarketplaceStrategy) {
    // Navigate to builder — in a real app this would POST to clone API
    router.push(`/?clone=${strategy.id}`);
  }

  return (
    <div className="min-h-screen bg-edge-bg text-edge-text">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="space-y-6"
        >
          {/* ── Page Header ──────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Strategy Marketplace
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-2xs font-mono uppercase tracking-wider rounded-md bg-accent-green/10 text-accent-green border border-accent-green/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-40" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-green" />
                </span>
                Live
              </span>
            </div>
            <p className="text-sm text-edge-muted max-w-2xl">
              Discover, clone, and deploy proven trading strategies built by the
              community. The best strategies rise to the top.
            </p>
          </div>

          {/* ── Search + Sort row ────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            {/* Search */}
            <div className="relative w-full sm:w-80">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-edge-dim"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search strategies, creators, markets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-edge-bg border border-edge-border rounded-xl text-sm text-edge-text placeholder:text-edge-dim focus:outline-none focus:border-edge-border-2 transition-colors"
              />
            </div>

            {/* Sort dropdown */}
            <SortDropdown value={sortBy} onChange={setSortBy} />
          </div>

          {/* ── Category Tabs ────────────────────────────────────── */}
          <CategoryTabs active={category} onChange={setCategory} />

          {/* ── Results count ─────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <p className="text-2xs text-edge-muted">
              {filtered.length} strateg{filtered.length === 1 ? "y" : "ies"}
              {category !== "All" && ` in ${category}`}
            </p>
          </div>

          {/* ── Strategy Grid ────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${category}-${sortBy}-${search}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {filtered.map((strategy, i) => (
                <MarketplaceStrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  index={i}
                  onView={() => setViewing(strategy)}
                  onClone={() => handleClone(strategy)}
                />
              ))}
            </motion.div>
          </AnimatePresence>

          {/* ── Empty state ───────────────────────────────────────── */}
          {filtered.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-edge-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-edge-text-2">
                No strategies found
              </p>
              <p className="text-2xs text-edge-muted mt-1 text-center max-w-xs">
                Try a different search term or category filter.
              </p>
              {(search || category !== "All") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setCategory("All");
                  }}
                  className="mt-4 px-4 py-2 rounded-lg bg-edge-surface border border-edge-border text-sm text-edge-text hover:text-white transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </motion.div>
          )}
        </motion.div>
      </main>

      {/* ── Detail Modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {viewing && (
          <StrategyDetailModal
            strategy={viewing}
            onClose={() => setViewing(null)}
            onClone={() => {
              handleClone(viewing);
              setViewing(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
