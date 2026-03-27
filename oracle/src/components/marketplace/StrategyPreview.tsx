"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { ReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Strategy } from "@/types";
import { nodeTypeComponents } from "@/components/builder/nodes";

interface Props {
  strategy: Strategy;
  onClose: () => void;
}

function PreviewCanvas({ strategy, onClose }: Props) {
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
    style: { stroke: "#3a3f55" },
  }));

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-[90vw] max-w-6xl h-[80vh] bg-edge-surface border border-edge-border rounded-xl overflow-hidden shadow-2xl"
      >
        {/* Gradient top edge */}
        <div className="absolute top-0 left-0 right-0 h-px z-20 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Header bar */}
        <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-5 py-3.5 bg-edge-surface/90 border-b border-edge-border backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-blue/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">{strategy.name}</h3>
              <p className="text-2xs font-mono text-edge-muted">
                by {strategy.authorName || "Anonymous"} · {strategy.nodes.length} nodes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-edge-muted hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        {/* Canvas */}
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
      </motion.div>
    </motion.div>
  );
}

export function StrategyPreview(props: Props) {
  return (
    <ReactFlowProvider>
      <PreviewCanvas {...props} />
    </ReactFlowProvider>
  );
}
