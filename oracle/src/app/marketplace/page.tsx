"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
      // silently fail — could add toast later
    }
  }

  return (
    <div className="min-h-screen bg-edge-bg text-edge-text">
      <Header />

      <main className="max-w-7xl mx-auto px-5 py-8 space-y-8">
        {/* Page title */}
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Marketplace</h2>
          <p className="text-sm text-edge-muted mt-1">
            Discover, preview, and clone public strategies.
          </p>
        </div>

        <StrategyLeaderboard
          onView={(s) => setPreviewing(s)}
          onClone={handleClone}
        />
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
