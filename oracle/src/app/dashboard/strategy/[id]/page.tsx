"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Header } from "@/components/Header";
import { ExecutionLog } from "@/components/dashboard/ExecutionLog";
import { TradeHistory } from "@/components/dashboard/TradeHistory";
import { BacktestPanel } from "@/components/dashboard/BacktestPanel";
import { nodeTypeComponents } from "@/components/builder/nodes";
import type { Strategy, StrategyPerformance } from "@/types";

type DetailTab = "overview" | "logs" | "backtest";

const statusStyles: Record<string, { label: string; bg: string; glow: string; color: string }> = {
  running: { label: "Live", bg: "rgba(52, 211, 153, 0.12)", glow: "0 0 8px rgba(52, 211, 153, 0.3)", color: "text-accent-green" },
  paused: { label: "Paused", bg: "rgba(251, 191, 36, 0.12)", glow: "none", color: "text-accent-amber" },
  draft: { label: "Draft", bg: "rgba(90, 95, 122, 0.15)", glow: "none", color: "text-edge-muted" },
  stopped: { label: "Stopped", bg: "rgba(248, 113, 113, 0.12)", glow: "none", color: "text-accent-red" },
};

function StrategyCanvas({ strategy }: { strategy: Strategy }) {
  const nodes = strategy.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: { config: n.config },
  }));

  const edges = strategy.connections.map((c) => ({
    id: c.id,
    source: c.source_id,
    target: c.target_id,
    sourceHandle: c.source_handle,
    targetHandle: c.target_handle,
    animated: true,
    style: { stroke: "#2A2A3E" },
  }));

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypeComponents}
      fitView
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      proOptions={{ hideAttribution: true }}
      className="bg-edge-bg"
    />
  );
}

