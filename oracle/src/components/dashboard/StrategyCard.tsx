import Link from "next/link";
import { Strategy, StrategyPerformance } from "@/types";

interface Props {
  strategy: Strategy & { performance?: StrategyPerformance };
  onClick?: () => void;
  selected?: boolean;
}

const statusStyles: Record<
  string,
  { label: string; bg: string; glow: string; color: string }
> = {
  running: {
    label: "Live",
    bg: "rgba(52, 211, 153, 0.12)",
    glow: "0 0 8px rgba(52, 211, 153, 0.3)",
    color: "text-accent-green",
  },
  paused: {
    label: "Paused",
    bg: "rgba(251, 191, 36, 0.12)",
    glow: "none",
    color: "text-accent-amber",
  },
  draft: {
    label: "Draft",
    bg: "rgba(90, 95, 122, 0.15)",
    glow: "none",
    color: "text-edge-muted",
  },
  stopped: {
    label: "Stopped",
    bg: "rgba(248, 113, 113, 0.12)",
    glow: "none",
    color: "text-accent-red",
  },
};

export function StrategyRow({ strategy, onClick, selected }: Props) {
  const perf = strategy.performance;
  const status = statusStyles[strategy.status] ?? statusStyles.draft;
  const pnl = perf?.totalPnl ?? 0;
  const winRate =
    perf && perf.totalTrades > 0
      ? ((perf.winningTrades / perf.totalTrades) * 100).toFixed(1)
      : "—";

  return (
    <Link
      href={`/dashboard/strategy/${strategy.id}`}
      className={`w-full flex items-center gap-4 px-4 py-3 transition-all duration-150 cursor-pointer group text-left ${
        selected
          ? "bg-white/[0.03]"
          : "hover:bg-white/[0.02]"
      }`}
    >
      {/* Strategy name */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <h3 className="text-[13px] font-medium text-edge-text truncate">
          {strategy.name}
        </h3>
      </div>

      {/* Status badge */}
      <div
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-widest shrink-0 ${status.color}`}
        style={{
          background: status.bg,
          boxShadow: status.glow,
        }}
      >
        {strategy.status === "running" && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-50" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-green" />
          </span>
        )}
        {status.label}
      </div>

      {/* P&L */}
      <div className="w-24 text-right shrink-0">
        <span
          className={`text-[13px] font-mono font-medium ${pnl >= 0 ? "text-accent-green" : "text-accent-red"}`}
        >
          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
        </span>
      </div>

      {/* Trades */}
      <div className="w-16 text-right shrink-0">
        <span className="text-[13px] font-mono text-edge-text-2">
          {perf?.totalTrades ?? 0}
        </span>
      </div>

      {/* Win rate */}
      <div className="w-16 text-right shrink-0">
        <span className="text-[13px] font-mono text-edge-text-2">
          {winRate}
          {winRate !== "—" && "%"}
        </span>
      </div>

      {/* Arrow */}
      <div className="w-5 shrink-0 flex justify-center">
        <svg
          className="w-3.5 h-3.5 text-edge-dim transition-colors group-hover:text-edge-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
