"use client";

import { motion } from "framer-motion";
import { Strategy, StrategyPerformance } from "@/types";

interface Props {
  strategies: (Strategy & { performance?: StrategyPerformance })[];
}

function StatCard({
  label,
  value,
  delta,
  deltaColor,
  icon,
  delay,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaColor?: "green" | "red" | "muted";
  icon: React.ReactNode;
  delay?: number;
}) {
  const colorMap = {
    green: "text-accent-green",
    red: "text-accent-red",
    muted: "text-edge-muted",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: delay ?? 0 }}
      className="bg-edge-surface border border-edge-border rounded-lg p-5 relative"
    >
      <div className="absolute top-4 right-4 text-edge-dim">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-2xs font-mono uppercase tracking-wider text-edge-muted">
          {label}
        </p>
        <p className="text-2xl font-light tracking-tight text-white">
          {value}
        </p>
        {delta && (
          <p className={`text-2xs ${colorMap[deltaColor ?? "muted"]}`}>
            {delta}
          </p>
        )}
      </div>
    </motion.div>
  );
}

export function PortfolioSummary({ strategies }: Props) {
  const runningCount = strategies.filter((s) => s.status === "running").length;
  const pausedCount = strategies.filter((s) => s.status === "paused").length;

  const totalPnl = strategies.reduce(
    (sum, s) => sum + (s.performance?.totalPnl ?? 0),
    0,
  );

  const totalTrades = strategies.reduce(
    (sum, s) => sum + (s.performance?.totalTrades ?? 0),
    0,
  );

  const totalWinning = strategies.reduce(
    (sum, s) => sum + (s.performance?.winningTrades ?? 0),
    0,
  );

  const pnlPositive = totalPnl >= 0;
  const winRate = totalTrades > 0 ? ((totalWinning / totalTrades) * 100).toFixed(1) : "--";

  const pnlPct =
    totalPnl !== 0
      ? ((totalPnl / Math.max(Math.abs(totalPnl) * 8, 1)) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <StatCard
        label="Total P&L"
        value={`${pnlPositive ? "+" : "-"}$${Math.abs(totalPnl).toFixed(2)}`}
        delta={`${pnlPositive ? "↑" : "↓"} ${pnlPositive ? "+" : ""}${pnlPct}%`}
        deltaColor={pnlPositive ? "green" : "red"}
        delay={0}
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2 17l6-6 4 4 10-10" />
          </svg>
        }
      />
      <StatCard
        label="Active Strategies"
        value={`${runningCount}`}
        delta={pausedCount > 0 ? `${pausedCount} paused` : undefined}
        deltaColor="muted"
        delay={0.05}
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
          </svg>
        }
      />
      <StatCard
        label="Total Trades"
        value={`${totalTrades}`}
        delay={0.1}
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        }
      />
      <StatCard
        label="Win Rate"
        value={`${winRate}${winRate !== "--" ? "%" : ""}`}
        delay={0.15}
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
    </div>
  );
}