export default function StrategyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [perf, setPerf] = useState<StrategyPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/strategies/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/strategies").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([strat, all]) => {
        setStrategy(strat);
        const match = (Array.isArray(all) ? all : []).find((s: any) => s.id === id);
        if (match?.performance) setPerf(match.performance);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleAction = async (action: "deploy" | "pause" | "stop") => {
    setActionLoading(true);
    try {
      await fetch(`/api/strategies/${id}/${action}`, { method: "POST" });
      const res = await fetch(`/api/strategies/${id}`);
      if (res.ok) setStrategy(await res.json());
    } catch {}
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-edge-bg text-edge-text">
        <Header />
        <main className="max-w-7xl mx-auto px-5 py-8">
          <div className="rounded-xl h-64 animate-shimmer" style={{ background: "linear-gradient(135deg, rgba(14,16,24,0.8) 0%, rgba(20,22,32,0.6) 100%)", border: "1px solid rgba(255,255,255,0.04)" }} />
        </main>
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="min-h-screen bg-edge-bg text-edge-text">
        <Header />
        <main className="max-w-7xl mx-auto px-5 py-8 text-center">
          <p className="text-edge-muted mb-4">Strategy not found</p>
          <Link href="/dashboard" className="text-accent-blue hover:underline text-sm">Back to Dashboard</Link>
        </main>
      </div>
    );
  }

  const status = statusStyles[strategy.status] ?? statusStyles.draft;
  const pnl = perf?.totalPnl ?? 0;
  const winRate = perf && perf.totalTrades > 0 ? ((perf.winningTrades / perf.totalTrades) * 100).toFixed(1) : "—";

  const tabs: { key: DetailTab; label: string; accent: string }[] = [
    { key: "overview", label: "Overview", accent: "rgba(129, 140, 248, 0.15)" },
    { key: "logs", label: "Live Activity", accent: "rgba(129, 140, 248, 0.15)" },
    { key: "backtest", label: "Backtest", accent: "rgba(34, 211, 238, 0.15)" },
  ];

  return (
    <div className="min-h-screen bg-edge-bg text-edge-text">
      <Header />

      <main className="max-w-7xl mx-auto px-5 py-8 space-y-5 animate-fade-in">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[11px] text-edge-muted">
          <Link href="/dashboard" className="hover:text-edge-text transition-colors">Dashboard</Link>
          <span className="text-edge-dim">/</span>
          <span className="text-edge-text">{strategy.name}</span>
        </div>

        {/* Header panel */}
        <div
          className="relative rounded-xl overflow-hidden p-5"
          style={{
            background: "linear-gradient(135deg, rgba(14,16,24,0.85) 0%, rgba(20,22,32,0.65) 100%)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, transparent 5%, rgba(129,140,248,0.4) 30%, rgba(167,139,250,0.5) 50%, rgba(129,140,248,0.4) 70%, transparent 95%)" }} />

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-xl font-semibold text-edge-text truncate">{strategy.name}</h1>
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-widest shrink-0 ${status.color}`}
                  style={{ background: status.bg, boxShadow: status.glow }}
                >
                  {strategy.status === "running" && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-50" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-green" />
                    </span>
                  )}
                  {status.label}
                </div>
              </div>
              {strategy.description && (
                <p className="text-[12px] text-edge-muted mb-3">{strategy.description}</p>
              )}
              <div className="flex items-center gap-1.5 text-[10px] text-edge-dim">
                <span>{strategy.nodes.length} nodes</span>
                <span>·</span>
                <span>{strategy.connections.length} connections</span>
                <span>·</span>
                <span>Created {new Date(strategy.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/?id=${strategy.id}`}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-accent-blue transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.2)" }}
              >
                Edit in Builder
              </Link>
              {strategy.status === "draft" || strategy.status === "stopped" || strategy.status === "paused" ? (
                <button
                  onClick={() => handleAction("deploy")}
                  disabled={actionLoading}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-accent-green transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }}
                >
                  {strategy.status === "paused" ? "Resume" : "Deploy"}
                </button>
              ) : (
                <button
                  onClick={() => handleAction("pause")}
                  disabled={actionLoading}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-accent-amber transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)" }}
                >
                  Pause
                </button>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4 mt-5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-edge-muted mb-1">P&L</div>
              <div className={`text-lg font-mono font-semibold ${pnl >= 0 ? "text-accent-green" : "text-accent-red"}`}>
                {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-edge-muted mb-1">Trades</div>
              <div className="text-lg font-mono font-semibold text-edge-text">{perf?.totalTrades ?? 0}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-edge-muted mb-1">Win Rate</div>
              <div className="text-lg font-mono font-semibold text-edge-text">{winRate}{winRate !== "—" && "%"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-edge-muted mb-1">Sharpe</div>
              <div className="text-lg font-mono font-semibold text-edge-text">{perf?.sharpeRatio?.toFixed(2) ?? "—"}</div>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-widest transition-all ${
                tab === t.key ? "bg-white/[0.06] text-edge-text" : "text-edge-muted hover:text-edge-text hover:bg-white/[0.02]"
              }`}
              style={tab === t.key ? { border: `1px solid ${t.accent}`, boxShadow: `0 0 8px ${t.accent.replace("0.15", "0.06")}` } : { border: "1px solid transparent" }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "overview" && (
          <div
            className="relative rounded-xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(14,16,24,0.85) 0%, rgba(20,22,32,0.65) 100%)",
              border: "1px solid rgba(255,255,255,0.05)",
              height: "500px",
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: "linear-gradient(90deg, transparent 10%, rgba(129,140,248,0.3) 50%, transparent 90%)" }} />
            <ReactFlowProvider>
              <StrategyCanvas strategy={strategy} />
            </ReactFlowProvider>
          </div>
        )}

        {tab === "logs" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div
              className="relative rounded-xl overflow-hidden p-5"
              style={{ background: "linear-gradient(135deg, rgba(14,16,24,0.85) 0%, rgba(20,22,32,0.65) 100%)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: "linear-gradient(90deg, transparent 10%, rgba(129,140,248,0.3) 50%, transparent 90%)" }} />
              <h3 className="text-[10px] uppercase tracking-widest text-edge-muted font-semibold mb-4">Execution Log</h3>
              <ExecutionLog strategyId={id} />
            </div>
            <div
              className="relative rounded-xl overflow-hidden p-5"
              style={{ background: "linear-gradient(135deg, rgba(14,16,24,0.85) 0%, rgba(20,22,32,0.65) 100%)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: "linear-gradient(90deg, transparent 10%, rgba(167,139,250,0.3) 50%, transparent 90%)" }} />
              <h3 className="text-[10px] uppercase tracking-widest text-edge-muted font-semibold mb-4">Trade History</h3>
              <TradeHistory strategyId={id} />
            </div>
          </div>
        )}

        {tab === "backtest" && (
          <div
            className="relative rounded-xl overflow-hidden p-5"
            style={{ background: "linear-gradient(135deg, rgba(14,16,24,0.85) 0%, rgba(20,22,32,0.65) 100%)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: "linear-gradient(90deg, transparent 10%, rgba(34,211,238,0.3) 50%, transparent 90%)" }} />
            <BacktestPanel strategyId={id} />
          </div>
        )}
      </main>
    </div>
  );
}
