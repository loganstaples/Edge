"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { PortfolioSummary } from "@/components/dashboard/PortfolioSummary";
import { StrategyRow } from "@/components/dashboard/StrategyCard";
import { Strategy, StrategyPerformance } from "@/types";

type StrategyWithPerf = Strategy & { performance?: StrategyPerformance };

export default function DashboardPage() {
  const [strategies, setStrategies] = useState<StrategyWithPerf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/strategies")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list: StrategyWithPerf[] = Array.isArray(data) ? data : [];
        setStrategies(list);
      })
      .catch(() => setStrategies([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-edge-bg text-edge-text">
      <Header />

      <main className="max-w-7xl mx-auto px-5 py-8 space-y-6 animate-fade-in">
        {loading ? (
          <div className="space-y-6">
            <div
              className="rounded-xl h-20 animate-shimmer"
              style={{
                background: "linear-gradient(135deg, rgba(14, 16, 24, 0.8) 0%, rgba(20, 22, 32, 0.6) 100%)",
                border: "1px solid rgba(255, 255, 255, 0.04)",
              }}
            />
            <div
              className="rounded-xl h-48 animate-shimmer"
              style={{
                background: "linear-gradient(135deg, rgba(14, 16, 24, 0.8) 0%, rgba(20, 22, 32, 0.6) 100%)",
                border: "1px solid rgba(255, 255, 255, 0.04)",
              }}
            />
          </div>
        ) : strategies.length === 0 ? (
          <div
            className="relative text-center py-24 rounded-xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(14, 16, 24, 0.8) 0%, rgba(20, 22, 32, 0.6) 100%)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(129, 140, 248, 0.3), transparent)" }} />
            <p className="text-edge-muted mb-4">No strategies yet. Build your first one.</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg text-accent-blue transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, rgba(129, 140, 248, 0.1) 0%, rgba(129, 140, 248, 0.04) 100%)",
                border: "1px solid rgba(129, 140, 248, 0.25)",
              }}
            >
              Go to Builder
            </Link>
          </div>
        ) : (
          <>
            <PortfolioSummary strategies={strategies} />

            <div
              className="relative rounded-xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(14, 16, 24, 0.85) 0%, rgba(20, 22, 32, 0.65) 100%)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(255, 255, 255, 0.05)",
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, transparent 5%, rgba(129, 140, 248, 0.4) 30%, rgba(167, 139, 250, 0.5) 50%, rgba(129, 140, 248, 0.4) 70%, transparent 95%)" }} />

              {/* Table header */}
              <div className="flex items-center gap-4 px-4 py-3 relative">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] uppercase tracking-widest text-edge-muted font-semibold">Strategy</span>
                </div>
                <div className="shrink-0" style={{ width: "calc(2rem + 4.5rem)" }} />
                <div className="w-24 text-right shrink-0">
                  <span className="text-[10px] uppercase tracking-widest text-edge-muted font-semibold">P&L</span>
                </div>
                <div className="w-16 text-right shrink-0">
                  <span className="text-[10px] uppercase tracking-widest text-edge-muted font-semibold">Trades</span>
                </div>
                <div className="w-16 text-right shrink-0">
                  <span className="text-[10px] uppercase tracking-widest text-edge-muted font-semibold">Win %</span>
                </div>
                <div className="w-5 shrink-0" />
              </div>

              <div className="h-[1px] bg-white/[0.04]" />

              <div className="divide-y divide-white/[0.03]">
                {strategies.map((s) => (
                  <StrategyRow key={s.id} strategy={s} />
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
