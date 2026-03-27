"use client";

import { Handle, Position, useReactFlow } from "@xyflow/react";
import { NODE_TYPES } from "@/lib/strategy/node-types";
import type { NodeStatus } from "@/types";
import { memo, useCallback, type ReactNode } from "react";

interface NodeShellProps {
  id: string;
  type: string;
  selected?: boolean;
  status?: NodeStatus;
  width?: string; // e.g. "w-[220px]"
  children: ReactNode;
}

const STATUS_COLORS: Record<NodeStatus, string> = {
  idle: "bg-edge-dim",
  processing: "bg-accent-blue animate-pulse",
  passed: "bg-accent-green",
  blocked: "bg-accent-red",
  warning: "bg-accent-amber",
};

function NodeShellComponent({ id: _id, type, selected, status, width = "w-[220px]", children }: NodeShellProps) {
  const def = NODE_TYPES[type];
  if (!def) return null;

  const categoryColor = def.color;

  return (
    <div
      className={`
        relative ${width} rounded-xl overflow-hidden
        transition-all duration-200
        ${selected ? "ring-2 ring-accent-blue/60 ring-offset-1 ring-offset-edge-bg" : ""}
      `}
      style={{
        background: `linear-gradient(145deg, rgba(14, 16, 24, 0.9) 0%, rgba(20, 22, 32, 0.7) 100%)`,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: `1px solid rgba(255, 255, 255, 0.05)`,
        boxShadow: selected
          ? `0 0 20px ${categoryColor}15, 0 4px 16px rgba(0,0,0,0.3)`
          : `0 2px 12px rgba(0,0,0,0.25)`,
      }}
    >
      {/* Top accent line — always visible, subtle */}
      <div
        className="h-[2px] w-full"
        style={{
          background: `linear-gradient(90deg, transparent 5%, ${categoryColor}60 30%, ${categoryColor}80 50%, ${categoryColor}60 70%, transparent 95%)`,
        }}
      />

      {/* Subtle inner glow from the top */}
      <div
        className="absolute top-0 left-0 right-0 h-12 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 100% at 50% -20%, ${categoryColor}08 0%, transparent 70%)`,
        }}
      />

      {/* Input handles */}
      {def.handles.inputs.map((handleId, i) => {
        const count = def.handles.inputs.length;
        const offset = count === 1 ? 50 : 30 + (i / (count - 1)) * 40;
        return (
          <Handle
            key={handleId}
            type="target"
            position={Position.Left}
            id={handleId}
            className="!w-3 !h-3 !rounded-full !border-0 transition-all duration-200 hover:!w-4 hover:!h-4 hover:!-ml-0.5"
            style={{
              top: `${offset}%`,
              background: `rgba(255, 255, 255, 0.25)`,
              boxShadow: `0 0 0 3px rgba(255, 255, 255, 0.08)`,
              cursor: "crosshair",
            }}
          />
        );
      })}

      {/* Output handles */}
      {def.handles.outputs.map((handleId, i) => {
        const count = def.handles.outputs.length;
        const offset = count === 1 ? 50 : 30 + (i / (count - 1)) * 40;
        return (
          <Handle
            key={handleId}
            type="source"
            position={Position.Right}
            id={handleId}
            className="!w-3 !h-3 !rounded-full !border-0 transition-all duration-200 hover:!w-4 hover:!h-4 hover:!-mr-0.5"
            style={{
              top: `${offset}%`,
              background: `${categoryColor}`,
              boxShadow: `0 0 8px ${categoryColor}50`,
              cursor: "crosshair",
            }}
          />
        );
      })}

      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1 relative">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center text-xs flex-shrink-0"
          style={{ background: `${categoryColor}15` }}
        >
          {def.icon}
        </div>
        <span className="text-[11px] font-semibold text-edge-text/90 tracking-wide uppercase truncate">
          {def.label}
        </span>
        {/* Status dot */}
        {status && status !== "idle" && (
          <span
            className={`ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_COLORS[status]}`}
            style={{
              boxShadow: status === "passed" ? "0 0 6px rgba(52, 211, 153, 0.5)"
                : status === "blocked" ? "0 0 6px rgba(248, 113, 113, 0.5)"
                : status === "processing" ? "0 0 6px rgba(129, 140, 248, 0.5)"
                : "none"
            }}
          />
        )}
      </div>

      {/* Divider */}
      <div className="mx-3 h-[1px] bg-white/[0.04]" />

      {/* Inline config content from child */}
      <div className="px-3 pt-1.5 pb-3 relative">
        {children}
      </div>
    </div>
  );
}

export const NodeShell = memo(NodeShellComponent);

/**
 * Shared inline input styles — glass-styled inputs
 */
export const inputClass = "w-full bg-white/[0.04] border border-white/[0.06] text-edge-text rounded-md px-2 py-1 text-[11px] focus:outline-none focus:border-accent-blue/40 focus:bg-white/[0.06] transition-all duration-150 placeholder:text-edge-dim";

export const selectClass = "w-full bg-white/[0.04] border border-white/[0.06] text-edge-text rounded-md px-2 py-1 text-[11px] focus:outline-none focus:border-accent-blue/40 transition-all duration-150 appearance-none";

export const labelClass = "text-[10px] text-edge-muted/70 mb-0.5 block uppercase tracking-wider";

/** Hook for node components to update their own config */
export function useNodeConfig(nodeId: string) {
  const { setNodes } = useReactFlow();

  const updateConfig = useCallback(
    (key: string, value: any) => {
      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, config: { ...(n.data.config as Record<string, unknown>), [key]: value } } }
            : n
        )
      );
    },
    [nodeId, setNodes]
  );

  return updateConfig;
}
