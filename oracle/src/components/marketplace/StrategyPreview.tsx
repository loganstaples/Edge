"use client";

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
    style: { stroke: "#5a5f7a" },
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-[90vw] h-[80vh] bg-edge-surface border border-edge-border rounded-xl overflow-hidden shadow-2xl">
        {/* Header bar */}
        <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-4 py-3 bg-edge-surface/90 border-b border-edge-border backdrop-blur-sm">
          <div>
            <h3 className="text-sm font-medium text-edge-text">
              {strategy.name}
            </h3>
            <p className="text-xs text-edge-muted">
              by {strategy.authorName || "Anonymous"} &middot;{" "}
              {strategy.nodes.length} nodes
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-edge-muted hover:text-edge-text hover:bg-edge-surface-2 transition-colors cursor-pointer"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
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
      </div>
    </div>
  );
}

export function StrategyPreview(props: Props) {
  return (
    <ReactFlowProvider>
      <PreviewCanvas {...props} />
    </ReactFlowProvider>
  );
}
