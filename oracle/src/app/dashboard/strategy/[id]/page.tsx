"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Header } from "@/components/Header";
import { ExecutionLog } from "@/components/dashboard/ExecutionLog";
import { TradeHistory } from "@/components/dashboard/TradeHistory";
import { BacktestPanel } from "@/components/dashboard/BacktestPanel";
import { nodeTypeComponents } from "@/components/builder/nodes";
import { useStrategyExecution } from "@/hooks/useStrategyExecution";
import { useStrategyVault } from "@/hooks/useStrategyVault";
import { useWallet } from "@/hooks/useWallet";
import type { Strategy, StrategyPerformance } from "@/types";

type DetailTab = "overview" | "logs" | "backtest";

const statusStyles: Record<string, { label: string; badgeClass: string; glow: string }> = {
  running: { label: "Live", badgeClass: "text-accent-green border-accent-green/30", glow: "0 0 8px rgba(52, 211, 153, 0.3)" },
  paused: { label: "Paused", badgeClass: "text-accent-amber border-accent-amber/30", glow: "none" },
  draft: { label: "Draft", badgeClass: "text-edge-muted border-edge-border", glow: "none" },
  stopped: { label: "Stopped", badgeClass: "text-accent-red border-accent-red/30", glow: "none" },
};

function StrategyCanvas({ strategy, nodeStatuses, highlightNodeId, animateEdges }: {
  strategy: Strategy;
  nodeStatuses: Record<string, string>;
  highlightNodeId?: string | null;
  animateEdges?: boolean;
}) {
  const nodes = useMemo(() => strategy.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: {
      config: n.config,
      status: nodeStatuses[n.id] ?? "idle",
      isActive: n.id === highlightNodeId,
    },
  })), [strategy.nodes, nodeStatuses, highlightNodeId]);

  const edges = useMemo(() => strategy.connections.map((c) => ({
    id: c.id,
    source: c.source_id,
    target: c.target_id,
    sourceHandle: c.source_handle,
    targetHandle: c.target_handle,
    animated: animateEdges ?? strategy.status === "running",
    style: { stroke: "#3a3f55" },
  })), [strategy.connections, strategy.status, animateEdges]);

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
  const _router = useRouter();
  const id = params.id as string;

  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [perf, setPerf] = useState<StrategyPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [actionLoading, setActionLoading] = useState(false);
  const vault = useStrategyVault();
  const wallet = useWallet();

  useEffect(() => {
    const headers: Record<string, string> = {};
    if (wallet.address) {
      headers["X-Wallet-Address"] = wallet.address;
    }
    Promise.all([
      fetch(`/api/strategies/${id}`, { headers }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/strategies", { headers }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([strat, all]) => {
        setStrategy(strat);
        const match = (Array.isArray(all) ? all : []).find((s: any) => s.id === id);
        if (match?.performance) setPerf(match.performance);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, wallet.address]);

  // Merge vault-decrypted nodes into strategy
  const vaultEntry = vault.get(id);
  const strategyWithNodes = strategy && vaultEntry ? {
    ...strategy,
    nodes: vaultEntry.nodes,
    connections: vaultEntry.connections,
  } : strategy;

  const { logs: _executionLogs, isExecuting, nodeStatuses } = useStrategyExecution(
    strategy?.id ?? null,
    strategy?.status ?? "draft",
    30000
  );

  // Backtest canvas: highlight tracks real server-side execution
  const [btHighlightNode, setBtHighlightNode] = useState<string | null>(null);

  const handleNodeHighlight = useCallback((nodeId: string | null) => {
    setBtHighlightNode(nodeId);
  }, []);

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
        <main className="max-w-7xl mx-auto px-6 py-8 space-y-5">
          <div className="h-4 w-32 rounded bg-white/[0.03] animate-pulse" />
          <div className="bg-edge-surface border border-edge-border rounded-lg h-48 animate-pulse" />
          <div className="glass rounded-lg h-96 animate-pulse" style={{ animationDelay: "150ms" }} />
        </main>
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="min-h-screen bg-edge-bg text-edge-text">
        <Header />
        <main className="max-w-7xl mx-auto px-6 py-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <p className="text-sm font-medium text-edge-text-2 mb-4">Strategy not found</p>
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg bg-edge-surface border border-edge-border text-sm text-edge-text hover:text-white transition-colors"
            >
              Back to Dashboard
            </Link>
          </motion.div>
        </main>
      </div>
    );
  }

  const status = statusStyles[strategy.status] ?? statusStyles.draft;
  const pnl = perf?.totalPnl ?? 0;
  const winRate = perf && perf.totalTrades > 0 ? ((perf.winningTrades / perf.totalTrades) * 100).toFixed(1) : "—";

  const tabs: { key: DetailTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "logs", label: "Live Activity" },
    { key: "backtest", label: "Backtest" },
  ];

  return (
    <div className="min-h-screen bg-edge-bg text-edge-text">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="space-y-5"
        >
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm">
            <Link href="/dashboard" className="text-edge-muted hover:text-edge-text-2 transition-colors">Dashboard</Link>
            <span className="text-edge-dim">/</span>
            <span className="text-white">{strategy.name}</span>
          </nav>

          {/* Header panel */}
          <div className="glass relative overflow-hidden rounded-lg p-6">
            <div className="gradient-top-edge" />

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-xl font-semibold text-white truncate">{strategy.name}</h1>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-2xs font-mono uppercase tracking-wider rounded-sm border shrink-0 ${status.badgeClass}`}
                      style={{ boxShadow: status.glow }}
                    >
                      {strategy.status === "running" && (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-green" />
                        </span>
                      )}
                      {status.label}
                    </span>
                  </div>
                  {strategy.description && (
                    <p className="text-2xs text-edge-muted mb-2">{strategy.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-2xs text-edge-dim font-mono">
                    {strategy.nftMint && (
                      <span className="inline-flex items-center gap-1 text-violet-400">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        NFT Minted
                      </span>
                    )}
                    {strategy.zgRootHash && (
                      <span className="inline-flex items-center gap-1 text-cyan-400">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Encrypted
                      </span>
                    )}
                    {vaultEntry && (
                      <span className="text-edge-muted">{vaultEntry.nodes.length} nodes · {vaultEntry.connections.length} edges</span>
                    )}
                    <span>Created {new Date(strategy.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {isExecuting && (
                  <span className="text-2xs text-accent-green animate-pulse mr-1 font-mono">Executing...</span>
                )}
                {strategy.nftMint && (
                  <a
                    href={`https://explorer.solana.com/address/${strategy.nftMint}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-500/20 text-sm text-violet-400 hover:bg-violet-500/10 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    View NFT
                  </a>
                )}
                <Link
                  href={`/?id=${strategy.id}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-edge-surface border border-edge-border text-sm text-edge-text hover:border-edge-border-2 hover:text-white transition-colors"
                >
                  Edit in Builder
                </Link>
                {strategy.status === "draft" || strategy.status === "stopped" || strategy.status === "paused" ? (
                  <button
                    onClick={() => handleAction("deploy")}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-green/10 border border-accent-green/20 text-sm text-accent-green font-medium hover:bg-accent-green/15 transition-colors disabled:opacity-50"
                  >
                    {strategy.status === "paused" ? "Resume" : "Deploy"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleAction("pause")}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-amber/10 border border-accent-amber/20 text-sm text-accent-amber font-medium hover:bg-accent-amber/15 transition-colors disabled:opacity-50"
                  >
                    Pause
                  </button>
                )}
              </div>
            </div>

            {/* Stats row — HELIX-style internal blocks */}
            <div className="grid grid-cols-4 gap-3 mt-5">
              <div className="bg-edge-bg rounded-md px-3 py-2 text-center">
                <p className="text-2xs text-edge-muted">P&L</p>
                <p className={`text-lg font-mono font-light ${pnl >= 0 ? "text-accent-green" : "text-accent-red"}`}>
                  {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                </p>
              </div>
              <div className="bg-edge-bg rounded-md px-3 py-2 text-center">
                <p className="text-2xs text-edge-muted">Trades</p>
                <p className="text-lg font-mono font-light text-white">{perf?.totalTrades ?? 0}</p>
              </div>
              <div className="bg-edge-bg rounded-md px-3 py-2 text-center">
                <p className="text-2xs text-edge-muted">Win Rate</p>
                <p className="text-lg font-mono font-light text-white">{winRate}{winRate !== "—" && "%"}</p>
              </div>
              <div className="bg-edge-bg rounded-md px-3 py-2 text-center">
                <p className="text-2xs text-edge-muted">Sharpe</p>
                <p className="text-lg font-mono font-light text-white">{perf?.sharpeRatio?.toFixed(2) ?? "—"}</p>
              </div>
            </div>
          </div>

          {/* Tab bar — spring-physics animated */}
          <div className="flex items-center gap-1 p-1 bg-edge-bg rounded-lg border border-edge-border w-fit">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative flex items-center px-4 py-1.5 rounded-md text-sm transition-all ${
                  tab === t.key ? "text-white" : "text-edge-muted hover:text-edge-text-2"
                }`}
              >
                {tab === t.key && (
                  <motion.div
                    layoutId="detail-tab-bg"
                    className="absolute inset-0 bg-edge-surface border border-edge-border rounded-md"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === "overview" && (
            <div className="glass relative overflow-hidden rounded-lg" style={{ height: "500px" }}>
              <div className="gradient-top-edge" />
              <ReactFlowProvider>
                <StrategyCanvas strategy={strategyWithNodes!} nodeStatuses={nodeStatuses} />
              </ReactFlowProvider>
            </div>
          )}

          {tab === "logs" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-edge-surface border border-edge-border rounded-lg p-5">
                <h3 className="text-2xs font-mono uppercase tracking-wider text-edge-muted mb-4">Execution Log</h3>
                <ExecutionLog strategyId={id} pollInterval={strategy.status === "running" ? 10000 : 0} />
              </div>
              <div className="bg-edge-surface border border-edge-border rounded-lg p-5">
                <h3 className="text-2xs font-mono uppercase tracking-wider text-edge-muted mb-4">Trade History</h3>
                <TradeHistory strategyId={id} pollInterval={strategy.status === "running" ? 10000 : 0} />
              </div>
            </div>
          )}

          {tab === "backtest" && (
            <div className="space-y-4">
              {/* Live strategy canvas with node highlighting during backtest */}
              {strategyWithNodes && strategyWithNodes.nodes.length > 0 && (
                <div
                  className="glass relative overflow-hidden rounded-lg"
                  style={{ height: "340px" }}
                >
                  <div className="gradient-top-edge" />
                  <ReactFlowProvider>
                    <StrategyCanvas
                      strategy={strategyWithNodes}
                      nodeStatuses={nodeStatuses}
                      highlightNodeId={btHighlightNode}
                      animateEdges={btHighlightNode != null}
                    />
                  </ReactFlowProvider>
                </div>
              )}
              <div className="bg-edge-surface border border-edge-border rounded-lg p-5">
                <BacktestPanel
                  strategyId={id}
                  nodes={vaultEntry?.nodes}
                  connections={vaultEntry?.connections}
                  onNodeHighlight={handleNodeHighlight}
                />
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
