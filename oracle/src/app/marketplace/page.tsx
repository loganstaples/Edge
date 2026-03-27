"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { StrategyLeaderboard } from "@/components/marketplace/StrategyLeaderboard";
import { StrategyPreview } from "@/components/marketplace/StrategyPreview";
import { Strategy, StrategyPerformance } from "@/types";

type StrategyWithPerf = Strategy & { performance?: StrategyPerformance };

export default function MarketplacePage() {
  const router = useRouter();
  const [previewing, setPreviewing] = useState<StrategyWithPerf | null>(null);

  async function handleClone(strategy: StrategyWithPerf) {
    try {
      const res = await fetch(`/api/marketplace/${strategy.id}/clone`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        const newId = data.id ?? data.strategyId;
        router.push(`/?id=${newId}`);
      }
    } catch {
      // silently fail
    }
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
          {/* Page header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="page-title">Marketplace</h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-2xs font-mono uppercase tracking-wider rounded-sm bg-white/[0.06] text-edge-muted">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
                Public Registry
              </span>
            </div>
          </div>

          <p className="text-sm text-edge-muted -mt-2">
            Discover, preview, and clone public strategies from the community.
          </p>

          <StrategyLeaderboard
            onView={(s) => setPreviewing(s)}
            onClone={handleClone}
          />
        </motion.div>
      </main>

      {/* Preview modal */}
      {previewing && (
        <StrategyPreview
          strategy={previewing}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  );
}
