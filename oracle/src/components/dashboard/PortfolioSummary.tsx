"use client";

import { Strategy, StrategyPerformance } from "@/types";

interface Props {
  strategies: (Strategy & { performance?: StrategyPerformance })[];
}

export function PortfolioSummary({ strategies }: Props) {
  const activeCount = strategies.filter((s) => s.status === "running").length;

  const totalPnl = strategies.reduce(
    (sum, s) => sum + (s.performance?.totalPnl ?? 0),
    0,
  );

  const totalTrades = strategies.reduce(
    (sum, s) => sum + (s.performance?.totalTrades ?? s.nodes.length),
    0,
  );

  const best = strategies.reduce<string | null>((bestName, s) => {
    if (!s.performance) return bestName;
    const currentBest = strategies.find((st) => st.name === bestName);
    if (
      !currentBest?.performance ||
      s.performance.totalPnl > currentBest.performance.totalPnl
    ) {
      return s.name;
    }
    return bestName;
  }, strategies[0]?.name ?? null);

  const pnlPositive = totalPnl >= 0;

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, rgba(14, 16, 24, 0.85) 0%, rgba(20, 22, 32, 0.65) 100%)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.05)",
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: pnlPositive
            ? "linear-gradient(90deg, transparent 5%, rgba(52, 211, 153, 0.5) 25%, rgba(129, 140, 248, 0.6) 50%, rgba(167, 139, 250, 0.4) 75%, transparent 95%)"
            : "linear-gradient(90deg, transparent 5%, rgba(248, 113, 113, 0.5) 25%, rgba(129, 140, 248, 0.6) 50%, rgba(167, 139, 250, 0.4) 75%, transparent 95%)",
        }}
      />
      {/* Inner glow */}
      <div
        className="absolute top-0 left-0 right-0 h-20 pointer-events-none"
        style={{
          background: pnlPositive
            ? "radial-gradient(ellipse 50% 100% at 20% -30%, rgba(52, 211, 153, 0.06) 0%, transparent 70%)"
            : "radial-gradient(ellipse 50% 100% at 20% -30%, rgba(248, 113, 113, 0.06) 0%, transparent 70%)",
        }}
      />

      <div className="flex items-center px-6 py-5 gap-0 relative">
        {/* Hero P&L — dominant left element */}
        <div className="flex flex-col gap-0.5 min-w-[180px]">
          <span className="text-[10px] uppercase tracking-widest text-edge-muted font-semibold">
            Total P&L
          </span>
          <span
            className={`text-3xl font-bold tracking-tight ${pnlPositive ? "text-accent-green" : "text-accent-red"}`}
            style={{
              textShadow: pnlPositive
                ? "0 0 30px rgba(52, 211, 153, 0.2)"
                : "0 0 30px rgba(248, 113, 113, 0.2)",
            }}
          >
            {pnlPositive ? "+" : ""}${totalPnl.toFixed(2)}
          </span>
        </div>

        {/* Vertical divider */}
        <div className="w-px h-10 bg-white/[0.06] mx-6 shrink-0" />

        {/* Secondary stats — compact inline */}
        <div className="flex items-center gap-6 flex-1 min-w-0">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-widest text-edge-muted font-semibold">
              Active
            </span>
            <span className="text-lg font-semibold text-accent-blue tracking-tight">
              {activeCount}
              <span className="text-[10px] text-edge-dim font-normal ml-1">
                / {strategies.length}
              </span>
            </span>
          </div>

          <div className="w-px h-8 bg-white/[0.04] shrink-0" />

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-widest text-edge-muted font-semibold">
              Trades
            </span>
            <span className="text-lg font-semibold text-accent-purple tracking-tight">
              {totalTrades}
            </span>
          </div>

          <div className="w-px h-8 bg-white/[0.04] shrink-0" />

          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[10px] uppercase tracking-widest text-edge-muted font-semibold">
              Top Performer
            </span>
            <span className="text-sm font-medium text-accent-cyan tracking-tight truncate">
              {best ?? "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
