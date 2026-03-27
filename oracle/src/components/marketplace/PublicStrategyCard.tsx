import { Strategy, StrategyPerformance } from "@/types";

interface Props {
  strategy: Strategy & { performance?: StrategyPerformance };
  onView: () => void;
  onClone: () => void;
}

export function PublicStrategyCard({ strategy, onView, onClone }: Props) {
  const perf = strategy.performance;
  const winRate =
    perf && perf.totalTrades > 0
      ? ((perf.winningTrades / perf.totalTrades) * 100).toFixed(1)
      : "—";

  return (
    <div className="bg-edge-surface hover:bg-edge-surface-2 border border-edge-border hover:border-edge-border-2 rounded-lg p-5 transition-all flex flex-col gap-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-medium text-edge-text truncate">
          {strategy.name}
        </h3>
        <p className="text-xs text-edge-muted mt-0.5">
          by {strategy.authorName || "Anonymous"}
        </p>
      </div>

      {/* Description */}
      {strategy.description && (
        <p className="text-xs text-edge-text-2 line-clamp-2 leading-relaxed">
          {strategy.description}
        </p>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-edge-muted">Sharpe</span>
          <span className="font-mono text-edge-text font-medium">
            {perf?.sharpeRatio?.toFixed(2) ?? "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-edge-muted">P&L</span>
          <span
            className={`font-mono font-medium ${
              (perf?.totalPnl ?? 0) >= 0
                ? "text-accent-green"
                : "text-accent-red"
            }`}
          >
            {perf ? `${perf.totalPnl >= 0 ? "+" : ""}$${perf.totalPnl.toFixed(2)}` : "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-edge-muted">Win Rate</span>
          <span className="font-mono text-edge-text font-medium">
            {winRate}
            {winRate !== "—" && "%"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-edge-muted">Trades</span>
          <span className="font-mono text-edge-text font-medium">
            {perf?.totalTrades ?? 0}
          </span>
        </div>
      </div>

      {/* Node count */}
      <div className="text-[10px] text-edge-dim">
        {strategy.nodes.length} nodes
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        <button
          onClick={onView}
          className="flex-1 text-xs font-medium py-1.5 rounded-md border border-edge-border-2 text-edge-text-2 hover:text-edge-text hover:border-accent-blue/40 transition-colors cursor-pointer"
        >
          View
        </button>
        <button
          onClick={onClone}
          className="flex-1 text-xs font-medium py-1.5 rounded-md bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 transition-colors cursor-pointer"
        >
          Clone
        </button>
      </div>
    </div>
  );
}
