"use client";

import { Handle, Position, useReactFlow, useEdges, useNodes } from "@xyflow/react";
import { NODE_TYPES } from "@/lib/strategy/node-types";
import type { NodeStatus } from "@/types";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/** Resolve legacy/shorthand type names to canonical NODE_TYPES keys */
const TYPE_ALIASES: Record<string, string> = {
  news_feed: "news_monitor",
  market_watch: "news_monitor",
  polymarket_markets: "polymarket_feed",
  gemini_markets: "gemini_markets_feed",
  market_filter: "gemini_markets_feed",
  price_alert: "price_alert_decide",
  sentiment: "sentiment_scanner",
  sentiment_analyzer: "sentiment_scanner",
  ai_probability_estimator: "ai_analyst",
  gate: "multi_condition_gate",
  threshold_gate: "multi_condition_gate",
  and_or: "multi_condition_gate",
  cooldown: "cooldown_gate",
  cooldown_timer: "cooldown_gate",
  trade: "trade_advanced",
  trade_polymarket: "trade_advanced",
  trade_gemini: "trade_advanced",
  alert_log: "alert_advanced",
};

function resolveNodeType(type: string): string {
  return TYPE_ALIASES[type] ?? type;
}

interface NodeShellProps {
  id: string;
  type: string;
  selected?: boolean;
  status?: NodeStatus;
  flash?: "buy" | "sell" | null; // Triggers green/red flash animation
  isActive?: boolean; // True when node is currently executing (border glows with category color)
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

function NodeShellComponent({ id: _id, type, selected, status, flash, isActive, width = "w-[220px]", children }: NodeShellProps) {
  // Hooks must be called unconditionally before any early returns
  const [flashActive, setFlashActive] = useState<"buy" | "sell" | null>(null);
  const prevFlashRef = useRef(flash);
  useEffect(() => {
    if (flash && flash !== prevFlashRef.current) {
      setFlashActive(flash);
      const timer = setTimeout(() => setFlashActive(null), 800);
      return () => clearTimeout(timer);
    }
    prevFlashRef.current = flash;
  }, [flash]);

  const def = NODE_TYPES[resolveNodeType(type)];
  if (!def) return null;

  const categoryColor = def.color;

  const flashColor = flashActive === "buy" ? "rgba(0, 210, 106, 0.35)" : flashActive === "sell" ? "rgba(248, 113, 113, 0.35)" : "transparent";
  const flashShadow = flashActive === "buy" ? "0 0 30px rgba(0, 210, 106, 0.5), 0 0 60px rgba(0, 210, 106, 0.2)" : flashActive === "sell" ? "0 0 30px rgba(248, 113, 113, 0.5), 0 0 60px rgba(248, 113, 113, 0.2)" : "";

  return (
    <div
      className={`
        relative ${width} rounded-xl overflow-visible
        transition-all duration-200
        ${selected ? "ring-2 ring-accent-blue/60 ring-offset-1 ring-offset-edge-bg" : ""}
      `}
      style={{
        background: `linear-gradient(145deg, rgba(10, 10, 12, 0.97) 0%, rgba(14, 14, 16, 0.95) 100%)`,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: flashActive
          ? `1.5px solid ${flashColor}`
          : isActive
            ? `1.5px solid ${categoryColor}90`
            : `1.5px solid rgba(255, 255, 255, 0.13)`,
        boxShadow: flashActive
          ? flashShadow
          : isActive
            ? `0 0 20px ${categoryColor}30, 0 0 40px ${categoryColor}15, 0 4px 16px rgba(0,0,0,0.3)`
            : selected
              ? `0 0 20px rgba(255,255,255,0.06), 0 4px 16px rgba(0,0,0,0.4)`
              : `0 2px 12px rgba(0,0,0,0.35)`,
        transition: "box-shadow 0.4s ease, border-color 0.4s ease",
      }}
    >
      {/* Inner wrapper clips decorative content but handles remain unclipped */}
      <div className="rounded-xl overflow-hidden">
      {/* Flash overlay */}
      {flashActive && (
        <div
          className="absolute inset-0 pointer-events-none z-10 rounded-xl"
          style={{
            background: flashColor,
            animation: "flash-fade 0.8s ease-out forwards",
          }}
        />
      )}
      <style>{`@keyframes flash-fade { 0% { opacity: 1; } 100% { opacity: 0; } }`}</style>
      {/* Subtle top highlight for depth */}
      <div
        className="h-[1px] w-full"
        style={{
          background: `linear-gradient(90deg, transparent 10%, rgba(255, 255, 255, 0.08) 50%, transparent 90%)`,
        }}
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1 relative">
        <div
          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: `${categoryColor}18` }}
        >
          <div className="w-2 h-2 rounded-full" style={{ background: categoryColor, boxShadow: `0 0 6px ${categoryColor}60` }} />
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
      </div>{/* end inner overflow-hidden wrapper */}

      {/* Handles — outside overflow-hidden so they aren't clipped */}
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
              background: `${categoryColor}`,
              boxShadow: `0 0 8px ${categoryColor}50`,
              cursor: "crosshair",
            }}
          />
        );
      })}

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

/** Shared "Context Only" toggle for data source nodes */
export function ContextOnlyToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-[10px] text-edge-muted/70 cursor-pointer group" title="When enabled, this source provides data for other nodes but does not independently trigger the strategy pipeline">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="node-checkbox cursor-pointer"
      />
      <span className="group-hover:text-edge-muted transition-colors">Context only</span>
    </label>
  );
}

/**
 * Config fields that get overridden when a data source has incoming connections.
 * Maps node type → the config field that upstream search_terms will replace.
 */
const REACTIVE_OVERRIDE_FIELDS: Record<string, string> = {
  polymarket_feed: "market_search",
  gemini_markets_feed: "event_search",
  news_monitor: "keywords",
  twitter_monitor: "keywords",
};

/**
 * Detects which config fields will be overridden by upstream nodes at runtime.
 * Returns a map of { configField: { label, icon, color } } for each overridden field.
 */
export function useFieldOverrides(nodeId: string, nodeType: string) {
  const edges = useEdges();
  const nodes = useNodes();

  return useMemo(() => {
    const resolved = resolveNodeType(nodeType);
    const field = REACTIVE_OVERRIDE_FIELDS[resolved];
    if (!field) return {} as Record<string, { label: string; icon: string; color: string }>;

    const incomingEdges = edges.filter((e) => e.target === nodeId);
    if (incomingEdges.length === 0) return {} as Record<string, { label: string; icon: string; color: string }>;

    // Use the first direct parent as the override source
    const srcId = incomingEdges[0].source;
    const srcNode = nodes.find((n) => n.id === srcId);
    if (!srcNode?.type) return {} as Record<string, { label: string; icon: string; color: string }>;

    const srcDef = NODE_TYPES[resolveNodeType(srcNode.type as string)];
    if (!srcDef) return {} as Record<string, { label: string; icon: string; color: string }>;

    return {
      [field]: { label: srcDef.label, icon: srcDef.icon, color: srcDef.color },
    };
  }, [nodeId, nodeType, edges, nodes]);
}

/** Pill shown in place of an input when the field is overridden by an upstream node */
export function OverridePill({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-md text-[11px]"
      style={{
        background: `${color}12`,
        border: `1px solid ${color}25`,
      }}
    >
      <span className="text-xs leading-none">{icon}</span>
      <span style={{ color: `${color}50` }} className="text-[10px]">→</span>
      <span className="font-medium truncate" style={{ color: `${color}cc` }}>{label}</span>
    </div>
  );
}

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
