"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/Header";
import { PortfolioSummary } from "@/components/dashboard/PortfolioSummary";
import { StrategyCard } from "@/components/dashboard/StrategyCard";
import { useWallet } from "@/hooks/useWallet";
import { Strategy, StrategyPerformance, ExecutionLogEntry } from "@/types";

type StrategyWithPerf = Strategy & { performance?: StrategyPerformance };
type FilterTab = "active" | "inactive" | "all";

const FILTERS: { id: FilterTab; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
  { id: "all", label: "All" },
];

function FilterTabs({
  active,
  onChange,
  counts,
}: {
  active: FilterTab;
  onChange: (f: FilterTab) => void;
  counts: Record<FilterTab, number>;
}) {
  return (
    <div className="flex items-center gap-1 p-1 bg-edge-bg rounded-lg border border-edge-border">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onChange(f.id)}
          className={`relative flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${
            active === f.id ? "text-white" : "text-edge-muted hover:text-edge-text-2"
          }`}
        >
          {active === f.id && (
            <motion.div
              layoutId="filter-tab-bg"
              className="absolute inset-0 bg-edge-surface border border-edge-border rounded-md"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          <span className="relative z-10">{f.label}</span>
          <span
            className={`relative z-10 text-2xs font-mono px-1.5 py-0.5 rounded-full ${
              active === f.id ? "bg-white/10 text-white" : "bg-edge-border text-edge-muted"
            }`}
          >
            {counts[f.id]}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [strategies, setStrategies] = useState<StrategyWithPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("active");
  const [search, setSearch] = useState("");
  const [logs, setLogs] = useState<(ExecutionLogEntry & { strategyName: string })[]>([]);
  const wallet = useWallet();

  useEffect(() => {
    const headers: Record<string, string> = {};
    if (wallet.address) {
      headers["X-Wallet-Address"] = wallet.address;
    }
    fetch("/api/strategies", { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then(async (data) => {
        const list: StrategyWithPerf[] = Array.isArray(data) ? data : [];
        setStrategies(list);

        const allLogs: (ExecutionLogEntry & { strategyName: string })[] = [];
        for (const s of list.slice(0, 10)) {
          try {
            const r = await fetch(`/api/strategies/${s.id}/logs`);
            if (r.ok) {
              const sLogs: ExecutionLogEntry[] = await r.json();
              allLogs.push(
                ...sLogs.slice(0, 5).map((l) => ({ ...l, strategyName: s.name })),
              );
            }
          } catch {
            // skip
          }
        }
        allLogs.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
        setLogs(allLogs.slice(0, 20));
      })
      .catch(() => setStrategies([]))
      .finally(() => setLoading(false));
  }, [wallet.address]);

  const filtered = strategies.filter((s) => {
    const matchesSearch =
      !search || s.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && (s.status === "running" || s.status === "paused")) ||
      (filter === "inactive" && (s.status === "stopped" || s.status === "draft"));
    return matchesSearch && matchesFilter;
  });

  const counts: Record<FilterTab, number> = {
    active: strategies.filter((s) => s.status === "running" || s.status === "paused").length,
    inactive: strategies.filter((s) => s.status === "stopped" || s.status === "draft").length,
    all: strategies.length,
  };

  return (
    <div className="min-h-screen bg-edge-bg text-edge-text">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <LoadingSkeleton />
        ) : strategies.length === 0 ? (
          <EmptyState />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-6"
          >
            {/* Page header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h1 className="page-title">Dashboard</h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-2xs font-mono uppercase tracking-wider rounded-sm bg-white/[0.06] text-edge-muted">
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
                  </svg>
                  {strategies.length} strategies
                </span>
              </div>
              <Link
                href="/"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Strategy
              </Link>
            </div>

            {/* Stats Grid */}
            <PortfolioSummary strategies={strategies} />

            {/* Toolbar: Filter tabs + Search */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <FilterTabs active={filter} onChange={setFilter} counts={counts} />
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
                  className="w-full pl-9 pr-3 py-2 bg-edge-bg border border-edge-border rounded-lg text-sm text-edge-text placeholder:text-edge-dim focus:outline-none focus:border-edge-border-2 transition-colors"
                  placeholder="Search strategies..."
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Strategies Grid */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${filter}-${search}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-4"
              >
                {filtered.map((s) => (
                  <StrategyCard key={s.id} strategy={s} />
                ))}
              </motion.div>
            </AnimatePresence>

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-sm font-medium text-edge-text-2">No strategies match your filters</p>
                <p className="text-2xs text-edge-muted mt-1">Try a different search term or clear the filters.</p>
                <button
                  type="button"
                  onClick={() => { setSearch(""); setFilter("all"); }}
                  className="mt-4 px-4 py-2 rounded-lg bg-edge-surface border border-edge-border text-sm text-edge-text hover:text-white transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            )}

            {/* Autonomous Log */}
            {logs.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="section-header">Autonomous Log</h3>
                  <button className="text-2xs font-mono uppercase tracking-wider text-edge-muted hover:text-edge-text-2 transition-colors">
                    View All
                  </button>
                </div>
                <div className="bg-edge-surface border border-edge-border rounded-lg overflow-hidden">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-2xs font-mono font-normal uppercase tracking-wider text-edge-muted text-left">Time</th>
                        <th className="px-4 py-3 text-2xs font-mono font-normal uppercase tracking-wider text-edge-muted text-left">Strategy</th>
                        <th className="px-4 py-3 text-2xs font-mono font-normal uppercase tracking-wider text-edge-muted text-left">Action</th>
                        <th className="px-4 py-3 text-2xs font-mono font-normal uppercase tracking-wider text-edge-muted text-left">Details</th>
                        <th className="px-4 py-3 text-2xs font-mono font-normal uppercase tracking-wider text-edge-muted text-right">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr
                          key={log.id}
                          className="border-b border-edge-border hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-4 py-3 text-sm text-edge-text-2 font-mono">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-white font-medium">
                            {log.strategyName}
                          </td>
                          <td className="px-4 py-3">
                            {log.tradePlaced ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-2xs font-mono uppercase tracking-wider rounded-sm border border-accent-green/30 text-accent-green">
                                {log.tradeDetails?.direction ?? "Trade"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-2xs font-mono uppercase tracking-wider rounded-sm bg-white/[0.06] text-edge-muted">
                                Signal
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-edge-text-2 max-w-[200px] truncate">
                            {log.tradeDetails?.marketId ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {log.pnlDelta !== 0 ? (
                              <span className={`font-mono font-medium text-sm ${log.pnlDelta > 0 ? "text-accent-green" : "text-accent-red"}`}>
                                {log.pnlDelta > 0 ? "+" : ""}${Math.abs(log.pnlDelta).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-2xs text-edge-dim font-mono">
                                {log.tradePlaced ? "Executing..." : "Triggered"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-edge-surface border border-edge-border rounded-lg h-24 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass rounded-lg h-72 animate-pulse" style={{ animationDelay: `${i * 100 + 300}ms` }} />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-24"
    >
      <div className="text-edge-dim mb-3">
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-edge-text-2">No strategies yet</p>
      <p className="text-2xs text-edge-muted mt-1 text-center max-w-xs">
        Build your first autonomous trading strategy in the visual builder.
      </p>
      <Link
        href="/"
        className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Go to Builder
      </Link>
    </motion.div>
  );
}
